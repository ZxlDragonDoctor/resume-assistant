/**
 * Export Service
 * ------------------------------------------------------------------
 * 职责：把简历数据渲染成 HTML，再用 Puppeteer 打印为 A4 PDF。
 * 提供两条通道：
 *   1. HTTP  /export/direct —— 同步返回 PDF 二进制流（编辑器「导出 PDF」）
 *   2. HTTP  /export        —— 渲染后上传 MinIO，返回临时下载链接
 *   3. RabbitMQ export_tasks —— 异步任务，配合网关做后台导出
 */

const express = require('express');
const amqp = require('amqplib');
const Minio = require('minio');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const { renderResumeHtml, paginateSectionsByHeight } = require('./renderer');

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '';

const app = express();
app.use(express.json({ limit: '20mb' }));

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin123';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'resume-exports';
const RMQ_USER = process.env.RABBITMQ_USER || process.env.RMQ_USER || 'resume';
const RMQ_PASSWORD = process.env.RABBITMQ_PASSWORD || process.env.RMQ_PASSWORD || 'resume123';
const RMQ_URL =
  process.env.RMQ_URL ||
  `amqp://${RMQ_USER}:${RMQ_PASSWORD}@${process.env.RMQ_HOST || 'localhost'}:5672`;
const QUEUE = 'export_tasks';
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8080';

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

// ------------------------------------------------------------------
// PDF 生成
// ------------------------------------------------------------------

/** 复用同一个浏览器实例，避免每次导出都冷启动 Chrome（明显更快） */
let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none',
      ],
      ...(CHROME_PATH ? { executablePath: CHROME_PATH } : {}),
    });
  }
  return browserPromise;
}

async function reflowResumePages(page) {
  const measurements = await page.evaluate(() => {
    const firstPage = document.querySelector('.page');
    const grid = firstPage?.querySelector('.layout-two-column, .layout-sidebar, .layout-single');
    if (!firstPage || !grid) return null;

    const mode = grid.classList.contains('layout-sidebar') ? 'sidebar'
      : grid.classList.contains('layout-two-column') ? 'two-column' : 'single-column';
    const mainColumn = mode === 'single-column' ? grid : grid.querySelector('.col-main');
    const sideColumn = grid.querySelector('.col-side');
    if (!mainColumn) return null;

    const innerWidth = (column) => {
      const style = getComputedStyle(column);
      return column.getBoundingClientRect().width
        - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0')
        - parseFloat(style.borderLeftWidth || '0') - parseFloat(style.borderRightWidth || '0');
    };
    const mainWidth = innerWidth(mainColumn);
    const sideWidth = sideColumn ? innerWidth(sideColumn) : mainWidth;
    const pageStyle = getComputedStyle(firstPage);
    const columnCapacity = parseFloat(pageStyle.minHeight)
      - parseFloat(pageStyle.paddingTop)
      - parseFloat(pageStyle.paddingBottom);
    const header = firstPage.querySelector('.resume-header');
    const headerStyle = header ? getComputedStyle(header) : null;
    const headerHeight = header
      ? header.getBoundingClientRect().height + parseFloat(headerStyle.marginBottom || '0')
      : 0;

    const host = document.createElement('div');
    const pageFont = getComputedStyle(document.body);
    Object.assign(host.style, {
      position: 'fixed',
      left: '-100000px',
      top: '0',
      width: '794px',
      padding: '0',
      margin: '0',
      visibility: 'hidden',
      pointerEvents: 'none',
      fontFamily: pageFont.fontFamily,
      fontSize: pageFont.fontSize,
      fontWeight: pageFont.fontWeight,
      lineHeight: pageFont.lineHeight,
      color: pageFont.color,
    });
    document.body.appendChild(host);

    const measure = (section, width) => {
      const clone = section.cloneNode(true);
      clone.style.width = `${width}px`;
      host.appendChild(clone);
      const rect = clone.getBoundingClientRect();
      const style = getComputedStyle(clone);
      const height = rect.height + parseFloat(style.marginTop || '0') + parseFloat(style.marginBottom || '0');
      clone.remove();
      return height;
    };

    const sections = [...document.querySelectorAll('.resume-section[data-section-id]')]
      .sort((a, b) => Number(a.dataset.sortOrder || 0) - Number(b.dataset.sortOrder || 0))
      .map((section) => ({
        id: section.dataset.sectionId,
        sectionType: section.dataset.section,
        layout: section.dataset.layout || 'auto',
        mainHeight: measure(section, mainWidth),
        sideHeight: measure(section, sideWidth),
      }));
    host.remove();

    return {
      mode,
      sections,
      columnCapacity,
      firstPageCapacity: Math.max(1, columnCapacity - headerHeight),
    };
  });

  if (!measurements) return;
  const pages = paginateSectionsByHeight(measurements.sections, {
    mode: measurements.mode,
    firstPageCapacity: Math.max(1, measurements.firstPageCapacity - 8),
    columnCapacity: Math.max(1, measurements.columnCapacity - 8),
    heightFor: (section, column) => column === 'side' ? section.sideHeight : section.mainHeight,
  });
  if (!pages.length) pages.push({ main: [], side: [] });

  await page.evaluate((placements) => {
    const firstPage = document.querySelector('.page');
    const layoutTemplate = firstPage?.querySelector('.layout-two-column, .layout-sidebar, .layout-single');
    if (!firstPage || !layoutTemplate) return;

    const sectionNodes = new Map(
      [...document.querySelectorAll('.resume-section[data-section-id]')]
        .map((section) => [section.dataset.sectionId, section]),
    );
    const header = firstPage.querySelector('.resume-header');
    const pages = placements.map((placement, index) => {
      const pageNode = firstPage.cloneNode(false);
      pageNode.dataset.page = String(index + 1);
      if (index === 0 && header) pageNode.appendChild(header);

      const grid = layoutTemplate.cloneNode(true);
      const main = grid.classList.contains('layout-single') ? grid : grid.querySelector('.col-main');
      const side = grid.querySelector('.col-side');
      main.replaceChildren(...placement.main.map((id) => sectionNodes.get(id)).filter(Boolean));
      if (side) side.replaceChildren(...placement.side.map((id) => sectionNodes.get(id)).filter(Boolean));
      pageNode.appendChild(grid);
      return pageNode;
    });
    document.body.replaceChildren(...pages);
  }, pages.map((placement) => ({
    main: placement.main.map((section) => section.id),
    side: placement.side.map((section) => section.id),
  })));
}

