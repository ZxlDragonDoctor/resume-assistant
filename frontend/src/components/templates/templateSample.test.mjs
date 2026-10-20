import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { build } from 'esbuild';

// Reuse Vite's existing bundler so these checks need no new test dependency.
const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL('../../utils/templateSample.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { normalizeTemplateSample, createTemplatePreviewResume, templateSearchText } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);

const sample = {
  version: 1,
  profile: { key: 'data-analyst', jobTitle: '数据分析师', experienceLevel: '1–3 年经验', highlights: ['SQL 分析', '业务复盘'], suggestedPages: 2 },
  sections: [
    { sectionType: 'basic', sortOrder: 0, layout: 'auto', data: { name: '林清和', jobTitle: '数据分析师' } },
    { sectionType: 'work', sortOrder: 2, layout: 'right', data: { _config: { moduleName: '分析经历' }, items: [{ company: '虚构公司', bullets: ['使用 SQL 复盘转化率变化。'] }] } },
    { sectionType: 'skills', sortOrder: 1, layout: 'left', data: { items: [{ name: '分析工具', items: ['SQL', 'Excel'] }] } },
  ],
};
const template = { id: 'template-test', name: '数据分析', category: 'data', description: '岗位范文', config: {}, previewConfig: sample };

test('normalizes JSON and object samples without sharing editable data', () => {
  const normalized = normalizeTemplateSample(JSON.stringify(sample));
  assert.deepEqual(normalized, sample);
  const objectSample = normalizeTemplateSample(sample);
  objectSample.sections[1].data.items[0].bullets[0] = 'edited';
  assert.equal(sample.sections[1].data.items[0].bullets[0], '使用 SQL 复盘转化率变化。');
});

test('rejects missing, partial, unknown and unsafe renderer shapes as one whole sample', () => {
  const invalid = [null, '', '{}', '{bad', [], { ...sample, version: 2 }, { ...sample, profile: {} },
    { ...sample, sections: [] },
    { ...sample, sections: [sample.sections[0], { ...sample.sections[1], sortOrder: 0 }] },
    { ...sample, sections: [...sample.sections, { sectionType: 'unknown', sortOrder: 3, data: {} }] },
    { ...sample, sections: [{ ...sample.sections[0], data: { name: { invalid: true } } }] },
    { ...sample, sections: [sample.sections[0], { sectionType: 'work', sortOrder: 1, data: { items: [{ bullets: 'not an array' }] } }] },
    { ...sample, sections: [sample.sections[0], { sectionType: 'skills', sortOrder: 1, data: { items: [{ name: 'SQL', items: [null] }] } }] },
  ];
  invalid.forEach((value) => assert.equal(normalizeTemplateSample(value), null));
  assert.equal(createTemplatePreviewResume({ ...template, previewConfig: '{}' }), null);
});

test('synthesizes exact sample content with stable preview identifiers and independent copies', () => {
  const first = createTemplatePreviewResume(template);
  const second = createTemplatePreviewResume(template);
  assert.equal(first.targetJob, sample.profile.jobTitle);
  assert.deepEqual(first.sections.map((section) => section.sortOrder), [0, 1, 2]);
  assert.deepEqual(first.sections.map((section) => section.id), second.sections.map((section) => section.id));
  assert.ok(first.sections.every((section) => section.id.startsWith('preview:') && section.isVisible));
  assert.deepEqual(first.sections[2].data, sample.sections[1].data);
  first.sections[2].data.items[0].bullets.push('edited');
  assert.equal(second.sections[2].data.items[0].bullets.length, 1);
  assert.equal(sample.sections[1].data.items[0].bullets.length, 1);
});

test('matches creation defaults and honors template typography and spacing including zero margins', () => {
  const defaults = createTemplatePreviewResume(template);
  const defaultLayout = JSON.parse(defaults.layoutConfig);
  assert.equal(defaults.fontSize, 14);
  assert.equal(defaults.lineSpacing, 1.6);
  assert.equal(defaults.themeColor, '#2563eb');
  assert.deepEqual([defaultLayout.pageTopMargin, defaultLayout.pageBottomMargin, defaultLayout.pageLeftMargin, defaultLayout.pageRightMargin], [44, 44, 52, 52]);
  const configured = createTemplatePreviewResume({ ...template, config: JSON.stringify({ layout: 'sidebar', primaryColor: '#0D9488', fonts: ['SimSun'], globalFontSize: 13, globalLineSpacing: 1.5, moduleMargin: 12, titleBottomMargin: 7, pageTopMargin: 0, pageLeftMargin: 40 }) });
  const configuredLayout = JSON.parse(configured.layoutConfig);
  assert.equal(configured.fontSize, 13);
  assert.equal(configured.lineSpacing, 1.5);
  assert.equal(configured.fontFamily, 'SimSun');
  assert.equal(configured.themeColor, '#0D9488');
  assert.equal(configuredLayout.layout, 'sidebar');
  assert.equal(configuredLayout.moduleMargin, 12);
  assert.equal(configuredLayout.titleBottomMargin, 7);
  assert.equal(configuredLayout.pageTopMargin, 0);
  assert.equal(configuredLayout.pageLeftMargin, 40);
});

test('uses backend numeric bounds and retains precise font size in renderer layout', () => {
  const invalid = createTemplatePreviewResume({ ...template, config: { globalFontSize: 9, globalLineSpacing: 4, pageTopMargin: 121, moduleMargin: 49, titleBottomMargin: -1 } });
  const invalidLayout = JSON.parse(invalid.layoutConfig);
  assert.equal(invalidLayout.globalFontSize, 14);
  assert.equal(invalidLayout.globalLineSpacing, 1.6);
  assert.equal(invalidLayout.pageTopMargin, 44);
  assert.equal(invalidLayout.moduleMargin, 20);
  assert.equal(invalidLayout.titleBottomMargin, 10);
  const precise = createTemplatePreviewResume({ ...template, config: { globalFontSize: 13.5 } });
  assert.equal(precise.fontSize, 14);
  assert.equal(JSON.parse(precise.layoutConfig).globalFontSize, 13.5);
});

test('search includes actual role, stage and sample highlights', () => {
  const searchable = templateSearchText(template);
  ['数据分析师', '1–3 年经验', 'sql 分析', '业务复盘', 'data'].forEach((term) => assert.ok(searchable.includes(term)));
});

test('all 24 canonical samples normalize and preserve complete creation content', async () => {
  const directory = new URL('../../../../templates/catalog/', import.meta.url);
  const files = (await readdir(directory)).filter((file) => file.endsWith('.json'));
  assert.equal(files.length, 24);
  for (const file of files) {
    const record = JSON.parse(await readFile(new URL(file, directory), 'utf8'));
    const normalized = normalizeTemplateSample(record.sample);
    assert.ok(normalized, `${file} must provide a renderable sample`);
    const preview = createTemplatePreviewResume({ ...record, id: record.key, previewConfig: record.sample });
    assert.deepEqual(preview.sections.map(({ sectionType, sortOrder, layout, data }) => ({ sectionType, sortOrder, layout, data })),
      [...record.sample.sections].sort((left, right) => left.sortOrder - right.sortOrder), file);
  }
});
