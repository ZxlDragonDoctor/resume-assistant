/** Real Chromium regression checks for the preview and production PDF reflow. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { renderResumeHtml, paginateSectionsByHeight } = require('../src/renderer.js');
const puppeteer = require('puppeteer');
const frontendRequire = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { build } = frontendRequire('esbuild');

// Load the actual production helper without starting HTTP/RabbitMQ/MinIO.
const indexSource = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
const reflowSource = indexSource.slice(indexSource.indexOf('async function reflowResumePages(page)'), indexSource.indexOf('async function generatePdf(html)'));
assert.ok(reflowSource.startsWith('async function reflowResumePages(page)'));
const reflowResumePages = new Function('paginateSectionsByHeight', `${reflowSource}; return reflowResumePages;`)(paginateSectionsByHeight);

const { outputFiles } = await build({
  stdin: {
    contents: `import React from 'react'; import { createRoot } from 'react-dom/client';
      import Preview from './src/components/viewer/ResumePreviewEngine';
      const root = createRoot(document.getElementById('root'));
      window.showResume = (resume, scale = 1) => root.render(React.createElement(Preview, { resume, scale }));`,
    resolveDir: fileURLToPath(new URL('../../frontend/', import.meta.url)),
    loader: 'tsx',
  },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
});

function fixture(mode, mainCount = 6, sideCount = 4) {
  const body = (column, count) => Array.from({ length: count }, (_, index) => ({
    id: `${column}-${index}`, sectionType: 'custom', sortOrder: index * 2 + (column === 'main' ? 1 : 2),
    isVisible: true, layout: mode === 'sidebar' ? column === 'main' ? 'right' : 'left' : 'auto',
    data: { content: `<p style="height:280px;margin:0">MARKER_${column}_${index}</p>`, _config: { moduleName: `自定义标题_${column}_${index}` } },
  }));
  return {
    id: `pagination-${mode}`, title: '分页验证', targetJob: '工程师',
    layoutConfig: JSON.stringify({ layout: mode, pageTopMargin: 44, pageBottomMargin: 44, pageLeftMargin: 52, pageRightMargin: 52, globalFontSize: 13, globalLineSpacing: 1.5, moduleMargin: 16 }),
    sections: [
      { id: 'basic', sectionType: 'basic', sortOrder: 0, isVisible: true, data: { name: '分页示例', jobTitle: '工程师', email: 'pagination@example.com' } },
      ...body('main', mainCount), ...body('side', sideCount),
    ].sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

async function inspect(page, paperSelector, sectionSelector, scale = 1) {
  return page.evaluate(({ paperSelector, sectionSelector, scale }) => {
    const papers = [...document.querySelectorAll(paperSelector)];
    return papers.map((paper) => {
      const rect = paper.getBoundingClientRect();
      const style = getComputedStyle(paper);
      const sections = [...paper.querySelectorAll(sectionSelector)];
      return {
        height: rect.height / scale,
        ids: sections.map((section) => section.dataset.sectionId),
        text: paper.innerText,
        overflow: sections.some((section) => section.getBoundingClientRect().bottom > rect.bottom - parseFloat(style.paddingBottom) * scale + 1),
        mainWidth: paper.querySelector('[data-resume-column="main"], .col-main')?.getBoundingClientRect().width / scale,
      };
    });
  }, { paperSelector, sectionSelector, scale });
}

function verifyPages(pages, resume, label) {
  assert.ok(pages.length > 1, `${label}: content must continue on another A4 page`);
  assert.ok(pages.every((page) => page.ids.length > 0), `${label}: no empty leading or trailing page`);
  assert.ok(pages.every((page) => page.height <= 1123.6 && !page.overflow), `${label}: sections fit inside A4 content bounds`);
  const ids = pages.flatMap((page) => page.ids);
  assert.deepEqual([...ids].sort(), resume.sections.filter((section) => section.sectionType !== 'basic').map((section) => section.id).sort(), `${label}: each section appears exactly once`);
  for (const section of resume.sections.filter((section) => section.sectionType !== 'basic')) {
    assert.equal(pages.map((page) => page.text).join('\n').split(`MARKER_${section.id.replace('-', '_')}`).length, 2, `${label}: complete module text`);
    assert.equal(pages.map((page) => page.text).join('\n').split(`自定义标题_${section.id.replace('-', '_')}`).length, 2, `${label}: custom title remains attached`);
  }
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
try {
  const previewPage = await browser.newPage();
  const exportPage = await browser.newPage();
  previewPage.on('pageerror', (error) => console.error('Preview error:', error.message));
  await previewPage.setContent('<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0}</style></head><body><div id="root"></div></body></html>');
  await previewPage.addScriptTag({ content: outputFiles[0].text });
  for (const mode of ['single-column', 'sidebar', 'two-column']) {
    console.log(`CHECK ${mode}: export layout`);
    const resume = fixture(mode);
    await exportPage.bringToFront();
    await exportPage.setContent(renderResumeHtml(resume), { waitUntil: 'load' });
    await exportPage.evaluate(() => document.fonts.ready);
    await reflowResumePages(exportPage);
    const exported = await inspect(exportPage, '.page', '.resume-section[data-section-id]');
    verifyPages(exported, resume, `${mode} PDF`);
    const pdf = await exportPage.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true });
    assert.equal((Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, exported.length, `${mode}: physical PDF page count`);

    console.log(`CHECK ${mode}: preview layout`);
    await previewPage.bringToFront();
    await previewPage.evaluate((resume) => window.showResume(resume, 0.5), resume);
    await previewPage.waitForFunction((expected) => document.querySelectorAll('.resume-paper [data-section-id]').length === expected, {}, resume.sections.length - 1);
    // React's layout effect applies measured placements synchronously; two frames
    // also allow the browser to finish layout after switching between templates.
    await previewPage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const previewed = await inspect(previewPage, '.resume-paper', '[data-section-id]', 0.5);
    verifyPages(previewed, resume, `${mode} preview`);
    assert.equal(previewed.length, exported.length, `${mode}: preview and export agree on page count`);
    if (mode === 'sidebar') {
      assert.ok(previewed.every((page) => Math.abs(page.mainWidth - previewed[0].mainWidth) < 1), 'sidebar keeps its main column width on continuation pages');
      const columns = await previewPage.evaluate(() => [...document.querySelectorAll('[data-resume-column]')].map((column) => ({ column: column.dataset.resumeColumn, ids: [...column.querySelectorAll('[data-section-id]')].map((section) => section.dataset.sectionId) })));
      assert.ok(columns.every(({ column, ids }) => ids.every((id) => id.startsWith(`${column}-`))), 'sidebar preserves explicit left/right placement');
    }
    console.log(`PASS  ${mode}: ${previewed.length} preview/PDF pages; complete content, no overflow or empty pages`);
  }
  for (const height of [101, 160]) {
    const pages = paginateSectionsByHeight([{ id: 'oversized', height }], { mode: 'single-column', firstPageCapacity: 80, columnCapacity: 100 });
    assert.equal(pages.length, 1, 'oversized module must terminate without blank leading pages');
    assert.equal(pages[0].main[0].id, 'oversized');
  }
  console.log('PASS  oversized modules terminate and retain their full content');
} finally {
  await browser.close();
}
