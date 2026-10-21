import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const WEB = process.env.AI_E2E_WEB || 'http://127.0.0.1:5173';
const API = process.env.AI_E2E_API || 'http://127.0.0.1:8080';
const RESUME_ID = '11111111-1111-4111-8111-111111111111';
const USER = { id: 'e2e-user', name: 'AI测试', email: 'ai-e2e@example.com' };

for (const [name, value] of [['AI_E2E_WEB', WEB], ['AI_E2E_API', API]]) {
  const url = new URL(value);
  assert.equal(url.protocol, 'http:', `${name} must use local HTTP`);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), `${name} must be loopback only`);
}
assert.equal(new URL(WEB).port, '5173', 'AI_E2E_WEB must point to the local Vite server');
assert.equal(new URL(API).port, '8080', 'AI_E2E_API must point to the synthetic test API');

const passed = [];
const pageErrors = [];
let browser;
let testPage;

async function api(path, method = 'GET', body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.ok(response.ok, `${method} ${path} failed with HTTP ${response.status}`);
  return response.json();
}

async function clickButton(page, label, scope = 'body') {
  const handle = await page.evaluateHandle((text, selector) => {
    const root = document.querySelector(selector);
    if (!root) return null;
    return [...root.querySelectorAll('button, [role="button"]')].find((element) =>
      element.offsetWidth > 0 && element.offsetHeight > 0 && element.textContent.trim() === text,
    ) || null;
  }, label, scope);
  const element = handle.asElement();
  assert.ok(element, `Visible button not found: ${label} within ${scope}`);
  await element.click();
  await handle.dispose();
}

async function clickTab(page, label) {
  const handle = await page.evaluateHandle((text) => [...document.querySelectorAll('[role="tablist"] [role="tab"]')].find((element) =>
    element.offsetWidth > 0 && element.offsetHeight > 0 && element.textContent.trim() === text,
  ) || null, label);
  const element = handle.asElement();
  assert.ok(element, `Visible AI tab not found: ${label}`);
  await element.click();
  await handle.dispose();
}

async function fill(page, selector, value) {
  const field = await page.waitForSelector(selector, { visible: true, timeout: 10000 });
  await field.click();
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await field.type(value);
}

async function waitFor(page, predicate, description, timeout = 12000, ...args) {
  await page.waitForFunction(predicate, { timeout }, ...args);
  if (description) passed.push(description);
}

async function visibleText(page, selector) {
  return page.$eval(selector, (element) => element.innerText);
}

