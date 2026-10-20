#!/usr/bin/env node
/** Browser regression check against a running frontend, with the reviewed catalog as API fixtures. */
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'export-service/package.json'));
const puppeteer = require('puppeteer');
const base = process.argv[2] || 'http://127.0.0.1:5179';
const output = process.argv[3] || path.join(os.tmpdir(), 'resume-template-ui-check');
await mkdir(output, { recursive: true });
const catalog = await Promise.all((await readdir(path.join(root, 'templates/catalog'))).filter((name) => name.endsWith('.json')).map(async (name) => JSON.parse(await readFile(path.join(root, 'templates/catalog', name), 'utf8'))));
catalog.sort((a, b) => a.sortOrder - b.sortOrder);
assert.equal(catalog.length, 24);
const fixtures = catalog.map((record, index) => ({
  id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  name: record.name, description: record.description, category: record.category, tags: record.tags,
  config: JSON.stringify(record.config), previewConfig: JSON.stringify(record.sample),
  isActive: true, isPremium: false, sortOrder: record.sortOrder,
}));
const custom = { ...fixtures[0], id: '10000000-0000-4000-8000-000000000099', name: '自定义保留示例', category: 'custom', previewConfig: '{}', sortOrder: 100 };
const labels = { general: '通用求职', graduate: '应届校招', technical: '技术研发', product: '产品运营', design: '设计创意', business: '商务职能', academic: '学术教育', medical: '医疗健康', custom: '自定义模板' };
const normalize = (text) => String(text).replace(/<[^>]+>/g, '').replace(/[\s*_`#>]/g, '');
const browser = await puppeteer.launch({ headless: true });
let posts = 0;
const errors = [];
const results = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1050 });
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    const url = new URL(request.url());
    if (request.method() === 'POST') posts++;
    if (url.pathname === '/api/templates') return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, data: [...fixtures, custom] }) });
    if (url.pathname === '/api/templates/categories') return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, data: Object.entries(labels).map(([key, label]) => ({ key, label, count: [...fixtures, custom].filter((template) => template.category === key).length })) }) });
    return request.continue();
  });
  await page.goto(`${base}/templates`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="template-card"]').length === 25);
  await page.screenshot({ path: path.join(output, 'library-desktop.png') });
  const capturedLayouts = new Set();
  for (const [index, record] of catalog.entries()) {
    const fixture = fixtures[index];
    await page.click(`[data-template-id="${fixture.id}"] .template-sample-cover`);
    await page.waitForSelector('[data-testid="template-sample-preview"] .resume-paper');
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const metrics = await page.evaluate(() => {
      const doc = document.querySelector('[data-testid="template-sample-preview"] .resume-document');
      const papers = [...doc.querySelectorAll('.resume-paper')];
      return {
        text: doc.innerText,
        sections: [...doc.querySelectorAll('[data-section-id]')].map((node) => node.dataset.sectionId),
        pages: papers.map((paper) => {
          const bounds = paper.getBoundingClientRect();
          const scale = bounds.width / paper.offsetWidth;
          const sections = [...paper.querySelectorAll('[data-section-id]')];
          return { height: paper.offsetHeight, count: sections.length, contentBottom: Math.max(0, ...sections.map((node) => (node.getBoundingClientRect().bottom - bounds.top) / scale)), bottomPadding: parseFloat(getComputedStyle(paper).paddingBottom) };
        }),
      };
    });
    assert.equal(metrics.sections.length, record.sample.sections.length - 1, `${record.key}: body module count`);
    assert.equal(new Set(metrics.sections).size, metrics.sections.length, `${record.key}: duplicate modules`);
    for (const section of record.sample.sections) {
      for (const item of section.data.items || []) {
        if (item && typeof item === 'object' && item.bullets?.length) {
          assert.ok(normalize(metrics.text).includes(normalize(item.bullets.at(-1))), `${record.key}: missing last bullet`);
        }
      }
    }
    for (const paper of metrics.pages) {
      assert.ok(paper.count > 0, `${record.key}: empty page`);
      assert.ok(paper.height <= 1124, `${record.key}: overflowing A4 page (${paper.height}px)`);
      assert.ok(paper.contentBottom <= 1123 - paper.bottomPadding + 3, `${record.key}: content outside page margins`);
    }
    if (!capturedLayouts.has(record.config.layout)) {
      capturedLayouts.add(record.config.layout);
      await page.screenshot({ path: path.join(output, `preview-${record.config.layout}.png`) });
    }
    results.push({ key: record.key, layout: record.config.layout, pages: metrics.pages.length });
    await page.waitForFunction(() => !document.querySelector('.ant-modal.ant-zoom-appear'));
    await page.click('.ant-modal-close');
    await page.waitForSelector('[data-testid="template-sample-preview"]', { hidden: true });
  }
  const search = await page.$('input[placeholder="搜索岗位、阶段或内容亮点"]');
  await search.type('教师');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="template-card"]').length < 25);
  assert.ok(await page.$(`[data-template-id="${fixtures[catalog.findIndex((record) => record.key === 'teacher')].id}"]`), 'role search must find teacher');
  await search.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.click(`[data-template-id="${custom.id}"] .template-sample-cover`);
  await page.waitForSelector('[data-testid="template-sample-preview"]');
  assert.equal(await page.$('[data-testid="template-sample-preview"] .resume-paper'), null, 'legacy custom template must not pretend to have a sample');
  await page.waitForFunction(() => !document.querySelector('.ant-modal.ant-zoom-appear'));
  await page.click('.ant-modal-close');
  await page.waitForSelector('[data-testid="template-sample-preview"]', { hidden: true });
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${base}/templates`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="template-card"]');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile library horizontal overflow');
  await page.click(`[data-template-id="${fixtures[0].id}"] .template-sample-cover`);
  await page.waitForSelector('[data-testid="template-sample-preview"] .resume-paper');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile modal horizontal overflow');
  await page.screenshot({ path: path.join(output, 'preview-mobile.png') });
  await page.waitForFunction(() => !document.querySelector('.ant-modal.ant-zoom-appear'));
  await page.click('.ant-modal-close');
  await page.click(`[data-template-id="${fixtures[0].id}"] .template-sample-card-controls button:last-child`);
  await page.waitForFunction(() => location.pathname === '/login');
  assert.equal(posts, 0, 'anonymous preview/use must not persist data');
  assert.deepEqual(errors, [], 'browser runtime errors');
  assert.ok(results.some((result) => result.pages > 1), 'multi-page sample coverage required');
  console.log(JSON.stringify({ checked: results.length, posts, errors, results, screenshots: output }, null, 2));
} finally {
  await browser.close();
}