async function generatePdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Chromium can defer font work in background pages; activate this export tab.
    await page.bringToFront();
    // The rendered HTML is self-contained. Wait for document load and fonts,
    // rather than an unrelated network-idle lifecycle that can stall in Chromium.
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
    // 等字体就绪，否则中文可能以 fallback 字体渲染
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await reflowResumePages(page);
    await page.bringToFront();
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
  } finally {
    await page.close();
  }
}

// ------------------------------------------------------------------
// 数据获取
// ------------------------------------------------------------------

async function fetchResume(resumeId, authToken) {
  const headers = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const resp = await fetch(`${GATEWAY_URL}/api/resumes/${resumeId}`, { headers });
  if (!resp.ok) throw new Error(`获取简历失败（HTTP ${resp.status}）`);
  const body = await resp.json();
  return body.data || body;
}

async function fetchTemplate(templateId) {
  if (!templateId) return null;
  try {
    const resp = await fetch(`${GATEWAY_URL}/api/templates/${templateId}`);
    if (!resp.ok) return null;
    const body = await resp.json();
    const tpl = body.data || body;
    if (tpl && tpl.config) {
      return typeof tpl.config === 'string' ? JSON.parse(tpl.config) : tpl.config;
    }
  } catch {
    /* 模板获取失败不阻断导出 */
  }
  return null;
}

// ------------------------------------------------------------------
// 任务处理
// ------------------------------------------------------------------

async function processTask(task) {
  const { taskId, resumeId, format = 'pdf', authToken } = task;
  const resume = await fetchResume(resumeId, authToken);
  const templateConfig = await fetchTemplate(resume.templateId);
  const html = renderResumeHtml(resume, { templateConfig });

  if (format !== 'pdf') throw new Error(`暂不支持的导出格式：${format}`);

  const pdfBuffer = await generatePdf(html);
  const objectName = `resume_${resumeId}_${taskId}.pdf`;
  await minioClient.putObject(MINIO_BUCKET, objectName, pdfBuffer, pdfBuffer.length, {
    'Content-Type': 'application/pdf',
  });
  const url = await minioClient.presignedGetObject(MINIO_BUCKET, objectName, 60 * 60);
  return { url, objectName, size: pdfBuffer.length };
}

