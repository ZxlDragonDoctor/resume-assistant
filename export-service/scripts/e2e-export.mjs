/**
 * 导出 PDF 端到端验证：真实点击编辑器里的「导出 PDF」，
 * 确认请求打到 8085 且下载到有效 PDF（而不是被网关 401 拦下）。
 */
import puppeteer from 'puppeteer';
import {
  mkdirSync, statSync, readFileSync, rmSync, readdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, '..', 'shots');
const DL_DIR = join(__dirname, '..', 'tmp', 'downloads');
const BASE = 'http://localhost:5173';
const EMAIL = `exp_${Date.now()}@test.com`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

rmSync(DL_DIR, { recursive: true, force: true });
mkdirSync(DL_DIR, { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const exportCalls = [];
const consoleErrors = [];

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  page.on('response', async (res) => {
    const u = res.url();
    if (u.includes('/export/')) {
      let size = '';
      try {
        const buf = await res.buffer();
        size = `${buf.length} bytes, magic=${buf.slice(0, 5).toString('latin1')}`;
      } catch {}
      exportCalls.push({ url: u.replace(BASE, ''), status: res.status(), size });
    }
  });
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|404|DevTools|ResizeObserver/i.test(m.text()))
      consoleErrors.push(m.text());
  });

  const clickText = (pat) =>
    page.evaluate((p) => {
      const re = new RegExp(p);
      const el = [...document.querySelectorAll('button, a, span, div[role="button"]')]
        .find((e) => re.test((e.textContent || '').trim()) && e.offsetParent !== null);
      if (el) { el.click(); return true; }
      return false;
    }, pat);

  const fill = (pat, val) =>
    page.evaluate((p, v) => {
      const re = new RegExp(p);
      const i = [...document.querySelectorAll('input')]
        .find((e) => re.test(e.getAttribute('placeholder') || ''));
      if (!i) return false;
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, v);
      i.dispatchEvent(new Event('input', { bubbles: true }));
      i.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, pat, val);

  // 注册 → 建简历 → 进编辑器
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2500);
  await clickText('免费注册');
  await sleep(1000);
  await fill('昵称|用户名|姓名', '导出验证');
  await fill('邮箱|邮件|email', EMAIL);
  await fill('密码|password', 'test123456');
  await clickText('^注册并开始$|注册并开始');
  await sleep(5000);

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find((x) => /创建简历|新建简历/.test((x.textContent || '').trim()));
    b && b.click();
  });
  await sleep(2500);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find((x) => /创建并编辑/.test((x.textContent || '').trim()));
    b && b.click();
  });
  await sleep(7000);

  // 填入真实内容 —— 空白简历导出的 PDF 只有一张白纸，无法验证渲染。
  // 在「基本信息」模块填姓名/岗位/手机，确保 PDF 里应当出现文字。
  await page.evaluate(() => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value').set;
    const visible = [...document.querySelectorAll('input, textarea')]
      .filter((e) => e.offsetParent !== null);
    // 按顺序填前几个字段（姓名 / 岗位 / 手机 …），不依赖具体 placeholder 文案
    const values = ['张三', 'Java后端开发工程师', '13800138000', '上海'];
    visible.slice(0, values.length).forEach((el, i) => {
      setter.call(el, values[i]);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  await sleep(2500); // 等内容防抖保存
  await page.screenshot({ path: join(SHOT_DIR, 'export-00-filled.png') });

  // 点击「导出」→ 弹窗 → 「生成并下载 PDF」
  const openedExport = await clickText('导出');
  await sleep(2500);
  await page.screenshot({ path: join(SHOT_DIR, 'export-01-dialog.png') });
  console.log('打开导出弹窗:', openedExport);

  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: DL_DIR,
  });

  const dlClicked = await clickText('生成并下载 PDF|生成并下载PDF');
  console.log('点击下载 PDF:', dlClicked);
  await sleep(35000);

  await page.screenshot({ path: join(SHOT_DIR, 'export-02-result.png') });

  // 检查下载目录
  let files = [];
  try { files = readdirSync(DL_DIR); } catch {}

  const results = [];
  const record = (name, pass, detail = '') => {
    results.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
  };

  console.log('');
  const pdfFile = files.find((f) => f.endsWith('.pdf'));
  let pdfSize = 0;
  let magic = '';
  if (pdfFile) {
    const p = join(DL_DIR, pdfFile);
    pdfSize = statSync(p).size;
    magic = readFileSync(p).slice(0, 5).toString('latin1');
  }

  const call = exportCalls.find((c) => c.url.includes('/export/direct'));
  record('导出请求打到 /export/direct（未被网关拦成 /api/export/*）',
    !!call, call ? `${call.status}` : '未捕获');
  record('导出接口返回 200', call?.status === 200, call ? `HTTP ${call.status}` : '-');
  record('浏览器成功下载到文件', !!pdfFile, pdfFile || '无文件');
  record('下载内容是有效 PDF', magic === '%PDF-', magic || '-');
  // 有内容的简历导出后应远大于「一张空白 A4」（约 1KB）
  record('PDF 含实际渲染内容（>20KB）', pdfSize > 20480, `${pdfSize} bytes`);
  record('控制台无严重错误', consoleErrors.length === 0,
    consoleErrors.length ? consoleErrors.slice(0, 2).join(' | ').slice(0, 180) : '干净');

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`通过 ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    console.log('失败项：');
    for (const f of failed) console.log(`  - ${f.name}  ${f.detail}`);
  }
  process.exitCode = failed.length ? 1 : 0;
} finally {
  await browser.close();
}
