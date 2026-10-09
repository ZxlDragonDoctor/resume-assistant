/**
 * 导出渲染器契约测试
 * ------------------------------------------------------------------
 * 验证 export-service/src/renderer.js 与前端 ResumePreviewEngine 的
 * 渲染规则保持一致：模块配置、隐藏过滤、标题样式、富文本三态。
 *
 * 运行：node scripts/contract-test.mjs
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { renderResumeHtml, paginateSectionsByHeight } = require('../src/renderer.js');

const resume = {
  id: 'r1',
  title: '张三的简历',
  targetJob: 'Java 后端开发工程师',
  themeColor: '#4F46E5',
  fontFamily: 'system-ui',
  fontSize: 14,
  lineSpacing: 1.65,
  layoutConfig: JSON.stringify({
    globalFontSize: 14,
    globalLineSpacing: 1.65,
    globalFontFamily: 'system-ui',
    pageTopMargin: 44,
    pageBottomMargin: 44,
    pageLeftMargin: 52,
    pageRightMargin: 52,
    moduleMargin: 20,
    titleTopPadding: 2,
    titleBottomMargin: 10,
    headerStyle: 'underline',
  }),
  sections: [
    {
      id: 's0',
      sectionType: 'basic',
      sortOrder: 0,
      isVisible: true,
      data: JSON.stringify({
        name: '张三',
        jobTitle: 'Java 后端开发工程师',
        phone: '13800000000',
        email: 'z@example.com',
        city: '上海',
        website: 'github.com/z',
        links: [{ label: '博客', url: 'https://b.io' }],
        _config: {},
      }),
    },
    {
      id: 's1',
      sectionType: 'summary',
      sortOrder: 1,
      isVisible: true,
      data: JSON.stringify({ content: '三年 Java 后端经验，擅长 **高并发** 系统设计。', _config: {} }),
    },
    {
      id: 's2',
      sectionType: 'experience',
      sortOrder: 2,
      isVisible: true,
      data: JSON.stringify({
        items: [
          {
            company: '字节跳动',
            position: '后端实习生',
            startDate: '2023-06',
            endDate: '2024-06',
            bullets: ['主导订单服务重构，P99 从 800ms 降到 120ms'],
          },
        ],
        _config: { titleStyle: 'bar' },
      }),
    },
    {
      id: 's3',
      sectionType: 'projects',
      sortOrder: 3,
      isVisible: true,
      data: JSON.stringify({
        items: [
          {
            name: '简历助手',
            role: '后端负责人',
            tech: 'Spring Boot · PostgreSQL',
            startDate: '2024-09',
            bullets: ['用 JSONB 存储动态表单，支撑 10 万+ 简历查询'],
          },
        ],
        _config: {},
      }),
    },
    {
      id: 's4',
      sectionType: 'skills',
      sortOrder: 4,
      isVisible: true,
      data: JSON.stringify({ items: ['Java', 'Spring Boot', 'PostgreSQL', 'Redis'], _config: {} }),
    },
    {
      id: 's5',
      sectionType: 'education',
      sortOrder: 5,
      isVisible: true,
      data: JSON.stringify({
        items: [
          { school: '某某大学', degree: '本科', major: '计算机科学', startDate: '2019-09', endDate: '2023-06' },
        ],
        _config: {},
      }),
    },
    {
      id: 's6',
      sectionType: 'awards',
      sortOrder: 6,
      isVisible: true,
      data: JSON.stringify({ items: [{ title: '国家奖学金', level: '国家级', date: '2022-10' }], _config: {} }),
    },
    {
      id: 's7',
      sectionType: 'custom',
      sortOrder: 7,
      isVisible: false,
      data: JSON.stringify({ content: 'HIDDEN_MARKER_SHOULD_NOT_APPEAR', _config: { moduleName: '隐藏模块' } }),
    },
    {
      id: 's8',
      sectionType: 'custom',
      sortOrder: 8,
      isVisible: true,
      data: JSON.stringify({ content: '# 作品集\n\n- 开源项目 A', _config: { moduleName: '作品集' } }),
    },
  ],
};

const html = renderResumeHtml(resume, {});

const checks = [
  ['基础信息姓名', '张三'],
  ['基础信息联系方式', '13800000000'],
  ['Summary Markdown 加粗', '<strong>高并发</strong>'],
  ['经历公司名', '字节跳动'],
  ['模块级 titleStyle=bar 生效', 'section-title bar'],
  ['项目技术栈', 'Spring Boot'],
  ['技能标签', 'PostgreSQL'],
  ['教育专业', '计算机科学'],
  ['奖项级别', '国家级'],
  ['自定义模块标题生效', '作品集'],
  ['Markdown 标题渲染', '<h1'],
  ['A4 纸张容器', 'width: 210mm'],
];

let failures = 0;

for (const [name, needle] of checks) {
  const pass = html.includes(needle);
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
}

// 反例：隐藏模块必须被过滤
const hiddenLeaked = html.includes('HIDDEN_MARKER_SHOULD_NOT_APPEAR');
if (hiddenLeaked) failures += 1;
console.log(`${hiddenLeaked ? 'FAIL' : 'PASS'}  隐藏模块被正确过滤`);

// 反例：模块级 hideTitle 不得输出 h2
const noTitleResume = {
  ...resume,
  sections: [
    resume.sections[0],
    {
      id: 'x1',
      sectionType: 'custom',
      sortOrder: 1,
      isVisible: true,
      data: JSON.stringify({ content: '只显示内容', _config: { moduleName: 'SHOULD_NOT_RENDER', hideTitle: true } }),
    },
  ],
};
const noTitleHtml = renderResumeHtml(noTitleResume, {});
const hideTitleOk = !noTitleHtml.includes('SHOULD_NOT_RENDER') && noTitleHtml.includes('只显示内容');
if (!hideTitleOk) failures += 1;
console.log(`${hideTitleOk ? 'PASS' : 'FAIL'}  hideTitle 时不渲染标题、仅渲染内容`);

const paginatorAvailable = typeof paginateSectionsByHeight === 'function';
if (!paginatorAvailable) failures += 1;
console.log(`${paginatorAvailable ? 'PASS' : 'FAIL'}  按页面可用高度提供顺序分栏器`);
if (paginatorAvailable) {
  const pages = paginateSectionsByHeight(
    [
      { id: 'a', height: 50 },
      { id: 'b', height: 40 },
      { id: 'c', height: 50 },
      { id: 'd', height: 30 },
      { id: 'e', height: 20, layout: 'right' },
      { id: 'f', height: 40 },
    ],
    { firstPageCapacity: 80, columnCapacity: 100 },
  );
  const placements = pages.map((page) => ({
    left: page.main.map((section) => section.id),
    right: page.side.map((section) => section.id),
  }));
  const expectedPlacements = [
    { left: ['a'], right: ['b'] },
    { left: ['c', 'd'], right: ['e', 'f'] },
  ];
  const flowOk = JSON.stringify(placements) === JSON.stringify(expectedPlacements);
  if (!flowOk) failures += 1;
  console.log(`${flowOk ? 'PASS' : 'FAIL'}  左栏排满后流入右栏、两栏满后下一页从左栏开始`);

  const columnAwarePages = paginateSectionsByHeight(
    [
      { id: 'pin', height: 40, layout: 'right' },
      { id: 'left', height: 80 },
      { id: 'auto', height: 120 },
    ],
    {
      firstPageCapacity: 100,
      columnCapacity: 100,
      heightFor: (section, column) => section.id === 'pin'
        ? 40
        : section.id === 'left' ? 80 : column === 'side' ? 50 : 120,
    },
  );
  const columnAwareOk = columnAwarePages.length === 1
    && JSON.stringify(columnAwarePages[0].main.map((section) => section.id)) === JSON.stringify(['left'])
    && JSON.stringify(columnAwarePages[0].side.map((section) => section.id)) === JSON.stringify(['pin', 'auto']);
  if (!columnAwareOk) failures += 1;
  console.log(`${columnAwareOk ? 'PASS' : 'FAIL'}  分栏时分别使用左右栏实际高度`);

  const firstPageOverflowPages = paginateSectionsByHeight(
    [
      { id: 'fits-first-page' },
      { id: 'needs-full-page' },
    ],
    {
      firstPageCapacity: 100,
      columnCapacity: 150,
      heightFor: (section, column) => section.id === 'fits-first-page'
        ? 80
        : column === 'main' ? 70 : 120,
    },
  );
  const noFirstPageOverflow = firstPageOverflowPages.length === 2
    && JSON.stringify(firstPageOverflowPages[0].main.map((section) => section.id)) === JSON.stringify(['fits-first-page'])
    && firstPageOverflowPages[0].side.length === 0
    && JSON.stringify(firstPageOverflowPages[1].main.map((section) => section.id)) === JSON.stringify(['needs-full-page']);
  if (!noFirstPageOverflow) failures += 1;
  console.log(`${noFirstPageOverflow ? 'PASS' : 'FAIL'}  首屏页眉挤占高度时模块继续到下一页左栏，不溢出右栏`);
}

// 显式模块栏位应优先于自动分配，且用户布局应覆盖模板推荐布局。
const placementResume = {
  ...resume,
  layoutConfig: JSON.stringify({ layout: 'two-column' }),
  sections: [
    resume.sections[0],
    {
      id: 'layout-left', sectionType: 'custom', sortOrder: 1, isVisible: true, layout: 'left',
      data: JSON.stringify({ content: 'FIXED_LEFT_MARKER', _config: { moduleName: '左栏模块' } }),
    },
    {
      id: 'layout-right', sectionType: 'custom', sortOrder: 2, isVisible: true, layout: 'right',
      data: JSON.stringify({ content: 'FIXED_RIGHT_MARKER', _config: { moduleName: '右栏模块' } }),
    },
  ],
};
const placementHtml = renderResumeHtml(placementResume, { templateConfig: { layout: 'single-column' } });
const leftColumnHtml = placementHtml.match(/<div class="col-main">([\s\S]*?)<\/div>\s*<div class="col-side"/)?.[1] || '';
const rightColumnHtml = placementHtml.match(/<div class="col-side"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)?.[1] || '';
const manualPlacementOk = placementHtml.includes('layout-two-column')
  && leftColumnHtml.includes('FIXED_LEFT_MARKER')
  && !leftColumnHtml.includes('FIXED_RIGHT_MARKER')
  && rightColumnHtml.includes('FIXED_RIGHT_MARKER')
  && !rightColumnHtml.includes('FIXED_LEFT_MARKER');
if (!manualPlacementOk) failures += 1;
console.log(`${manualPlacementOk ? 'PASS' : 'FAIL'}  用户版式优先且模块可固定到左右栏`);

const singleColumnHtml = renderResumeHtml(
  { ...placementResume, layoutConfig: JSON.stringify({ layout: 'single-column' }) },
  { templateConfig: { layout: 'two-column' } },
);
const userLayoutPriorityOk = singleColumnHtml.includes('layout-single') && !singleColumnHtml.includes('layout-two-column');
if (!userLayoutPriorityOk) failures += 1;
console.log(`${userLayoutPriorityOk ? 'PASS' : 'FAIL'}  用户版式切换为单栏后不再被模板覆盖`);

const multiPageResume = {
  ...resume,
  layoutConfig: JSON.stringify({ layout: 'two-column', pageTopMargin: 40, pageBottomMargin: 40 }),
  sections: [
    resume.sections[0],
    ...Array.from({ length: 12 }, (_, index) => ({
      id: `flow-${index}`,
      sectionType: 'custom',
      sortOrder: index + 1,
      isVisible: true,
      data: JSON.stringify({ content: `FLOW_MARKER_${index} ${'项目成果 '.repeat(180)}`, _config: { moduleName: `模块${index}` } }),
    })),
  ],
};
const multiPageHtml = renderResumeHtml(multiPageResume, {});
const multiPageOk = multiPageHtml.includes('class="page" data-page="2"')
  && /class="page" data-page="2"[\s\S]*?<div class="col-main">[\s\S]*?FLOW_MARKER_/.test(multiPageHtml);
if (!multiPageOk) failures += 1;
console.log(`${multiPageOk ? 'PASS' : 'FAIL'}  多页双栏在新页从左栏继续`);

console.log(
  failures === 0
    ? '\n=== 渲染契约测试全部通过 ==='
    : `\n=== 渲染契约测试失败 ${failures} 项 ===`
);
process.exit(failures === 0 ? 0 : 1);
