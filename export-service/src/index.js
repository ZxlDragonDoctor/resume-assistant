const express = require('express');
const amqp = require('amqplib');
const Minio = require('minio');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const { marked } = require('marked');

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '';

const app = express();
app.use(express.json({ limit: '10mb' }));

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000');
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin123';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'resume-exports';

const RMQ_URL = process.env.RMQ_URL || 'amqp://resume:resume123@localhost:5672';
const QUEUE = 'export_tasks';

const minioClient = new Minio.Client({
  endPoint: MINIO_ENDPOINT, port: MINIO_PORT, useSSL: false,
  accessKey: MINIO_ACCESS_KEY, secretKey: MINIO_SECRET_KEY,
});

async function ensureBucket() {
  const exists = await minioClient.bucketExists(MINIO_BUCKET);
  if (!exists) await minioClient.makeBucket(MINIO_BUCKET);
}

async function generatePdf(templateHtml, options = {}) {
  const browser = await puppeteer.launch({
    headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ...(CHROME_PATH ? { executablePath: CHROME_PATH } : {}),
  });
  try {
    const page = await browser.newPage();
    await page.setContent(templateHtml, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
      printBackground: true, preferCSSPageSize: true,
    });
    return pdf;
  } finally { await browser.close(); }
}

function generateTemplateHtml(templateData, resumeData) {
  const resume = resumeData.data || resumeData;
  const sections = resume.sections || [];
  let layout = {};
  if (resume.layoutConfig) {
    try { layout = JSON.parse(resume.layoutConfig); } catch (e) { layout = {}; }
  }
  const layFontFamily = layout.globalFontFamily || resume.fontFamily || 'system-ui';
  const globalContentFontSize = layout.globalFontSize || resume.fontSize || 14;
  const globalLineSpacing = layout.globalLineSpacing || resume.lineSpacing || 1.6;
  const pageTop = layout.pageTopMargin ?? 40;
  const pageLeft = layout.pageLeftMargin ?? 35;
  const pageRight = layout.pageRightMargin ?? 35;
  const moduleMargin = layout.moduleMargin ?? 22;
  const titleBottom = layout.titleBottomMargin ?? 12;
  const titleTop = layout.titleTopPadding ?? 4;

  const typeLabels = {
    basic: '基本信息', summary: '个人总结', experience: '实习经历',
    education: '教育经历', projects: '项目经历', skills: '专业技能',
    awards: '荣誉奖项和证书', certificates: '证书',
    custom: '自定义模块',
  };

  // Render content with proper Markdown support
  function renderContent(content, textColor, fontSize, lineSpacing, markdownMode) {
    if (!content || !content.trim()) return '';
    const color = textColor || '#334155';
    const fs = (fontSize || 14) - 1;
    const ls = lineSpacing || 1.6;

    // Already HTML - render directly
    if (/<\/?[a-z][\s\S]*>/i.test(content)) {
      return `<div style="font-size:${fs}px;line-height:${ls};color:${color}">${content}</div>`;
    }

    // Markdown mode or looks like markdown
    if (markdownMode || /[*#\->`\[\!]/.test(content)) {
      const html = marked.parse(content, { gfm: true, breaks: true });
      return `<div style="font-size:${fs}px;line-height:${ls};color:${color}">${html}</div>`;
    }

    // Plain text
    let html = content
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
    return `<div style="font-size:${fs}px;line-height:${ls};color:${color}">${html}</div>`;
  }

  let sectionsHtml = '';
  for (const s of sections) {
    let data = s.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { data = {}; }
    }
    if (!data) data = {};

    const cfg = data._config || {};
    const titleFontSize = cfg.titleFontSize || (cfg.fontSize ? cfg.fontSize + 2 : 16);
    const contentFontSize = cfg.contentFontSize || cfg.fontSize || 14;
    const titleColor = cfg.titleColor || cfg.themeColor || '#1e293b';
    const textColor = cfg.textColor || cfg.themeColor || '#334155';
    const lineSpacing = cfg.lineSpacing || 1.6;
    const textAlign = cfg.textAlign || 'left';
    const markdownMode = cfg.markdownMode !== false;
    const moduleName = cfg.moduleName || typeLabels[s.sectionType] || s.sectionType || '未命名模块';

    // Basic info section
    if (s.sectionType === 'basic') {
      sectionsHtml += `<div style="margin-bottom:22px;text-align:${textAlign};color:${textColor}">`;
      if (data.name) {
        sectionsHtml += `<div style="font-size:${titleFontSize + 10}px;font-weight:700;color:${titleColor};margin-bottom:6px">${escHtml(data.name)}</div>`;
      }
      const contacts = [];
      if (data.phone) contacts.push('📞 ' + escHtml(data.phone));
      if (data.email) contacts.push('✉️ ' + escHtml(data.email));
      if (contacts.length) {
        const jc = textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center';
        sectionsHtml += `<div style="display:flex;justify-content:${jc};gap:16px;flex-wrap:wrap;font-size:${contentFontSize - 1}px;opacity:0.7">${contacts.join('')}</div>`;
      }
      sectionsHtml += '</div>';
      continue;
    }

    // Section container with per-module styling
    sectionsHtml += `<div style="margin-bottom:${moduleMargin}px;font-size:${contentFontSize}px;line-height:${lineSpacing};color:${textColor};text-align:${textAlign}">`;
    // Title bar
    sectionsHtml += `<div style="font-size:${titleFontSize}px;font-weight:600;color:${titleColor};border-bottom:2px solid ${titleColor};padding-top:${titleTop}px;padding-bottom:4px;margin-bottom:${titleBottom}px">${escHtml(moduleName)}</div>`;

    switch (s.sectionType) {
      case 'custom':
        sectionsHtml += renderContent(data.content, textColor, contentFontSize, lineSpacing, markdownMode);
        break;
      case 'summary':
        sectionsHtml += renderContent(data.content, textColor, contentFontSize, lineSpacing, markdownMode);
        break;

      case 'skills': {
        const items = Array.isArray(data) ? data : (data.items || []);
        sectionsHtml += '<div style="display:flex;flex-wrap:wrap;gap:8px">';
        items.forEach(sk => {
          if (typeof sk === 'string') {
            sectionsHtml += `<span style="background:#f1f5f9;color:${textColor};padding:2px 12px;border-radius:4px;font-size:${contentFontSize - 1}px">${escHtml(sk)}</span>`;
          } else if (sk && sk.name) {
            sectionsHtml += `<span style="background:${titleColor}11;color:${titleColor};padding:4px 14px;border-radius:4px;font-size:${contentFontSize - 1}px;font-weight:500;border:1px solid ${titleColor}33">${escHtml(sk.name)}：${(sk.items || []).map(i => escHtml(i)).join('、')}</span>`;
          }
        });
        sectionsHtml += '</div>';
        break;
      }

      case 'awards':
      case 'certificates': {
        const items = Array.isArray(data) ? data : (data.items || []);
        if (items.length) {
          sectionsHtml += '<div style="display:flex;flex-direction:column;gap:6px">';
          items.forEach(item => {
            const title = item.title || item.name || '';
            const date = item.date || item.startDate || '';
            const level = item.level || item.subtitle || '';
            sectionsHtml += `<div style="display:flex;align-items:baseline;gap:8px;font-size:${contentFontSize - 1}px">`;
            sectionsHtml += `<span style="font-weight:500;color:${titleColor}">${escHtml(title)}</span>`;
            if (level) sectionsHtml += `<span style="color:${titleColor};font-size:${contentFontSize - 2}px;opacity:0.7">${escHtml(level)}</span>`;
            if (date) sectionsHtml += `<span style="font-size:${contentFontSize - 2}px;opacity:0.5;margin-left:auto">${escHtml(date)}</span>`;
            sectionsHtml += '</div>';
          });
          sectionsHtml += '</div>';
        }
        break;
      }

      default: {
        // experience, education, projects
        const items = Array.isArray(data) ? data : (data.items || []);
        items.forEach(item => {
          if (!item) return;
          const title = item.title || item.institution || item.school || item.company || item.name || '';
          const subtitle = item.subtitle || item.degree || item.position || item.major || item.role || '';
          const tech = item.tech || '';
          const startDate = item.startDate || '';
          const endDate = item.endDate || '';
          const dateStr = startDate + (endDate ? ' - ' + endDate : '');
          const bullets = item.bullets || [];

          sectionsHtml += `<div style="margin-bottom:${s.sectionType === 'education' ? 12 : 16}px">`;
          sectionsHtml += `<div style="display:flex;justify-content:space-between;align-items:baseline">`;
          sectionsHtml += `<div><span style="font-weight:600;color:${titleColor};font-size:${titleFontSize}px">${escHtml(title)}</span>`;
          if (subtitle) sectionsHtml += `<span style="margin-left:8px;font-size:${contentFontSize - 1}px;opacity:0.7">${escHtml(subtitle)}</span>`;
          sectionsHtml += '</div>';
          if (dateStr) sectionsHtml += `<span style="font-size:${contentFontSize - 2}px;opacity:0.5">${escHtml(dateStr)}</span>`;
          sectionsHtml += '</div>';
          if (tech) sectionsHtml += `<div style="font-size:${contentFontSize - 2}px;color:${titleColor};margin-top:2px;font-weight:500">技术栈：${escHtml(tech)}</div>`;
          bullets.forEach(b => {
            if (b && b.trim()) sectionsHtml += renderContent(b, textColor, contentFontSize, lineSpacing, markdownMode);
          });
          sectionsHtml += '</div>';
        });
      }
    }
    sectionsHtml += '</div>';
  }

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Noto Sans SC', 'Inter', ${layFontFamily}, sans-serif;
    font-size: 14px; line-height: 1.6; color: #334155; padding: ${pageTop}px ${pageRight}px ${pageTop}px ${pageLeft}px;
  }
  .section { margin-bottom: 22px; }
  .section ul, .section ol { padding-left: 20px; margin: 4px 0; }
  .section li { margin: 2px 0; }
  .section p { margin: 3px 0; }
  code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 12px; color: #e11d48; }
  pre { background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin: 8px 0; overflow-x: auto; }
  pre code { background: none; padding: 0; color: #334155; }
  blockquote { border-left: 3px solid #2563eb; padding-left: 12px; color: #64748b; margin: 8px 0; }
  strong { font-weight: 600; }
  h1, h2, h3, h4 { margin: 8px 0 4px; font-weight: 600; color: #0f172a; }
  table { border-collapse: collapse; width: 100%; margin: 6px 0; }
  th, td { border: 1px solid #e2e8f0; padding: 4px 8px; text-align: left; }
  th { background: #f8fafc; font-weight: 600; }
</style></head><body>
${sectionsHtml}
</body></html>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function processTask(task) {
  const { taskId, resumeId, format, templateId, authToken } = task;
  const headers = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const resumeResp = await fetch(`http://localhost:8080/api/resumes/${resumeId}`, { headers });
  if (!resumeResp.ok) throw new Error(`Failed to fetch resume: ${resumeResp.status}`);
  const resumeData = await resumeResp.json();
  const templateHtml = generateTemplateHtml(null, resumeData);

  let pdfBuffer;
  if (format === 'pdf') {
    pdfBuffer = await generatePdf(templateHtml);
  } else {
    throw new Error(`Unsupported format: ${format}`);
  }

  const objectName = `resume_${resumeId}_${taskId}.pdf`;
  await minioClient.putObject(MINIO_BUCKET, objectName, pdfBuffer);
  const presignedUrl = await minioClient.presignedGetObject(MINIO_BUCKET, objectName, 60 * 60);
  return { url: presignedUrl };
}

async function startWorker() {
  await ensureBucket();
  const conn = await amqp.connect(RMQ_URL);
  const channel = await conn.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  console.log('Export worker started, waiting for tasks...');
  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;
    const task = JSON.parse(msg.content.toString());
    try {
      const result = await processTask(task);
      channel.sendToQueue(msg.properties.replyTo,
        Buffer.from(JSON.stringify({ success: true, ...result })),
        { correlationId: msg.properties.correlationId });
      channel.ack(msg);
    } catch (err) {
      channel.sendToQueue(msg.properties.replyTo,
        Buffer.from(JSON.stringify({ success: false, error: err.message })),
        { correlationId: msg.properties.correlationId });
      channel.ack(msg);
    }
  });
}

app.post('/export', async (req, res) => {
  try {
    const { resumeId, templateId } = req.body;
    if (!resumeId) return res.status(400).json({ error: 'resumeId is required' });
    const authHeader = req.headers['authorization'] || '';
    const authToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const taskId = crypto.randomUUID();
    const result = await processTask({ taskId, resumeId, format: 'pdf', templateId, authToken });
    res.json({ success: true, taskId, url: result.url });
  } catch (err) {
    console.error('Export failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/export/direct', async (req, res) => {
  try {
    const { resumeData } = req.body;
    if (!resumeData) return res.status(400).json({ error: 'resumeData is required' });
    const templateHtml = generateTemplateHtml(null, resumeData);
    const pdfBuffer = await generatePdf(templateHtml);
    const filename = `resume_${(resumeData.title || 'export').replace(/[^a-zA-Z0-9一-鿿]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Direct export failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

startWorker().catch(err => console.warn('RabbitMQ worker not available (HTTP /export still works):', err.message));

const PORT = process.env.PORT || 8085;
app.listen(PORT, () => console.log(`Export service listening on ${PORT}`));