function safeFilename(title) {
  const cleaned = String(title || 'resume').replace(/[\\/:*?"<>|\s]+/g, '_');
  return cleaned.slice(0, 60) || 'resume';
}

// ------------------------------------------------------------------
// HTTP 路由
// ------------------------------------------------------------------

/** 同步导出：直接把 PDF 二进制吐给前端，浏览器立即触发下载 */
app.post('/export/direct', async (req, res) => {
  try {
    const { resumeData, templateConfig } = req.body;
    if (!resumeData) {
      return res.status(400).json({ error: 'resumeData 不能为空' });
    }
    const resume = resumeData.data || resumeData;
    const html = renderResumeHtml(resume, { templateConfig });
    const pdfBuffer = await generatePdf(html);

    const filename = encodeURIComponent(`${safeFilename(resume.title)}.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="resume.pdf"; filename*=UTF-8''${filename}`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[/export/direct] 导出失败:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

/** 预览导出：返回 PDF 供 <iframe> 内嵌预览 */
app.post('/export/preview', async (req, res) => {
  try {
    const { resumeData, templateConfig } = req.body;
    if (!resumeData) return res.status(400).json({ error: 'resumeData 不能为空' });
    const resume = resumeData.data || resumeData;
    const html = renderResumeHtml(resume, { templateConfig });
    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', 'inline');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[/export/preview] 导出失败:', err);
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
  }
});

/** 返回渲染后的 HTML，便于调试版式 */
app.post('/export/html', async (req, res) => {
  try {
    const { resumeData, templateConfig } = req.body;
    if (!resumeData) return res.status(400).json({ error: 'resumeData 不能为空' });
    const resume = resumeData.data || resumeData;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderResumeHtml(resume, { templateConfig }));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** 异步导出：上传 MinIO 并返回临时链接 */
app.post('/export', async (req, res) => {
  try {
    const { resumeId } = req.body;
    if (!resumeId) return res.status(400).json({ error: 'resumeId 不能为空' });
    const authHeader = req.headers['authorization'] || '';
    const authToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const taskId = crypto.randomUUID();
    const result = await processTask({ taskId, resumeId, format: 'pdf', authToken });
    res.json({ success: true, taskId, ...result });
  } catch (err) {
    console.error('[/export] 导出失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', async (_req, res) => {
  let chromeReady = true;
  try {
    await getBrowser();
  } catch {
    chromeReady = false;
  }
  res.json({ status: 'ok', chrome: chromeReady });
});

// ------------------------------------------------------------------
// RabbitMQ 异步 worker
// ------------------------------------------------------------------

async function startWorker() {
  await ensureBucket();
  const conn = await amqp.connect(RMQ_URL);
  const channel = await conn.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  console.log('[export-service] RabbitMQ worker 已启动，等待任务...');

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;
    let task;
    try {
      task = JSON.parse(msg.content.toString());
    } catch {
      channel.ack(msg);
      return;
    }
    try {
      const result = await processTask(task);
      if (msg.properties.replyTo) {
        channel.sendToQueue(
          msg.properties.replyTo,
          Buffer.from(JSON.stringify({ success: true, ...result })),
          { correlationId: msg.properties.correlationId }
        );
      }
      channel.ack(msg);
    } catch (err) {
      if (msg.properties.replyTo) {
        channel.sendToQueue(
          msg.properties.replyTo,
          Buffer.from(JSON.stringify({ success: false, error: err.message })),
          { correlationId: msg.properties.correlationId }
        );
      }
      channel.ack(msg);
    }
  });
}

// ------------------------------------------------------------------
// 启动
// ------------------------------------------------------------------

ensureBucket().catch((err) =>
  console.warn('[export-service] MinIO 初始化失败（HTTP /export/direct 仍可用）:', err.message)
);

startWorker().catch((err) =>
  console.warn('[export-service] RabbitMQ 不可用（HTTP 导出仍可用）:', err.message)
);

const PORT = process.env.PORT || 8085;
app.listen(PORT, () => console.log(`[export-service] 监听端口 ${PORT}`));
