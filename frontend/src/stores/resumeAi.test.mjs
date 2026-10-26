import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
globalThis.__resumeApiMock = {};
const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL('./resumeStore.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'api-fixture', setup(b) {
    b.onResolve({ filter: /services\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const resumeApi = globalThis.__resumeApiMock;' }));
  } }],
});
const folder=mkdtempSync(join(tmpdir(),'resume-store-test-'));const bundle=join(folder,'store.mjs');writeFileSync(bundle,outputFiles[0].text);
const {useResumeStore:store}=await import(pathToFileURL(bundle).href);unlinkSync(bundle);rmdirSync(folder);
const fixture = () => ({ id: 'resume-a', title: '已保存简历', updatedAt: '2026-10-26T00:00:00Z', templateId: null, layoutConfig: '{}', shareEnabled: false, sections: [{ id: 's1', sectionType: 'summary', sortOrder: 0, isVisible: true, data: { content: '旧内容', _config: { moduleName: '总结' } } }] });
let writes;
function setup() {
  const saved = fixture();
  store.setState({ current: structuredClone(saved), saved: structuredClone(saved), dirty: false, saving: false, past: [], future: [], historyGroup: null, historyAt: 0, lastSavedAt: null, versions: [] });
  writes = [];
  for (const method of ['update','updateSection','addSection','toggleSection','deleteSection','reorderSections','restoreVersion']) globalThis.__resumeApiMock[method] = async () => { writes.push(method); throw new Error('Unexpected background write'); };
  globalThis.__resumeApiMock.versions = async () => [];
  globalThis.__resumeApiMock.saveContent = async (_id, payload) => { writes.push(payload); return { ...fixture(), ...payload, updatedAt: '2026-10-26T00:01:00Z' }; };
}

