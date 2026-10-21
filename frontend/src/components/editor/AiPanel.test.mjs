import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
async function load(entry, stdin) {
  const { outputFiles } = await build({
    ...(stdin ? { stdin: { contents: stdin, resolveDir: fileURLToPath(new URL('.', import.meta.url)), loader: 'tsx' } }
      : { entryPoints: [fileURLToPath(new URL(entry, import.meta.url))] }),
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'offline-ai', setup(b) {
      b.onResolve({ filter: /services\/api$/ }, () => ({ path: 'api', namespace: 'offline' }));
      b.onResolve({ filter: /utils\/antdStatic$/ }, () => ({ path: 'messages', namespace: 'offline' }));
      b.onLoad({ filter: /.*/, namespace: 'offline' }, ({ path }) => ({ contents:
        path === 'api' ? 'export const aiApi = {};' : 'export const message = {success(){},error(){},warning(){}};' }));
      b.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }));
    } }],
  });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', outputFiles[0].text)(require, mod, mod.exports);
  return mod.exports;
}

const panel = await load(null, `
  import React from 'react';
  import { renderToStaticMarkup } from 'react-dom/server';
  import AiPanel from './AiPanel';
  export function render(resume) {
    return renderToStaticMarkup(<AiPanel resume={resume} onApplySummary={async()=>{}} onApplyBullets={async()=>{}} />);
  }
`);
const resume = { id: 'r1', sections: [
  { id: 'b', sectionType: 'basic', isVisible: true, sortOrder: 0, data: { name: '测试', jobTitle: '设计师' } },
  { id: 'w', sectionType: 'work', isVisible: true, sortOrder: 1, data: { items: [{ company: '测试公司', bullets: ['参与设计交付，完成三个页面。'] }] } },
] };

test('content panel exposes a batch optimization selector and action', () => {
  const html = panel.render(resume);
  assert.ok(html.includes('批量优化'));
  assert.ok(html.includes('aria-label="选择要点模块"'));
});

test('all four labelled panels stay mounted so changing tabs preserves results', () => {
  const html = panel.render(resume);
  assert.equal((html.match(/role="tabpanel"/g) || []).length, 4);
  assert.ok(html.includes('aria-label="目标岗位 JD"'));
  assert.ok(html.includes('maxLength="20000"') || html.includes('maxlength="20000"'));
  assert.ok(!html.includes('maxlength="30000"'));
});

test('summary inputs use the actual role without inventing a default experience year', () => {
  const html = panel.render(resume);
  assert.ok(html.includes('value="设计师"'));
  assert.ok(!html.includes('aria-valuenow="1"'));
});

let state = {};
try { await readFile(new URL('./aiPanelState.ts', import.meta.url)); state = await load('./aiPanelState.ts'); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

test('a new request aborts and invalidates the old request', () => {
  assert.equal(typeof state.createRequestScope, 'function', 'request scope is not implemented');
  const scope = state.createRequestScope();
  const first = scope.start();
  const second = scope.start();
  assert.equal(first.signal.aborted, true);
  assert.equal(first.isCurrent(), false);
  assert.equal(second.isCurrent(), true);
  scope.cancel();
  assert.equal(second.isCurrent(), false);
});

test('summary information only contains experience years explicitly entered by the user', () => {
  assert.equal(typeof state.summaryInput, 'function', 'summary input is not implemented');
  assert.equal(state.summaryInput('设计师', undefined, '作品'), '目标岗位：设计师\n\n现有简历内容：\n作品');
  assert.match(state.summaryInput('设计师', 0, '作品'), /0 年相关经验/);
});

test('batch suggestions must correspond to exact original targets before becoming changes', () => {
  assert.equal(typeof state.batchChanges, 'function', 'batch result matching is not implemented');
  const targets = [{ id: 'w:0:0', sectionId: 'w', itemIndex: 0, bulletIndex: 0, before: '原文', label: '经历' }];
  const response = { items: [{ id: 'w:0:0', before: '原文', after: '建议', engine: 'rule' }], engine: 'rule' };
  assert.deepEqual(state.batchChanges(targets, response), [{ ...targets[0], after: '建议' }]);
  assert.throws(() => state.batchChanges(targets, { ...response, items: [{ ...response.items[0], before: '被替换' }] }));
  assert.throws(() => state.batchChanges(targets, { ...response, items: [response.items[0], response.items[0]] }));
});

test('batch API sends the structured identity protocol and every AI call supports cancellation with a bounded timeout', async () => {
  const { aiApi, default: http } = await load('../../services/api.ts');
  globalThis.localStorage = { getItem() { return null; } };
  const seen = [];
  http.defaults.adapter = async (config) => {
    seen.push(config);
    return { data: { code: 200, message: 'success', data: { result: '测试', engine: 'rule' } }, status: 200, statusText: 'OK', headers: {}, config };
  };
  const controller = new AbortController();
  const signal = controller.signal;
  await aiApi.optimizeBullets([{ id: 'work:0:0', content: '原文' }], '设计师', signal);
  assert.deepEqual(JSON.parse(seen[0].data), { bullets: [{ id: 'work:0:0', content: '原文' }], job_title: '设计师' });
  await aiApi.health(signal);
  await aiApi.optimizeBullet('原文', '设计师', signal);
  await aiApi.generateSummary('原文', signal);
  await aiApi.atsScore('岗位要求', '经历', signal);
  await aiApi.parseJd('岗位要求', signal);
  await aiApi.matchSkills('经历', '岗位要求', signal);
  await aiApi.interviewQuestions('设计师', '经历', signal);
  assert.equal(seen.length, 8);
  for (const config of seen) {
    assert.equal(config.signal, signal);
    assert.equal(config.timeout, 60000);
  }
});
