import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

let summarizeVersionChanges;
try {
  const { outputFiles } = await build({ entryPoints: [fileURLToPath(new URL('./versionHistory.ts', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', write: false });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', outputFiles[0].text)(createRequire(import.meta.url), mod, mod.exports);
  summarizeVersionChanges = mod.exports.summarizeVersionChanges;
} catch (error) {
  if (!error.message.includes('Could not resolve')) throw error;
}
const section = (id, data, extra = {}) => ({ id, sectionType: 'work', sortOrder: 0, isVisible: true, data, ...extra });
const resume = (sections, extra = {}) => ({ title: '简历', templateId: 't1', fontFamily: 'serif', fontSize: 14, lineSpacing: 1.6, themeColor: '#123456', layoutConfig: '{}', sections, ...extra });

test('history comparison ignores regenerated identities and object key order', () => {
  assert.equal(typeof summarizeVersionChanges, 'function');
  assert.deepEqual(summarizeVersionChanges(resume([section('old', { a: 1, b: 2 })]), resume([section('new', { b: 2, a: 1 })])), []);
});
test('history comparison includes hidden modules, repeated module types and formatting', () => {
  const before = resume([section('1', { content: '第一段' }), section('2', { content: '第二段' }, { sortOrder: 1, isVisible: false })]);
  const current = resume([section('1', { content: '第一段' }), section('2', { content: '新内容' }, { sortOrder: 1, isVisible: false })], { fontSize: 16 });
  const changes = summarizeVersionChanges(before, current);
  assert.ok(changes.some(x => x.includes('工作经历')));
  assert.ok(changes.some(x => x.includes('字体与排版')));
});
test('history comparison identifies added and removed modules and section order', () => {
  const before = resume([section('1', {}), section('2', {}, { sectionType: 'skills', sortOrder: 1 })]);
  const current = resume([section('3', {}, { sectionType: 'education' }), section('1', {}, { sortOrder: 1 })]);
  const changes = summarizeVersionChanges(before, current);
  assert.ok(changes.some(x => x.includes('当前草稿新增') && x.includes('教育')));
  assert.ok(changes.some(x => x.includes('当前草稿移除') && x.includes('技能')));
  assert.ok(changes.some(x => x.includes('模块顺序')));
});
test('history comparison normalizes legacy JSON section data', () => {
  assert.deepEqual(summarizeVersionChanges(resume([section('1', '{"content":"正文"}')]), resume([section('1', { content: '正文' })])), []);
});
