#!/usr/bin/env node
/** Validate the reviewed role catalog and generate all database entry points. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogDirectory = path.join(root, 'templates/catalog');
const expectedRoles = [
  ['general-career', '通用简历'], ['business-analyst', '商务经典'],
  ['brand-designer', '创意设计'], ['java-backend', '技术研发'],
  ['academic-research', '学术科研'], ['project-manager', '商务管理'],
  ['product-manager', '产品运营'], ['ux-designer', '界面设计'],
  ['graduate-developer', '应届校招'], ['data-analyst', '数据分析'],
  ['teacher', '教育教学'], ['pharmacist', '医疗健康'],
  ['web-frontend'], ['qa-engineer'], ['algorithm-engineer'],
  ['growth-operations'], ['content-operations'], ['finance-accounting'],
  ['hr-specialist'], ['sales-business'], ['supply-chain'],
  ['graduate-business'], ['graduate-general'], ['registered-nurse'],
];
const sectionTypes = new Set(['basic', 'summary', 'experience', 'work', 'education', 'projects', 'skills', 'awards', 'certificates', 'custom']);
const layouts = new Set(['single-column', 'two-column', 'sidebar']);
const categories = new Set(['general', 'business', 'design', 'technical', 'academic', 'product', 'graduate', 'medical']);
const roleTerms = {
  'general-career': '项目协调', 'business-analyst': '商业分析', 'brand-designer': '品牌视觉',
  'java-backend': 'Java 后端', 'academic-research': '科研', 'project-manager': '项目经理',
  'product-manager': '产品经理', 'ux-designer': 'UI/UX', 'graduate-developer': 'Java 开发',
  'data-analyst': '数据分析', teacher: '教师', pharmacist: '药师', 'web-frontend': '前端',
  'qa-engineer': '测试', 'algorithm-engineer': '算法', 'growth-operations': '用户运营',
  'content-operations': '内容运营', 'finance-accounting': '会计', 'hr-specialist': '人力资源',
  'sales-business': '销售', 'supply-chain': '采购', 'graduate-business': '商业分析',
  'graduate-general': '运营助理', 'registered-nurse': '护士',
};
const startMarker = '-- BEGIN GENERATED TEMPLATE CATALOG';
const endMarker = '-- END GENERATED TEMPLATE CATALOG';
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const strings = (value) => typeof value === 'string' ? [value] : Array.isArray(value)
  ? value.flatMap(strings) : object(value) ? Object.entries(value).filter(([key]) => key !== '_config').flatMap(([, item]) => strings(item)) : [];

function validate(record, file) {
  const label = `${file} (${record.key ?? '?'})`;
  const require = (condition, message) => assert(condition, `${label}: ${message}`);
  require(/^[a-z]+(?:-[a-z]+)*$/.test(record.key), 'invalid stable role key');
  require(file === `${record.key}.json`, 'file name must match its stable key');
  const index = expectedRoles.findIndex(([key]) => key === record.key);
  require(index >= 0 && record.sortOrder === index + 1, 'role/order differs from the approved directory');
  for (const key of ['name', 'description', 'category']) require(nonempty(record[key]), `${key} is required`);
  require(categories.has(record.category), 'unsupported template category');
  require(Array.isArray(record.tags) && record.tags.length >= 3 && record.tags.every(nonempty), 'at least three readable tags are required');
  require(Array.isArray(record.legacyNames), 'legacyNames must be an array');
  const legacyName = expectedRoles[index]?.[1];
  require(JSON.stringify(record.legacyNames) === JSON.stringify(legacyName ? [legacyName] : []), 'legacy adoption must use the exact approved name');
  const config = record.config;
  require(object(config), 'config must be an object');
  if (!object(config)) return;
  require(config.systemKey === record.key, 'config.systemKey must equal the role key');
  require(layouts.has(config.layout), 'unsupported page layout');
  require(/^#[0-9a-f]{6}$/i.test(config.primaryColor), 'primaryColor must be a hex color');
  require(Array.isArray(config.fonts) && config.fonts.length > 0 && config.fonts.every(nonempty), 'fonts are required');
  require(['underline', 'bar', 'pill', 'solid', 'plain'].includes(config.headerStyle), 'unsupported heading style');
  require(config.globalFontSize >= 12.5 && config.globalFontSize <= 14, 'body font must remain readable');
  require(config.globalLineSpacing >= 1.4 && config.globalLineSpacing <= 1.8, 'invalid line spacing');
  for (const key of ['pageTopMargin', 'pageBottomMargin', 'pageLeftMargin', 'pageRightMargin']) require(config[key] >= 24 && config[key] <= 60, `${key} must be explicit and sensible`);
  require(config.moduleMargin >= 10 && config.moduleMargin <= 24, 'moduleMargin must be explicit and sensible');
  const sample = record.sample;
  require(object(sample) && sample.version === 1, 'sample version must be 1');
  if (!object(sample)) return;
  const profile = sample.profile;
  require(object(profile) && profile.key === record.key, 'sample profile must match the role');
  if (object(profile)) {
    require(nonempty(profile.jobTitle) && nonempty(profile.experienceLevel), 'job and career stage are required');
    require(profile.jobTitle?.includes(roleTerms[record.key]), 'job title must match the approved role');
    require(Array.isArray(profile.highlights) && profile.highlights.length >= 3 && profile.highlights.every(nonempty), 'three content highlights are required');
    require([1, 2].includes(profile.suggestedPages), 'suggestedPages must be one or two');
  }
  const sections = sample.sections;
  require(Array.isArray(sections) && sections.length >= 6 && sections.length <= 8, 'six to eight modules are required');
  if (!Array.isArray(sections)) return;
  require(sections.filter((section) => section.sectionType === 'basic').length === 1 && sections[0]?.sectionType === 'basic', 'exactly one basic module must come first');
  require(sections.some((section) => section.sectionType === 'education'), 'education is required');
  require(sections.some((section) => section.sectionType === 'skills'), 'grouped skills are required');
  for (const type of ['experience', 'projects']) {
    const count = sections.filter((section) => section.sectionType === type).flatMap((section) => section.data?.items ?? []).length;
    require(count >= 1 && count <= 2, `${type} must contain one or two relevant entries`);
  }
  require(JSON.stringify(config.sections) === JSON.stringify(sections.map((section) => section.sectionType)), 'config.sections must follow the sample order');
  const orders = new Set();
  const dateCeiling = '2026-10'; // Release reference; future dates must be reviewed when updating the catalog.
  for (const section of sections) {
    const prefix = `${section.sectionType} module`;
    require(sectionTypes.has(section.sectionType), `${prefix}: unsupported type`);
    require(Number.isInteger(section.sortOrder) && section.sortOrder === orders.size && !orders.has(section.sortOrder), `${prefix}: orders must be contiguous from zero`);
    orders.add(section.sortOrder);
    require(['auto', 'left', 'right'].includes(section.layout), `${prefix}: unsupported column placement`);
    require(object(section.data), `${prefix}: data must be an object`);
    if (!object(section.data)) continue;
    const data = section.data;
    require(object(data._config) && nonempty(data._config.moduleName), `${prefix}: editable module caption is required`);
    if (section.sectionType === 'basic') {
      require(nonempty(data.name) && data.jobTitle === profile?.jobTitle && nonempty(data.city), 'basic identity must agree with profile');
      require(/^1\d{2}\*{4}\d{4}$/.test(data.phone), 'phone must be masked');
      require(/^[a-z.]+@example\.com$/.test(data.email), 'email must use example.com');
    } else if (['summary', 'custom'].includes(section.sectionType)) {
      require(nonempty(data.content) && data.content.length >= 35, `${prefix}: meaningful content is required`);
    } else if (section.sectionType === 'skills') {
      require(Array.isArray(data.items) && data.items.length >= 3 && data.items.every((group) => object(group) && nonempty(group.name) && Array.isArray(group.items) && group.items.length >= 2 && group.items.every(nonempty)), 'skills must have three useful supported groups');
    } else {
      require(Array.isArray(data.items) && data.items.length > 0, `${prefix}: entries are required`);
      for (const item of data.items ?? []) {
        require(object(item), `${prefix}: entries must be objects`);
        if (!object(item)) continue;
        for (const field of ['company', 'school', 'institution']) if (item[field]) require(item[field].includes('虚构'), `${prefix}: institutions must be identified as fictional`);
        for (const field of ['startDate', 'endDate', 'date']) if (item[field]) require(/^\d{4}-(0[1-9]|1[0-2])$/.test(item[field]) && item[field] <= dateCeiling, `${prefix}: invalid or unreviewed future ${field}`);
        if (item.startDate && item.endDate) require(item.startDate <= item.endDate, `${prefix}: end precedes start`);
        if (item.current) require(item.endDate === '', `${prefix}: current entries must have an empty endDate (renderer displays 至今)`);
        if (['experience', 'work', 'projects'].includes(section.sectionType)) {
          require(nonempty(item.company ?? item.name) && nonempty(item.position ?? item.role), `${prefix}: entry identity and role are required`);
          require(nonempty(item.startDate) && (item.current || nonempty(item.endDate)), `${prefix}: an explicit timeline is required`);
          require(Array.isArray(item.bullets) && item.bullets.length === 3 && item.bullets.every((bullet) => nonempty(bullet) && bullet.length >= 25), `${prefix}: three concrete bullets of at least 25 characters are required`);
        }
        if (section.sectionType === 'education') require(nonempty(item.school) && nonempty(item.major) && nonempty(item.degree) && nonempty(item.description) && nonempty(item.startDate) && nonempty(item.endDate), 'education needs institution, degree, subject, dates and course/practice context');
        if (['awards', 'certificates'].includes(section.sectionType)) require(nonempty(item.title) && item.title.includes('示例') && nonempty(item.date), 'qualifications/awards must be clearly marked examples and dated');
      }
    }
    if (config.layout === 'sidebar' && ['skills', 'certificates'].includes(section.sectionType)) require(section.layout === 'left', 'sidebar skills and qualifications belong on the left');
  }
  const body = strings(sections.map((section) => section.data)).join('');
  const chineseCount = (body.match(/\p{Script=Han}/gu) ?? []).length;
  require(chineseCount >= 700 && chineseCount <= 1300, `sample should contain a full readable role narrative (700–1300 Chinese characters; found ${chineseCount})`);
  require(!/某公司|某大学|某企业|13812345678|待填写|Lorem ipsum/.test(body), 'generic padding or unmasked contact found');
}

function migration(records) {
  const payload = JSON.stringify(records.map(({ key, name, description, category, tags, sortOrder, legacyNames, config, sample }) => ({ key, name, description, category, tags, sortOrder, legacyNames, config, sample })), null, 2);
  return `-- Generated by scripts/sync-template-catalog.mjs; edit templates/catalog/*.json instead.
-- Applies to existing databases and new installations; existing resume content is untouched.
BEGIN;
SELECT pg_advisory_xact_lock(727031, 24);
DO $template_catalog$
DECLARE
    seed jsonb;
    matched_ids uuid[];
    target_id uuid;
BEGIN
    FOR seed IN SELECT value FROM jsonb_array_elements($catalog_json$
${payload}
$catalog_json$::jsonb)
    LOOP
        -- A stable system key or exact legacy name must also match the original system sort number.
        -- Custom templates at sort 100 stay independent even when copied config retains a system key.
        SELECT array_agg(existing.id ORDER BY existing.id) INTO matched_ids
        FROM templates existing
        WHERE (existing.config->>'systemKey' = seed->>'key'
               AND existing.sort_order = (seed->>'sortOrder')::integer)
           OR (
                (seed->>'sortOrder')::integer BETWEEN 1 AND 12
                AND existing.sort_order = (seed->>'sortOrder')::integer
                AND existing.name IN (SELECT jsonb_array_elements_text(seed->'legacyNames'))
                AND NULLIF(existing.config->>'systemKey', '') IS NULL
           );

        IF COALESCE(cardinality(matched_ids), 0) > 1 THEN
            RAISE EXCEPTION 'Ambiguous system template %: candidate IDs %; review duplicates before applying the catalog', seed->>'key', matched_ids;
        END IF;
        target_id := matched_ids[1];
        IF target_id IS NULL THEN
            INSERT INTO templates (name, description, category, tags, sort_order, config, preview_config, is_premium, is_active)
            VALUES (seed->>'name', seed->>'description', seed->>'category',
                ARRAY(SELECT jsonb_array_elements_text(seed->'tags')), (seed->>'sortOrder')::integer,
                seed->'config', seed->'sample', FALSE, TRUE);
        ELSE
            UPDATE templates SET
                name = seed->>'name', description = seed->>'description', category = seed->>'category',
                tags = ARRAY(SELECT jsonb_array_elements_text(seed->'tags')),
                sort_order = (seed->>'sortOrder')::integer, config = seed->'config',
                preview_config = seed->'sample', is_premium = FALSE, is_active = TRUE
            WHERE id = target_id
              AND (name, description, category, tags, sort_order, config, preview_config, is_premium, is_active)
                  IS DISTINCT FROM (seed->>'name', seed->>'description', seed->>'category',
                      ARRAY(SELECT jsonb_array_elements_text(seed->'tags')), (seed->>'sortOrder')::integer,
                      seed->'config', seed->'sample', FALSE, TRUE);
        END IF;
    END LOOP;
END;
$template_catalog$;
COMMIT;
`;
}

try {
  if (process.argv.slice(2).some((argument) => argument !== '--check')) throw new Error('Usage: node scripts/sync-template-catalog.mjs [--check]');
  const files = (await readdir(catalogDirectory)).filter((file) => file.endsWith('.json')).sort();
  assert(files.length === 24, `Expected 24 catalog files, found ${files.length}`);
  const records = [];
  for (const file of files) {
    try {
      const record = JSON.parse(await readFile(path.join(catalogDirectory, file), 'utf8'));
      validate(record, file);
      records.push(record);
    } catch (error) { errors.push(`${file}: ${error.message}`); }
  }
  assert(new Set(records.map(({ key }) => key)).size === records.length, 'Duplicate role keys');
  assert(new Set(records.map(({ sortOrder }) => sortOrder)).size === records.length, 'Duplicate sort orders');
  assert(new Set(records.map(({ name }) => name)).size === records.length, 'Duplicate template names');
  for (const [key] of expectedRoles) assert(records.some((record) => record.key === key), `Missing approved role ${key}`);
  for (const layout of layouts) assert(records.some((record) => record.config?.layout === layout), `Missing page layout ${layout}`);
  if (errors.length) throw new Error(errors.join('\n'));
  records.sort((a, b) => a.sortOrder - b.sortOrder);
  const sql = migration(records);
  const initPath = path.join(root, 'docs/sql/init.sql');
  const initSource = await readFile(initPath, 'utf8');
  const seedStart = initSource.includes(startMarker) ? initSource.indexOf(startMarker) : initSource.indexOf('INSERT INTO templates (name, description, category, tags, sort_order, config) VALUES');
  if (seedStart < 0) throw new Error('Cannot find the generated template seed region in init.sql');
  const seedEnd = initSource.includes(endMarker) ? initSource.indexOf(endMarker) + endMarker.length : initSource.length;
  const init = initSource.slice(0, seedStart) + startMarker + '\n' + sql + endMarker + initSource.slice(seedEnd).replace(/^\s*/, '\n');
  const outputs = new Map([
    [initPath, init.endsWith('\n') ? init : init + '\n'],
    [path.join(root, 'docs/sql/migrate-template-content.sql'), sql],
    [path.join(root, 'docs/sql/add-templates.sql'), sql],
  ]);
  if (process.argv.includes('--check')) {
    for (const [file, expected] of outputs) {
      let actual;
      try { actual = await readFile(file, 'utf8'); } catch { actual = ''; }
      if (actual.replace(/\r\n/g, '\n') !== expected.replace(/\r\n/g, '\n')) errors.push(`Generated SQL is stale: ${path.relative(root, file)} (run node scripts/sync-template-catalog.mjs)`);
    }
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Validated 24 original role samples; all three SQL entry points are synchronized.');
  } else {
    for (const [file, content] of outputs) await writeFile(file, content, 'utf8');
    console.log('Validated 24 original role samples and generated init/add/migration SQL.');
  }
} catch (error) {
  console.error(`Template catalog validation failed:\n${error.message}`);
  process.exitCode = 1;
}