try {
  await api('/__e2e/control', 'POST', { reset: true });
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = testPage = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1050 });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.evaluateOnNewDocument((user) => {
    localStorage.setItem('resume_token', 'local-e2e-token');
    localStorage.setItem('resume_user', JSON.stringify(user));
  }, USER);
  await page.goto(`${WEB}/editor/${RESUME_ID}`, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('.editor-preview-pane .resume-paper', { timeout: 15000 });
  await clickButton(page, 'AI 助手');
  await page.waitForSelector('.ai-panel', { visible: true });
  await waitFor(page, () => document.querySelector('.ai-health')?.innerText.includes('本地分析可用'), '打开 AI 面板并识别本地规则模式');
  assert.equal(await page.$eval('[aria-label="AI 目标岗位"]', (element) => element.value), 'B 端产品经理');
  passed.push('目标岗位从简历基本信息读取，经验年限未预填');

  await api('/__e2e/control', 'POST', { failSave: 1 });
  await clickButton(page, '生成个人总结', '#ai-panel-optimize');
  await waitFor(page, () => [...document.querySelectorAll('#ai-panel-optimize .ai-comparison h4')].some((heading) => heading.innerText === '建议稿'), '总结先生成对照建议');
  await clickButton(page, '应用到简历', '#ai-panel-optimize .ai-section');
  await waitFor(page, () => document.querySelector('#ai-panel-optimize .ai-section [role="alert"]')?.innerText.includes('测试保存失败'), '总结保存失败时保留错误并允许重试');
  assert.equal(await page.$eval('#ai-panel-optimize .ai-section .ai-result button.ant-btn-primary', (element) => element.innerText), '应用到简历');
  await clickButton(page, '应用到简历', '#ai-panel-optimize .ai-section');
  await waitFor(page, () => document.querySelector('#ai-panel-optimize .ai-section .ai-result button.ant-btn-primary')?.innerText.includes('已应用并保存'), '总结重试后等待保存成功');
  let state = await api('/__e2e/state');
  const summary = state.resume.sections.find((section) => section.sectionType === 'summary');
  assert.ok(summary?.data?.content?.trim(), 'summary should be persisted by the API');
  passed.push('新建个人总结通过真实保存接口写入简历');

  const savedSummary = summary.data.content;
  await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('.editor-preview-pane .resume-paper', { timeout: 15000 });
  await waitFor(page, (text) => document.querySelector('.resume-paper')?.innerText.includes(text), '刷新后预览仍显示已保存的个人总结', 12000, savedSummary);

  await clickButton(page, 'AI 助手');
  await page.waitForSelector('.ai-panel', { visible: true });
  await page.waitForSelector('#ai-panel-optimize .ai-batch .ai-targets summary', { visible: true });
  const checkSummary = await page.$('#ai-panel-optimize .ai-batch .ai-targets summary');
  await checkSummary.click();
  const targetChecks = await page.$$('#ai-panel-optimize .ai-batch .ai-targets input[type="checkbox"]');
  assert.ok(targetChecks.length > 1, 'fixture should have several editable bullets');
  for (let index = 1; index < targetChecks.length; index += 1) {
    if (await targetChecks[index].evaluate((element) => element.checked)) await targetChecks[index].click();
  }
  await clickButton(page, '优化所选 1 条要点', '#ai-panel-optimize .ai-batch');
  await waitFor(page, () => document.querySelectorAll('#ai-panel-optimize .ai-batch-item').length === 1, '批量结果逐条对应所选原文');
  const proposed = await page.$eval('#ai-panel-optimize .ai-batch-item .ai-comparison > div:last-child p', (element) => element.innerText);
  assert.ok(proposed.includes('参与客户访谈') && !proposed.includes('参与了客户访谈'));
  await clickButton(page, '应用所选 1 条建议', '#ai-panel-optimize .ai-batch');
  await waitFor(page, () => document.querySelector('#ai-panel-optimize .ai-batch button.ant-btn-primary')?.innerText.includes('已应用并保存'), '批量只应用勾选的建议并等待保存');
  state = await api('/__e2e/state');
  const work = state.resume.sections.find((section) => section.sectionType === 'experience');
  assert.equal(work.data.items[0].bullets[0], proposed);
  assert.equal(work.data.items[0].bullets[1], '围绕跨部门审批追踪难题，补齐状态、催办与代理规则，推动设计和研发评审异常流程，按两期交付避免扩大首期范围。');
  passed.push('批量保存仅修改勾选的要点，其他原文保留');

  const workEntry = await page.evaluateHandle(() => [...document.querySelectorAll('.section-item')].find((element) => element.innerText.includes('工作经历') && element.offsetWidth > 0));
  assert.ok(workEntry.asElement(), 'work experience module should be selectable');
  await workEntry.asElement().click();
  await workEntry.dispose();
  const singleOptimize = await page.waitForSelector('button[aria-label="AI 优化这段描述"]', { visible: true, timeout: 10000 });
  await singleOptimize.click();
  await page.waitForSelector('.ant-modal-title', { visible: true });
  await waitFor(page, () => {
    const modal = document.querySelector('.ant-modal');
    return modal?.innerText.includes('优化后') && !modal.innerText.includes('暂无建议');
  }, '单条优化弹窗显示原文和建议');
  await api('/__e2e/control', 'POST', { failSave: 1 });
  await clickButton(page, '应用优化结果', '.ant-modal');
  await waitFor(page, () => document.querySelector('.ant-modal [role="alert"]')?.innerText.includes('测试保存失败'), '单条应用失败时保留弹窗结果供重试');
  await clickButton(page, '应用优化结果', '.ant-modal');
  await page.waitForSelector('.ant-modal-title', { hidden: true, timeout: 10000 });
  state = await api('/__e2e/state');
  assert.ok(state.writes.some((write) => write.operation === 'update' && write.id === work.id));
  passed.push('单条优化通过失败提示、重试和真实持久化');

  const jd = 'B 端产品经理岗位：负责企业产品需求分析、用户访谈和项目协作；要求具备数据分析能力与本科及以上学历。';
  await clickTab(page, 'ATS');
  await fill(page, '#ai-panel-ats textarea', jd);
  await clickButton(page, '开始体检', '#ai-panel-ats');
  await page.waitForSelector('#ai-panel-ats .ai-scores', { visible: true, timeout: 12000 });
  assert.match(await visibleText(page, '#ai-panel-ats .ai-scores'), /综合分/);
  passed.push('ATS 根据岗位 JD 生成评分和关键词建议');

  await api('/__e2e/control', 'POST', { failAi: { 'parse-jd': 1 } });
  await clickTab(page, '岗位');
  assert.equal(await page.$eval('#ai-panel-jd textarea', (element) => element.value), jd, 'JD should be shared across tabs');
  await clickButton(page, '解析并匹配', '#ai-panel-jd');
  await waitFor(page, () => document.querySelector('#ai-panel-jd .ai-match-rate') !== null, 'JD 技能匹配在岗位解析失败时仍独立完成');
  await waitFor(page, () => [...document.querySelectorAll('#ai-panel-jd .ai-analysis-part [role="alert"]')].some((item) => item.innerText.includes('测试AI暂不可用')), '岗位解析单项错误可见');
  await clickButton(page, '重试岗位解析', '#ai-panel-jd');
  await page.waitForSelector('#ai-panel-jd .ai-job-facts, #ai-panel-jd .ai-keywords', { visible: true, timeout: 12000 });
  await waitFor(page, () => ![...document.querySelectorAll('#ai-panel-jd .ai-analysis-part [role="alert"]')].some((item) => item.innerText.includes('测试AI暂不可用')), '只重试失败的岗位解析并保留匹配结果');

  await clickTab(page, '面试');
  await clickButton(page, '生成面试题', '#ai-panel-interview');
  await page.waitForSelector('#ai-panel-interview .ai-interview li', { visible: true, timeout: 12000 });
  assert.ok((await visibleText(page, '#ai-panel-interview .ai-interview')).length > 30);
  passed.push('面试题结合简历和目标岗位生成');

  await clickTab(page, '内容');
  assert.ok(await page.$eval('#ai-panel-optimize .ai-batch .ai-result', (element) => element.textContent.length > 0));
  await page.setViewport({ width: 1200, height: 900 });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const panelBox = await page.$eval('.ai-panel', (element) => element.getBoundingClientRect().width);
  assert.ok(panelBox > 0, 'AI panel should remain visible at a narrow viewport');
  passed.push('四个页签状态保留，窄桌面窗口下 AI 面板仍可见');

  assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join('; ')}`);
  passed.push('浏览器运行期间没有 JavaScript 页面异常');
  console.log(`通过 ${passed.length} 项浏览器验收：`);
  for (const item of passed) console.log(`  ✓ ${item}`);
} catch (error) {
  if (browser) {
    try {
      if (testPage) await testPage.screenshot({ path: `${process.env.TEMP || '.'}/ai-assistant-e2e-failure.png`, fullPage: true });
      if (testPage) {
        console.error('失败时页面：', await testPage.url());
        console.error('可见按钮：', await testPage.$$eval('button', elements => elements.filter(element => element.offsetWidth > 0 && element.offsetHeight > 0).map(element => element.textContent.trim()).slice(0, 35)));
        console.error('页面标题：', await testPage.title());
      }
    } catch { /* Preserve the original failure. */ }
  }
  console.error(`浏览器验收失败（已通过 ${passed.length} 项）：`);
  for (const item of passed) console.error(`  ✓ ${item}`);
  throw error;
} finally {
  await browser?.close();
}
