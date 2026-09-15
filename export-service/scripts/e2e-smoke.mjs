/**
 * 前端端到端冒烟测试（浏览器真实渲染）
 * ---------------------------------------------------------------------------
 * 用 Puppeteer 打开正在运行的前端，走一遍真实用户流程：
 *   1. 首页渲染
 *   2. /login 切到注册模式并提交（单页 mode 切换，非独立路由）
 *   3. 注册后进入工作台
 *   4. 新建简历 → 编辑器渲染 A4 纸张
 *   5. 控制台无严重错误
 *
 * 前置：前端(:5173)、网关(:8080) 及后端服务已启动。
 * 运行：node scripts/e2e-smoke.mjs
 */
import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, '..', 'shots');
const BASE = process.env.BASE_URL || 'http://localhost:5173';

const EMAIL = `e2e_${Date.now()}@test.com`;
const PASSWORD = 'test123456';
const NAME = 'E2E测试用户';

const results = [];
const consoleErrors = [];

const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (page, name) => {
  mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: join(SHOT_DIR, `${name}.png`) });
};
const clickByText = (page, pattern) =>
  page.evaluate((pat) => {
    const re = new RegExp(pat);
    const els = [...document.querySelectorAll('a, button, span, div[role="button"]')];
    const t = els.find((el) => re.test((el.textContent || '').trim()) && el.offsetParent !== null);
    if (t) { t.click(); return true; }
    return false;
  }, pattern);

/**
 * 读取 A4 纸张尺寸。
 * 编辑器为「适配预览区」会在纸张的某个祖先节点上施加 transform: scale()，
 * 此时 getBoundingClientRect() 返回的是缩放后的视觉尺寸，不代表 A4 布局尺寸。
 * 因此这里直接读 offsetWidth / 计算样式 width —— 二者不受祖先 transform 影响，
 * 是纸张真实的布局宽度（应为 A4 @96dpi = 794px）。
 */
const readPaper = (page) =>
  page.evaluate(() => {
    const p = document.querySelector('.resume-paper');
    if (!p) return null;
    const cs = getComputedStyle(p);
    const r = p.getBoundingClientRect();

    // 沿祖先链累乘 scale，仅用于报告「视觉缩放比」，不参与断言
    let scale = 1;
    let el = p.parentElement;
    while (el) {
      const t = getComputedStyle(el).transform;
      const m = t && t.match(/matrix\(([^)]+)\)/);
      if (m) {
        const a = parseFloat(m[1].split(',')[0]);
        if (a > 0 && a !== 1) scale *= a;
      }
      el = el.parentElement;
    }

    return {
      layoutWidth: p.offsetWidth,
      layoutHeight: p.offsetHeight,
      cssWidth: Math.round(parseFloat(cs.width)),
      cssMinHeight: Math.round(parseFloat(cs.minHeight)),
      visualWidth: Math.round(r.width),
      scale: Number(scale.toFixed(4)),
    };
  });

