/**
 * AI 面板端到端验证：通过真实浏览器触发一次 AI 优化，
 * 确认走的是千问（engine=llm）而不是规则引擎兜底。
 */
import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, '..', 'shots');
const BASE = 'http://localhost:5173';
const EMAIL = `qwenui_${Date.now()}@test.com`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  const aiResponses = [];
  const consoleErrors = [];
  page.on('response', async (res) => {
    const u = res.url();
    if (u.includes('/api/ai/')) {
      let body = '';
      try { body = (await res.text()).slice(0, 400); } catch {}
      aiResponses.push({ url: u.replace(BASE, ''), status: res.status(), body });
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

  // 注册并进入编辑器
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2500);
  await clickText('免费注册');
  await sleep(1000);
  await fill('昵称|用户名|姓名', 'AI验证');
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

  mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: join(SHOT_DIR, 'ai-01-editor.png') });

  // 打开 AI 面板
  const opened = await clickText('AI 助手|AI助手|AI 优化|智能优化');
  await sleep(2000);
  await page.screenshot({ path: join(SHOT_DIR, 'ai-02-panel.png') });
  console.log('AI 面板打开:', opened);

  // 「内容」页签默认展示「生成个人总结」——
  // 填目标岗位 + 年限，然后点「生成总结」触发真实 LLM 调用。
  const filledRole = await page.evaluate(() => {
    const i = [...document.querySelectorAll('input')]
      .find((e) => /目标岗位/.test(e.getAttribute('placeholder') || ''));
    if (!i) return false;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(i, 'Java后端开发');
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  });
  console.log('填入目标岗位:', filledRole);
  await sleep(600);

  // 点「生成总结」
  const genClicked = await clickText('生成总结|生成个人总结');
  console.log('点击生成总结:', genClicked);
  await sleep(30000);

  await page.screenshot({ path: join(SHOT_DIR, 'ai-03-result.png') });

  // 读取结果区文本，判断是否拿到了真实内容
  const panelText = await page.evaluate(() => {
    const t = document.body.innerText;
    return { hasRuleTag: /本地规则/.test(t), hasLlmTag: /已接入|AI 已接入/.test(t), len: t.length };
  });
  console.log('面板状态:', JSON.stringify(panelText));

  console.log('\n=== /api/ai/ 网络响应 ===');
  for (const r of aiResponses) {
    console.log(`${r.status}  ${r.url}`);
    console.log(`     ${r.body.slice(0, 320)}`);
  }
  if (!aiResponses.length) console.log('(未捕获到 AI 请求)');
  console.log('\n控制台错误:', consoleErrors.length ? consoleErrors.slice(0, 3) : '无');
} finally {
  await browser.close();
}