test('all editor mutations including AI stay in draft until explicit save', async () => {
  setup(); const s=()=>store.getState();
  s().updateMeta({title:'草稿'}); await s().saveLayout({themeColor:'#ff0000'});
  s().updateSectionData('s1',{content:'编辑内容'}); await s().applyAiSection('s1',{content:'AI草稿'},{content:'编辑内容'});
  const added=await s().addSection('custom'); await s().duplicateSection('s1'); await s().toggleSectionVisible('s1');
  await s().reorderSections(s().current.sections.map(x=>x.id).reverse()); await s().deleteSection(added.id);
  assert.deepEqual(writes,[]);assert.equal(s().dirty,true);assert.equal(s().lastSavedAt,null);assert.equal(s().saved.title,'已保存简历');
});
test('undo redo and discard restore content, metadata and module changes without writes', async () => {
  setup();const s=()=>store.getState();s().updateMeta({title:'改名'});await s().deleteSection('s1');
  s().undo();assert.equal(s().current.sections.length,1);s().undo();assert.equal(s().current.title,'已保存简历');assert.equal(s().dirty,false);
  s().redo();assert.equal(s().current.title,'改名');s().discardChanges();assert.equal(s().current.title,'已保存简历');assert.equal(s().future.length,0);assert.deepEqual(writes,[]);
});
test('explicit save submits entire draft once and marks clean only after success', async () => {
  setup();store.getState().updateSectionData('s1',{content:'手动保存'});await store.getState().saveCurrent();
  assert.equal(writes.length,1);assert.equal(writes[0].sections[0].data.content,'手动保存');assert.equal(writes[0].expectedUpdatedAt,fixture().updatedAt);
  assert.equal(store.getState().dirty,false);assert.ok(store.getState().lastSavedAt);await store.getState().saveCurrent();assert.equal(writes.length,1);
});
test('failed atomic save retains all draft changes and supports retry', async () => {
  setup();store.getState().updateMeta({title:'离线草稿'});const success=globalThis.__resumeApiMock.saveContent;
  globalThis.__resumeApiMock.saveContent=async()=>{throw new Error('网络失败')};await assert.rejects(store.getState().saveCurrent(),/网络失败/);
  assert.equal(store.getState().dirty,true);assert.equal(store.getState().lastSavedAt,null);assert.equal(store.getState().saving,false);
  globalThis.__resumeApiMock.saveContent=success;await store.getState().saveCurrent();assert.equal(store.getState().dirty,false);
});
test('edits during save remain dirty and use the new persisted revision on the next save', async () => {
  setup();store.getState().updateMeta({title:'提交版本'});let resolve;globalThis.__resumeApiMock.saveContent=(_id,payload)=>new Promise(r=>{resolve=()=>r({...fixture(),...payload,updatedAt:'2026-10-26T01:00:00Z'})});
  const pending=store.getState().saveCurrent();store.getState().updateMeta({title:'保存中继续修改'});resolve();await pending;
  assert.equal(store.getState().current.title,'保存中继续修改');assert.equal(store.getState().saved.title,'提交版本');assert.equal(store.getState().dirty,true);
  assert.equal(store.getState().saved.updatedAt,'2026-10-26T01:00:00Z');
});
test('history restore only loads a draft, preserves identity and can be undone', async () => {
  setup();globalThis.__resumeApiMock.versionDetail=async()=>({id:'v1',snapshot:{...fixture(),title:'历史简历',updatedAt:'2020-01-01T00:00:00Z',shareEnabled:true}});
  await store.getState().restoreVersion('v1');assert.equal(store.getState().current.title,'历史简历');assert.equal(store.getState().current.updatedAt,fixture().updatedAt);assert.equal(store.getState().current.shareEnabled,false);assert.equal(store.getState().dirty,true);assert.deepEqual(writes,[]);
  store.getState().undo();assert.equal(store.getState().dirty,false);assert.equal(store.getState().current.title,'已保存简历');
});
test('late save response cannot replace a different resume or its history', async () => {
  setup();store.getState().updateMeta({title:'待提交'});let resolve;globalThis.__resumeApiMock.saveContent=()=>new Promise(r=>{resolve=r});const pending=store.getState().saveCurrent();
  const other={...fixture(),id:'resume-b'};store.getState().clearCurrent();store.setState({current:other,saved:other,past:[],future:[]});resolve(fixture());await pending;
  assert.equal(store.getState().current.id,'resume-b');assert.equal(store.getState().past.length,0);
});
test('AI application rejects stale source and remains undoable', async () => {
  setup();await assert.rejects(store.getState().applyAiSection('s1',{content:'AI'}, {content:'过期'}),/已修改/);
  const before=store.getState().current.sections[0].data;await store.getState().applyAiSection('s1',{...before,content:'AI建议'},before,true);store.getState().undo();assert.equal(store.getState().current.sections[0].data.content,'旧内容');assert.deepEqual(writes,[]);
});


test('a delayed history load cannot overwrite edits made while loading', async () => {
  setup(); let resolve;
  globalThis.__resumeApiMock.versionDetail = () => new Promise(r => { resolve = r; });
  const pending = store.getState().restoreVersion('old');
  store.getState().updateMeta({ title: '加载期间继续编辑' });
  resolve({ id: 'old', snapshot: { ...fixture(), title: '旧版' } });
  await assert.rejects(pending, /编辑内容已变化/);
  assert.equal(store.getState().current.title, '加载期间继续编辑');
  assert.equal(store.getState().dirty, true); assert.deepEqual(writes, []);
});

test('sharing refresh preserves unsaved content and does not hide external content conflicts', async () => {
  setup(); store.getState().updateMeta({ title: '尚未保存' });
  globalThis.__resumeApiMock.detail = async () => ({ ...fixture(), shareEnabled: true, shareToken: 'token', updatedAt: '2026-10-26T02:00:00Z' });
  await store.getState().syncPublishedState();
  assert.equal(store.getState().current.title, '尚未保存');
  assert.equal(store.getState().current.shareEnabled, true); assert.equal(store.getState().dirty, true);
  assert.equal(store.getState().saved.updatedAt, '2026-10-26T02:00:00Z');
  globalThis.__resumeApiMock.detail = async () => ({ ...fixture(), title: '其他窗口修改', updatedAt: '2026-10-26T03:00:00Z' });
  await store.getState().syncPublishedState();
  assert.equal(store.getState().saved.updatedAt, '2026-10-26T02:00:00Z');
  assert.equal(store.getState().current.title, '尚未保存');
});
