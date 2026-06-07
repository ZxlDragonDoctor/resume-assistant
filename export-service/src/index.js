const express = require('express');
const amqp = require('amqplib');
const Minio = require('minio');
const puppeteer = require('puppeteer');
const crypto = require('crypto');

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '';

const app = express();
app.use(express.json());

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000');
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin123';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'resume-exports';

const RMQ_URL = process.env.RMQ_URL || 'amqp://resume:resume123@localhost:5672';
const QUEUE = 'export_tasks';

const minioClient = new Minio.Client({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: false,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
});

async function ensureBucket() {
  const exists = await minioClient.bucketExists(MINIO_BUCKET);
  if (!exists) await minioClient.makeBucket(MINIO_BUCKET);
}

async function generatePdf(templateHtml, options = {}) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ...(CHROME_PATH ? { executablePath: CHROME_PATH } : {}),
  });

  try {
    const page = await browser.newPage();
    await page.setContent(templateHtml, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
      printBackground: true,
      preferCSSPageSize: true,
    });

    return pdf;
  } finally {
    await browser.close();
  }
}

function generateTemplateHtml(templateData, resumeData) {
  const resume = resumeData.data || resumeData;
  const sections = resume.sections || [];
  const fontFamily = resume.fontFamily || 'system-ui';
  const themeColor = resume.themeColor || '#2563eb';
  const name = resume.title || '';

  // Build contact info line
  const contactParts = [];
  if (resume.targetJob) contactParts.push(resume.targetJob);
  if (resume.targetCompany) contactParts.push(resume.targetCompany);
  const contactLine = contactParts.join(' · ');

  const typeLabels = {
    'summary': '个人总结',
    'experience': '工作经历',
    'education': '教育背景',
    'projects': '项目经历',
    'skills': '专业技能',
    'awards': '竞赛获奖与证书',
    'certificates': '竞赛获奖与证书',
  };

  let sectionsHtml = '';
  for (const s of sections) {
    const label = typeLabels[s.sectionType] || s.sectionType;
    sectionsHtml += `<div class="section"><div class="section-title">${label}</div>`;

    if (s.sectionType === 'summary') {
      const content = (s.data && s.data.content) || '';
      sectionsHtml += `<div class="summary-text">${content.replace(/\n/g, '<br>')}</div>`;
    } else if (s.sectionType === 'skills') {
      const items = Array.isArray(s.data) ? s.data : (s.data && s.data.items || []);
      sectionsHtml += '<div class="skills">' + items.map(sk => {
        if (typeof sk === 'string') return `<span class="skill-tag">${sk}</span>`;
        if (sk.name) return `<span class="skill-tag skill-cat">${sk.name}：${(sk.items || []).join('、')}</span>`;
        return '';
      }).join('') + '</div>';
    } else if (s.sectionType === 'awards' || s.sectionType === 'certificates') {
      const items = Array.isArray(s.data) ? s.data : (s.data && s.data.items || []);
      if (items.length > 0) {
        sectionsHtml += '<div class="awards-list">';
        items.forEach(item => {
          const title = item.title || item.name || '';
          const date = item.date || item.startDate || '';
          const level = item.level || item.subtitle || '';
          sectionsHtml += `<div class="award-item"><span class="award-title">${title}</span>${level ? `<span class="award-level">${level}</span>` : ''}${date ? `<span class="award-date">${date}</span>` : ''}</div>`;
        });
        sectionsHtml += '</div>';
      }
    } else {
      const items = Array.isArray(s.data) ? s.data : (s.data && s.data.items || []);
      items.forEach(item => {
        const title = item.title || item.institution || item.company || item.name || '';
        const subtitle = item.subtitle || item.degree || item.position || item.major || item.role || '';
        const startDate = item.startDate || '';
        const endDate = item.endDate || '';
        const dateStr = startDate + (endDate ? ' - ' + endDate : '');
        const bullets = item.bullets || [];
        sectionsHtml += `<div class="item"><div class="item-header"><span class="item-title">${title}</span>${dateStr ? `<span class="item-date">${dateStr}</span>` : ''}</div>` +
          (subtitle ? `<div class="item-subtitle">${subtitle}</div>` : '') +
          (bullets.length > 0 ? '<div class="item-body"><ul>' + bullets.map(b => `<li>${b}</li>`).join('') + '</ul></div>' : '') +
          `</div>`;
      });
    }
    sectionsHtml += '</div>';
  }

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Noto Sans SC', 'Inter', ${fontFamily}, sans-serif; font-size: 14px; line-height: 1.7; color: #334155; padding: 40px 50px; }
  .header { text-align: center; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 3px solid ${themeColor}; }
  .header h1 { font-size: 28px; font-weight: 700; color: #0f172a; margin-bottom: 6px; letter-spacing: 2px; }
  .header .contact { font-size: 13px; color: #64748b; }
  .section { margin-bottom: 22px; }
  .section-title { font-size: 16px; font-weight: 700; color: #0f172a; border-left: 4px solid ${themeColor}; padding-left: 10px; margin-bottom: 12px; }
  .item { margin-bottom: 14px; }
  .item-header { display: flex; justify-content: space-between; align-items: baseline; }
  .item-title { font-weight: 600; color: #0f172a; font-size: 14px; }
  .item-subtitle { font-size: 13px; color: #64748b; margin-top: 2px; }
  .item-date { font-size: 12px; color: #94a3b8; white-space: nowrap; }
  .item-body { margin-top: 4px; }
  .item-body ul { padding-left: 18px; margin-top: 2px; }
  .item-body li { margin-bottom: 3px; font-size: 13px; color: #475569; }
  .skills { display: flex; flex-wrap: wrap; gap: 6px 8px; }
  .skill-tag { background: #f8fafc; color: #334155; padding: 3px 12px; border-radius: 4px; font-size: 12px; border: 1px solid #e2e8f0; }
  .skill-cat { background: ${themeColor}11; color: ${themeColor}; border-color: ${themeColor}33; font-weight: 500; padding: 4px 14px; }
  .summary-text { font-size: 13px; color: #475569; line-height: 1.8; }
  .awards-list { display: flex; flex-direction: column; gap: 6px; }
  .award-item { display: flex; align-items: baseline; gap: 8px; font-size: 13px; padding: 4px 0; border-bottom: 1px dashed #f1f5f9; }
  .award-title { font-weight: 500; color: #0f172a; }
  .award-level { color: ${themeColor}; font-size: 12px; }
  .award-date { color: #94a3b8; font-size: 12px; margin-left: auto; white-space: nowrap; }
</style></head><body>
<div class="header">
  <h1>${name}</h1>
  ${contactLine ? `<div class="contact">${contactLine}</div>` : ''}
</div>
${sectionsHtml}
</body></html>`;
}

async function processTask(task) {
  const { taskId, resumeId, format, templateId } = task;

  // Fetch resume data from resume-service
  const resumeResp = await fetch(`http://localhost:8082/api/resumes/${resumeId}`, {
    headers: { 'Authorization': 'internal' }
  });
  const resumeData = await resumeResp.json();

  // Fetch template config from template-service
  const templateResp = await fetch(`http://localhost:8083/api/templates/${templateId}`);
  const templateData = await templateResp.json();

  // Generate resume HTML from template config + resume data
  const templateHtml = generateTemplateHtml(templateData, resumeData);

  let pdfBuffer;
  if (format === 'pdf') {
    pdfBuffer = await generatePdf(templateHtml);
  } else {
    throw new Error(`Unsupported format: ${format}`);
  }

  const objectName = `resume_${resumeId}_${taskId}.pdf`;
  await minioClient.putObject(MINIO_BUCKET, objectName, pdfBuffer);

  return { url: `http://${MINIO_ENDPOINT}:${MINIO_PORT}/${MINIO_BUCKET}/${objectName}` };
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

// Direct export endpoint (HTTP trigger, not via MQ)
app.post('/export', async (req, res) => {
  try {
    const { resumeId, templateId } = req.body;
    if (!resumeId) return res.status(400).json({ error: 'resumeId is required' });

    const taskId = crypto.randomUUID();
    const result = await processTask({ taskId, resumeId, format: 'pdf', templateId });
    res.json({ success: true, taskId, url: result.url });
  } catch (err) {
    console.error('Export failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

startWorker().catch(err => console.warn('RabbitMQ worker not available (HTTP /export still works):', err.message));

const PORT = process.env.PORT || 8085;
app.listen(PORT, () => console.log(`Export service listening on ${PORT}`));
