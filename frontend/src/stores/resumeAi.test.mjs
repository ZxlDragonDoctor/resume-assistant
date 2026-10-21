import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

globalThis.__resumeApiMock = {};
const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL('./resumeStore.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'api-fixture', setup(builder) {
    builder.onResolve({ filter: /services\/api$/ }, () => ({ path: 'mock-api', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const resumeApi = globalThis.__resumeApiMock;' }));
  } }],
});
const { useResumeStore: store } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const sec = (id, content = '旧内容') => ({ id, sectionType: 'summary', sortOrder: 0, isVisible: true, data: { content, _config: { moduleName: '个人概述' } } });
const setup = () => {
  store.setState({ current: { id: 'a', sections: [sec('summary')] }, dirty: false, saving: false, lastSavedAt: null });
  globalThis.__resumeApiMock.detail = async () => { throw new Error('must not reload all resume content'); };
  globalThis.__resumeApiMock.updateSection = async () => {};
};

test('new section merges without discarding an unsaved draft in another module', async () => {
  setup();
  store.getState().updateSectionData('summary', { content: '尚未落库的本地草稿' });
  globalThis.__resumeApiMock.addSection = async () => sec('new-section', '');
  await store.getState().addSection('custom');
  assert.equal(store.getState().current.sections[0].data.content, '尚未落库的本地草稿');
  assert.equal(store.getState().current.sections.length, 2);
  assert.equal(store.getState().dirty, true);
});
test('a late section creation does not overwrite a newly opened resume', async () => {
  setup();
  let resolve;
  globalThis.__resumeApiMock.addSection = () => new Promise(r => { resolve = r; });
  const pending = store.getState().addSection('custom');
  store.setState({ current: { id: 'b', sections: [] } });
  resolve(sec('new-section', ''));
  await pending;
  assert.equal(store.getState().current.id, 'b');
  assert.equal(store.getState().current.sections.length, 0);
});
test('AI save waits for persistence and marks a hidden target visible after application', async () => {
  setup();
  assert.equal(typeof store.getState().applyAiSection, 'function');
  const previous = store.getState().current.sections[0].data;
  store.getState().current.sections[0].isVisible = false;
  let resolve;
  let request;
  globalThis.__resumeApiMock.updateSection = async (_id, body) => { request = body; await new Promise(r => { resolve = r; }); };
  let completed = false;
  const pending = store.getState().applyAiSection('summary', { ...previous, content: '新内容' }, previous, true).then(() => { completed = true; });
  await Promise.resolve();
  assert.equal(completed, false);
  assert.equal(request.isVisible, true);
  resolve();
  await pending;
  assert.equal(completed, true);
  assert.equal(store.getState().current.sections[0].data.content, '新内容');
  assert.equal(store.getState().current.sections[0].data._config.moduleName, '个人概述');
});
test('failed AI persistence rejects, restores unchanged local target and allows retry', async () => {
  setup();
  assert.equal(typeof store.getState().applyAiSection, 'function');
  const previous = store.getState().current.sections[0].data;
  globalThis.__resumeApiMock.updateSection = async () => { throw new Error('保存失败'); };
  await assert.rejects(store.getState().applyAiSection('summary', { ...previous, content: '新内容' }, previous), /保存失败/);
  assert.equal(store.getState().current.sections[0].data.content, '旧内容');
  globalThis.__resumeApiMock.updateSection = async () => {};
  await store.getState().applyAiSection('summary', { ...previous, content: '新内容' }, previous);
  assert.equal(store.getState().current.sections[0].data.content, '新内容');
});
test('AI save refuses stale originals and does not erase later typing when saving fails', async () => {
  setup();
  assert.equal(typeof store.getState().applyAiSection, 'function');
  const previous = store.getState().current.sections[0].data;
  await assert.rejects(store.getState().applyAiSection('summary', { content: '覆盖' }, { content: '过期' }), /已修改|过期/);
  let reject;
  globalThis.__resumeApiMock.updateSection = () => new Promise((_r, j) => { reject = j; });
  const pending = store.getState().applyAiSection('summary', { ...previous, content: 'AI 建议' }, previous);
  store.getState().updateSectionData('summary', { content: '保存期间继续输入的内容' });
  reject(new Error('离线'));
  await assert.rejects(pending, /离线/);
  assert.equal(store.getState().current.sections[0].data.content, '保存期间继续输入的内容');
  assert.equal(store.getState().dirty, true);
});