/** 在 antd Form 里按 placeholder 填写 */
const fillByPlaceholder = (page, pattern, value) =>
  page.evaluate((pat, val) => {
    const re = new RegExp(pat);
    const input = [...document.querySelectorAll('input')]
      .find((e) => re.test(e.getAttribute('placeholder') || ''));
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, pattern, value);

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!/favicon|404 \(Not Found\)|React DevTools|ResizeObserver loop/i.test(t)) {
        consoleErrors.push(t);
      }
    }
  });
  page.on('pageerror', (err) => consoleErrors.push(`PAGEERROR: ${err.message}`));

  // ---- 1. 首页 ----
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1500);
  const hero = await page.evaluate(() => document.body.innerText);
  record('首页渲染出内容', hero.length > 100, `${hero.length} 字符`);
  record('首页含核心卖点', /简历/.test(hero) && /模板|AI|导出/.test(hero));
  await shot(page, '01-home');

  // ---- 2. 登录页 → 切注册 ----
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2500);
  const hasForm = await page.$$eval('input', (els) => els.length);
  record('登录页渲染出表单', hasForm >= 2, `${hasForm} 个 input`);

  const switched = await clickByText(page, '免费注册|去注册|注册');
  record('切换到注册模式', switched);
  await sleep(1200);

  const nameOk = await fillByPlaceholder(page, '昵称|用户名|姓名', NAME);
  const emailOk = await fillByPlaceholder(page, '邮箱|邮件|email', EMAIL);
  const passOk = await fillByPlaceholder(page, '密码|password', PASSWORD);
  record('填写注册表单', nameOk && emailOk && passOk,
    `昵称:${nameOk} 邮箱:${emailOk} 密码:${passOk}`);
  await shot(page, '02-register-filled');

  // 提交
  await clickByText(page, '^注册并开始$|注册并开始');
  await sleep(5000);
  const loggedIn = !page.url().includes('/login');
  record('注册成功并进入应用', loggedIn, page.url().replace(BASE, '') || '/');
  await shot(page, '03-dashboard');

  // ---- 3. 工作台 ----
  if (loggedIn) {
    const dash = await page.evaluate(() => document.body.innerText);
    record('工作台渲染', dash.length > 80, `${dash.length} 字符`);

    // ---- 4. 新建简历 → 编辑器 ----
    // 工作台有多个「新建/创建简历」入口，优先点空状态里的主按钮
    const created = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const t = btns.find((b) => /创建简历|新建简历/.test((b.textContent || '').trim()));
      if (t) { t.click(); return true; }
      return false;
    });
    record('点击「新建简历」按钮', created);
    await sleep(2500);
    await shot(page, '04-create-dialog');

    // 弹窗：填名称 → 点「创建并编辑」
    const dialogOk = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')]
        .find((el) => /创建并编辑/.test((el.textContent || '').trim()));
      if (b) { b.click(); return true; }
      return false;
    });
    record('弹窗中点击「创建并编辑」', dialogOk);
    await sleep(6000);

    let paper = await readPaper(page);
    if (!paper) {
      await sleep(5000);
      paper = await readPaper(page);
    }

    record('编辑器渲染 A4 纸张', paper !== null,
      paper ? `布局 ${paper.layoutWidth}x${paper.layoutHeight} / 视觉 ${paper.visualWidth} @${paper.scale}x`
            : `路由 ${page.url().replace(BASE, '')}`);
    await shot(page, '05-editor');

    if (paper) {
      // 纸张在预览区里被等比缩放显示，断言必须用「不受 transform 影响」的布局宽度
      record('纸张布局宽度为 A4 标准 (794px)',
        Math.abs(paper.layoutWidth - 794) <= 2,
        `布局 ${paper.layoutWidth}px / 视觉 ${paper.visualWidth}px @${paper.scale}x`);
      const ui = await page.evaluate(() => {
        const t = document.body.innerText;
        return {
          modules: /基本信息|个人总结|工作经历|专业技能|模块/.test(t),
          styleOrAi: /样式|排版|AI|配色/.test(t),
        };
      });
      record('编辑器左栏有模块列表', ui.modules);
      record('编辑器有样式/AI 面板', ui.styleOrAi);

      // 点击第一个模块，验证内容编辑器出现
      const picked = await clickByText(page, '基本信息|个人总结|专业技能');
      await sleep(1500);
      const editorVisible = await page.evaluate(() =>
        document.querySelectorAll('input, textarea, .ProseMirror').length > 0);
      record('点击模块后出现内容编辑器', picked && editorVisible);
      await shot(page, '05-editor-content');

      // 展开「新增模块」下拉框，验证 popupRender 自定义容器正常渲染
      const ddOpened = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')]
          .find((el) => /新增模块|\+ *添加|添加模块/.test((el.textContent || '').trim()));
        if (!b) return false;
        b.click();
        return true;
      });
      await sleep(1200);
      const ddItems = await page.evaluate(() => {
        const dd = document.querySelector('.ant-dropdown:not(.ant-dropdown-hidden)');
        if (!dd) return { open: false, count: 0 };
        const items = dd.querySelectorAll('.ant-dropdown-menu-item, li[role="menuitem"]');
        const cs = getComputedStyle(dd.querySelector('.ant-dropdown-menu') || dd);
        return { open: true, count: items.length, radius: cs.borderRadius };
      });
      record('「新增模块」下拉框正常展开', ddOpened && ddItems.open && ddItems.count > 0,
        `菜单项 ${ddItems.count} 个`);
      await shot(page, '06-add-dropdown');
      // 收起，避免影响后续
      await page.keyboard.press('Escape');
      await sleep(400);
    }
  }

  // ---- 5. 控制台 ----
  record('控制台无严重错误', consoleErrors.length === 0,
    consoleErrors.length ? consoleErrors.slice(0, 2).join(' | ').slice(0, 180) : '干净');

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${'='.repeat(66)}`);
  console.log(`通过 ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    console.log('失败项：');
    for (const f of failed) console.log(`  - ${f.name}  ${f.detail}`);
  }
  writeFileSync(join(SHOT_DIR, 'result.json'),
    JSON.stringify({ email: EMAIL, results, consoleErrors }, null, 2));
  process.exitCode = failed.length ? 1 : 0;
} catch (err) {
  console.error('测试异常终止:', err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
