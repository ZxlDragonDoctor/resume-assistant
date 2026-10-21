import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const source = fileURLToPath(new URL('./aiResume.ts', import.meta.url));
let helpers = {};
if (existsSync(source)) {
  const { outputFiles } = await build({ entryPoints: [source], bundle: true, platform: 'node', format: 'esm', write: false });
  helpers = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
}
const call = (name, ...args) => {
  assert.equal(typeof helpers[name], 'function', `${name} must implement the AI data contract`);
  return helpers[name](...args);
};
const section = (id, sectionType, data, sortOrder = 0, isVisible = true) => ({ id, sectionType, data, sortOrder, isVisible });
const resume = (sections, targetJob = '') => ({ id: 'resume-a', targetJob, sections });
const fixture = () => resume([
  section('basic', 'basic', { name: '测试候选人', jobTitle: '产品经理', phone: '13812345678', email: 'private@test.com' }),
  section('project', 'projects', { _config: { moduleName: '项目实践', titleColor: '#123456' }, items: [
    { name: '流程改善', role: '参与者', bullets: ['参与访谈，整理 20 份反馈', '完成流程梳理'] },
    { name: '第二项目', bullets: ['参与访谈，整理 20 份反馈'] },
  ] }, 1),
]);

test('resolves target job without manufacturing a role or experience', () => {
  assert.equal(call('resolveTargetJob', fixture()), '产品经理');
  assert.equal(call('resolveTargetJob', resume(fixture().sections, '护士')), '护士');
  assert.equal(call('resolveTargetJob', resume([])), '');
});
test('extracts visible actual content and legacy skills without contact data', () => {
  const value = resume([
    ...fixture().sections,
    section('skills', 'skills', { items: [{ category: '分析工具', value: 'Excel / SQL' }, { name: '研究', items: ['访谈'] }] }, 2),
    section('award', 'awards', { items: [{ title: '学业奖学金', date: '2025-06' }] }, 3),
    section('text', 'custom', { content: '<p>志愿服务</p><p>图书整理</p>' }, 4),
    section('hidden', 'custom', { content: '隐藏资料不能发送' }, 5, false),
  ]);
  const text = call('resumeToPlainText', value);
  for (const expected of ['产品经理', '20 份反馈', 'Excel / SQL', '访谈', '2025-06', '志愿服务']) assert.ok(text.includes(expected), expected);
  for (const unexpected of ['13812345678', 'private@test.com', '隐藏资料不能发送', '[object Object]', '<p>']) assert.ok(!text.includes(unexpected), unexpected);
});
test('does not treat empty section headings and a desired role as a completed resume', () => {
  assert.equal(call('hasResumeContent', resume([section('basic', 'basic', { jobTitle: '护士' }), section('work', 'work', { items: [] })])), false);
  assert.equal(call('hasResumeContent', fixture()), true);
});
test('collects stable individual paths, including duplicate text in different entries', () => {
  const targets = call('collectBulletTargets', fixture());
  assert.equal(targets.length, 3);
  assert.equal(new Set(targets.map(t => t.id)).size, 3);
  assert.deepEqual(targets.map(t => [t.sectionId, t.itemIndex, t.bulletIndex]), [['project', 0, 0], ['project', 0, 1], ['project', 1, 0]]);
});
test('applies only selected positions and preserves styles and unrelated fields immutably', () => {
  const original = fixture();
  const target = call('collectBulletTargets', original)[2];
  const patches = call('planBulletChanges', original, [{ ...target, after: '参与访谈并整理 20 份用户反馈' }]);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].data.items[0].bullets[0], target.before);
  assert.equal(patches[0].data.items[1].bullets[0], '参与访谈并整理 20 份用户反馈');
  assert.equal(patches[0].data._config.titleColor, '#123456');
  assert.equal(original.sections[1].data.items[1].bullets[0], target.before);
});
test('rejects changed/deleted targets, duplicate selections, empty results and multiple modules', () => {
  const original = fixture();
  const target = call('collectBulletTargets', original)[0];
  const proposal = { ...target, after: '整理 20 份反馈' };
  const changed = structuredClone(original);
  changed.sections[1].data.items[0].bullets[0] = '用户后来修改的正文';
  assert.throws(() => call('planBulletChanges', changed, [proposal]), /已修改|过期/);
  assert.throws(() => call('planBulletChanges', resume([]), [proposal]), /不存在|过期/);
  assert.throws(() => call('planBulletChanges', original, [proposal, proposal]), /重复/);
  assert.throws(() => call('planBulletChanges', original, [{ ...proposal, after: ' ' }]), /为空|空白/);
  const other = section('other', 'work', { items: [{ bullets: ['另外的经历'] }] }, 2);
  const multiple = resume([...original.sections, other]);
  const another = call('collectBulletTargets', multiple).at(-1);
  assert.throws(() => call('planBulletChanges', multiple, [proposal, { ...another, after: '另一建议' }]), /一个模块|同一模块/);
});
