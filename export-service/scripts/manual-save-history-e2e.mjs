import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const WEB = process.env.AI_E2E_WEB || 'http://127.0.0.1:5173';
const API = process.env.AI_E2E_API || 'http://127.0.0.1:8080';
const ID = '11111111-1111-4111-8111-111111111111';
for (const value of [WEB, API]) {
  const url = new URL(value);
  assert.equal(url.protocol, 'http:');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Only synthetic loopback services are allowed');
}
assert.equal(new URL(WEB).port, '5173');
assert.equal(new URL(API).port, '8080');
const OUTPUT = fileURLToPath(new URL('../../tmp/manual-save-history-e2e/', import.meta.url));
await mkdir(OUTPUT, { recursive: true });
const passed = [], errors = [], writes = [];
const report = passed.push.bind(passed);
passed.push = (...items) => { for (const item of items) console.log(`PASS: ${item}`); return report(...items); };
let browser, page;
async function api(route, body) {
  const response = await fetch(`${API}${route}`, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  assert.ok(response.ok, `${route}: ${response.status}`);
  return response.json();
}
async function button(label, scope = 'body') {
  if (scope.includes('.ant-modal')) {
    await page.waitForSelector(scope, { visible: true });
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  const handle = await page.evaluateHandle((text, selector) => [...(document.querySelector(selector)?.querySelectorAll('button') || [])].find(e => e.offsetWidth && e.offsetHeight && e.textContent.trim() === text) || null, label, scope);
  assert.ok(handle.asElement(), `Visible button missing: ${label} (${scope})`);
  await handle.asElement().click();
  await handle.dispose();
}
async function fill(selector, value) {
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector);
  await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
  await page.keyboard.sendCharacter(value);
}
async function fieldValue(value) { await page.waitForFunction(text => document.querySelector('input[placeholder="张三"]')?.value === text, { timeout: 10000 }, value); }
async function clean() { await page.waitForFunction(() => { const button = document.querySelector('[aria-label="保存简历"]'); return button?.disabled === true && button.textContent.trim() === '保存'; }); }
async function dirty() { await page.waitForFunction(() => document.querySelector('[aria-label="保存简历"]')?.disabled === false); }
async function editor() {
  await page.goto(`${WEB}/editor/${ID}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.editor-preview-pane .resume-paper');
  await page.waitForSelector('input[placeholder="张三"]');
}
const saveCount = async () => (await api('/__e2e/state')).writes.filter(w => w.operation === 'saveContent').length;
async function waitSaveCount(count) {
  const limit = Date.now() + 10000;
  while (await saveCount() !== count) { assert.ok(Date.now() < limit, `Expected ${count} successful saves`); await new Promise(r => setTimeout(r, 80)); }
}
async function screenshot(name) { const filename = path.join(OUTPUT, name); await page.screenshot({ path: filename, fullPage: true, timeout: 10000 }); console.log(`Screenshot: ${filename}`); }
try {
  await api('/__e2e/control', { reset: true });
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  page = await browser.newPage(); await page.setViewport({ width: 1600, height: 1080 });
  page.setDefaultTimeout(12000);
  page.on('dialog', async dialog => { console.log(`Browser dialog: ${dialog.type()}`); await dialog.accept(); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', req => { if (req.url().includes('/api/') && !['GET', 'OPTIONS', 'HEAD'].includes(req.method())) writes.push({ method: req.method(), url: req.url() }); });
  await page.evaluateOnNewDocument(() => { localStorage.setItem('resume_token', 'local-e2e-token'); localStorage.setItem('resume_user', JSON.stringify({ id: 'e2e-user', name: 'AI测试', email: 'ai-e2e@example.com' })); });
  await editor();
  const original = await page.$eval('input[placeholder="张三"]', el => el.value);
  await fill('input[placeholder="张三"]', '仅在草稿候选人'); await dirty();
  await page.click('[aria-label="撤销"]'); await fieldValue(original); await clean();
  await page.click('[aria-label="重做"]'); await fieldValue('仅在草稿候选人'); await dirty();
  await button('放弃修改'); await button('放弃修改', '.ant-modal-confirm'); await fieldValue(original); await clean();
  await new Promise(r => setTimeout(r, 900));
  assert.equal(writes.length, 0); assert.equal(await saveCount(), 0);
  passed.push('内容编辑、撤销、重做、放弃草稿均无网络写入');

  await fill('input[placeholder="张三"]', '已保存候选人'); await dirty(); await page.click('[aria-label="保存简历"]'); await clean(); await waitSaveCount(1);
  assert.equal((await api('/__e2e/state')).resume.sections[0].data.name, '已保存候选人');
  assert.equal(writes.length, 1); assert.equal(writes[0].method, 'PUT'); assert.ok(writes[0].url.endsWith('/content'));
  await page.reload({ waitUntil: 'networkidle0' }); await fieldValue('已保存候选人');
  passed.push('显式保存只提交一次完整简历，刷新后内容保留');

  await api('/__e2e/control', { failSave: 1 });
  await fill('input[placeholder="张三"]', '失败后保留草稿'); await page.click('[aria-label="保存简历"]');
  await page.waitForFunction(() => document.body.innerText.includes('测试保存失败')); await dirty();
  await fieldValue('失败后保留草稿'); assert.equal(await saveCount(), 1);
  assert.equal((await api('/__e2e/state')).resume.sections[0].data.name, '已保存候选人');
  await screenshot('save-failure-draft.png');
  await page.click('[aria-label="保存简历"]'); await clean(); await waitSaveCount(2);
  passed.push('保存失败保留可重试草稿，重试后成功保存');

  await button('AI功能闭环测试'); await fill('input[style*="width: 220px"]', '快捷键保存标题');
  await page.keyboard.down('Control'); await page.keyboard.press('s'); await page.keyboard.up('Control');
  await clean(); await waitSaveCount(3);
  assert.equal((await api('/__e2e/state')).resume.title, '快捷键保存标题');
  await page.keyboard.press('Enter');
  passed.push('标题输入框内 Ctrl+S 保存最新标题');

  await fill('input[placeholder="张三"]', '离开前草稿'); await dirty(); const beforeRoute = writes.length;
  await page.click('button:has(.anticon-arrow-left)');
  await page.waitForFunction(() => [...document.querySelectorAll('.ant-modal-title')].some(e => e.textContent === '有未保存的修改'));
  await button('继续编辑', '.ant-modal'); await page.waitForSelector('.ant-modal', { hidden: true }); await fieldValue('离开前草稿'); assert.ok(page.url().includes('/editor/'));
  await page.click('button:has(.anticon-arrow-left)');
  await page.waitForSelector('.ant-modal', { visible: true }); await button('放弃修改并离开', '.ant-modal');
  await page.waitForFunction(() => location.pathname === '/dashboard'); assert.equal(writes.length, beforeRoute);
  assert.equal((await api('/__e2e/state')).resume.sections[0].data.name, '失败后保留草稿');
  passed.push('路由保护可继续编辑或放弃草稿离开，两者都不保存');

  await editor(); await button('版本'); await page.waitForSelector('.version-log__select');
  const beforeHistory = writes.length;
  await page.click('.version-log__select[aria-label="查看版本 1：最初定稿"]');
  await page.waitForFunction(() => document.querySelector('.version-inspector__preview')?.innerText.includes('历史末页完整内容标记'), { timeout: 15000 });
  const pages = await page.$$eval('.version-inspector__preview .resume-paper', els => els.length);
  assert.ok(pages > 1, `Historical snapshot should paginate, got ${pages} pages`);
  assert.ok(await page.$eval('.version-inspector__preview', el => el.innerText.includes('历史候选人')));
  assert.ok(await page.$eval('.version-inspector__metadata', el => el.innerText.includes('最初定稿')));
  assert.equal(writes.length, beforeHistory);
  await screenshot('history-full-preview.png');
  await page.$eval('.version-inspector__preview .thin-scroll', element => { element.scrollTop = element.scrollHeight; });
  await screenshot('history-last-page-preview.png');
  await page.setViewport({ width: 680, height: 900 });
  await page.waitForFunction(() => document.querySelector('.version-inspector__layout')?.getBoundingClientRect().width < 680);
  await screenshot('history-responsive-preview.png');
  await page.setViewport({ width: 1600, height: 1080 });
  passed.push(`历史只读预览展示全部 ${pages} 页和末页内容，窄屏可浏览且无写入`);

  await button('恢复到编辑区', '.version-inspector__footer'); await button('恢复到编辑区', '.ant-modal-confirm');
  await page.waitForSelector('.version-inspector', { hidden: true }); await dirty();
  await page.waitForFunction(() => document.querySelector('.editor-preview-pane')?.innerText.includes('历史末页完整内容标记'));
  assert.equal(writes.length, beforeHistory);
  assert.equal((await api('/__e2e/state')).resume.sections[0].data.name, '失败后保留草稿');
  await screenshot('history-restored-unsaved.png');
  passed.push('历史恢复只装载编辑草稿，保留未保存状态且无网络写入');
  await page.click('[aria-label="保存简历"]'); await clean(); await waitSaveCount(4);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('.editor-preview-pane')?.innerText.includes('历史末页完整内容标记'));
  assert.equal((await api('/__e2e/state')).resume.sections[0].data.name, '历史候选人');
  passed.push('恢复后的草稿可显式保存，刷新后完整历史内容保留');

  // Hold a real save request before it reaches the synthetic API. Undo makes
  // the local draft clean, but navigation must still block while the save runs.
  let heldRequest;
  await page.setRequestInterception(true);
  const intercept = request => {
    if (request.method() === 'PUT' && request.url().endsWith('/content') && !heldRequest) heldRequest = request;
    else void request.continue();
  };
  page.on('request', intercept);
  await fill('input[placeholder="张三"]', '保存中候选人'); await dirty();
  await page.click('[aria-label="保存简历"]');
  const holdLimit = Date.now() + 10000;
  while (!heldRequest) { assert.ok(Date.now() < holdLimit, 'Save request should be intercepted'); await new Promise(resolve => setTimeout(resolve, 40)); }
  await page.click('[aria-label="撤销"]'); await fieldValue('历史候选人');
  await page.click('button:has(.anticon-arrow-left)'); await page.waitForSelector('.ant-modal', { visible: true });
  await page.waitForFunction(() => document.querySelector('.ant-modal')?.innerText.includes('正在保存'));
  assert.equal(await page.$eval('.ant-modal', modal => [...modal.querySelectorAll('button')].find(button => button.textContent.trim() === '放弃修改并离开')?.disabled), true);
  await screenshot('inflight-save-route-protection.png');
  await button('继续编辑', '.ant-modal'); await page.waitForSelector('.ant-modal', { hidden: true });
  await heldRequest.continue(); await waitSaveCount(5);
  await page.waitForFunction(() => document.querySelector('[aria-label="保存简历"]')?.textContent.trim() === '保存');
  await fieldValue('历史候选人'); await dirty();
  page.off('request', intercept); await page.setRequestInterception(false);
  passed.push('保存进行中撤销为干净草稿后仍拦截导航，禁用放弃离开，响应保留新草稿');

  assert.deepEqual(errors, []); passed.push('浏览器无 JavaScript 页面异常');
  console.log(`通过 ${passed.length} 项手动保存与版本历史浏览器验收：`);
  for (const item of passed) console.log(`  ✓ ${item}`);
} catch (error) {
  await screenshot('failure.png').catch(() => {});
  console.error('URL:', page?.url());
  if (page) console.error('Buttons:', await page.$$eval('button', els => els.filter(e => e.offsetWidth && e.offsetHeight).map(e => e.textContent.trim()).slice(0, 35)));
  console.error('Page errors:', errors); console.error('Passed:', passed); throw error;
} finally {
  // The last scenario intentionally leaves an unsaved draft. Close without
  // beforeunload so headless teardown does not wait for a browser dialog.
  await page?.close({ runBeforeUnload: false }).catch(() => {});
  await browser?.close();
}
