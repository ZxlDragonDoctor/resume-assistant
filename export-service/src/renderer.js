/**
 * 简历 HTML 渲染器
 * ------------------------------------------------------------------
 * 与前端 ResumePreview 保持一致的渲染规则，确保「所见即所得」：
 * 导出 PDF 与编辑器中的预览结果视觉一致。
 *
 * 渲染顺序：
 *   1. 解析 layoutConfig（页面边距、全局字体 / 字号 / 行距、主题色）
 *   2. 解析每份 section 的 data 与 _config（模块级样式覆盖）
 *   3. 按 sectionType 分发到具体渲染函数
 *   4. 套用 templates 中定义的版式外壳（单栏 / 双栏 / 侧边栏 / 时间轴）
 */

const { marked } = require('marked');

marked.setOptions({ gfm: true, breaks: true });

// ------------------------------------------------------------------
// 常量与工具
// ------------------------------------------------------------------

const SECTION_LABELS = {
  basic: '基本信息',
  summary: '个人总结',
  experience: '实习经历',
  work: '工作经历',
  education: '教育经历',
  projects: '项目经历',
  skills: '专业技能',
  awards: '荣誉奖项',
  certificates: '证书',
  custom: '自定义模块',
};

const FONT_STACKS = {
  'system-ui': "'Inter',-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei','Segoe UI',sans-serif",
  'Microsoft YaHei': "'Microsoft YaHei','Noto Sans SC',sans-serif",
  SimSun: "'SimSun','Songti SC',serif",
  SimHei: "'SimHei','Heiti SC',sans-serif",
  KaiTi: "'KaiTi','Kaiti SC',serif",
  FangSong: "'FangSong','Fangsong SC',serif",
  Inter: "'Inter','Noto Sans SC',sans-serif",
  serif: "'Noto Serif SC',Georgia,'Times New Roman',serif",
  Georgia: "Georgia,'Noto Serif SC','Songti SC',serif",
  monospace: "'JetBrains Mono','SF Mono',Consolas,monospace",
};

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hexToRgba(hex, alpha) {
  const fallback = `rgba(37,99,235,${alpha})`;
  if (!hex || typeof hex !== 'string') return fallback;
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return fallback;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function fontStack(name) {
  if (!name) return FONT_STACKS['system-ui'];
  return FONT_STACKS[name] || `'${name}',${FONT_STACKS['system-ui']}`;
}

// ------------------------------------------------------------------
// 富文本渲染（HTML / Markdown / 纯文本三态）
// ------------------------------------------------------------------

function isHtml(str) {
  return /<\/?[a-z][\s\S]*>/i.test(str);
}

function looksLikeMarkdown(str) {
  return /(^|\n)\s*([-*+]\s|\d+\.\s|#{1,6}\s|>\s)|\*\*|`/.test(str);
}

function renderRich(content, { fontSize, lineHeight, color, align }) {
  if (!content) return '';
  const style = `font-size:${fontSize}px;line-height:${lineHeight};color:${color};text-align:${align}`;

  if (isHtml(content)) {
    return `<div class="rich" style="${style}">${content}</div>`;
  }
  if (looksLikeMarkdown(content)) {
    return `<div class="rich" style="${style}">${marked.parse(content)}</div>`;
  }
  const escaped = escHtml(content).replace(/\n/g, '<br>');
  return `<div class="rich" style="${style}">${escaped}</div>`;
}

// ------------------------------------------------------------------
// 各模块渲染
// ------------------------------------------------------------------

function renderBasic(data, ctx) {
  const { titleSize, contentSize, titleColor, textColor, align } = ctx;
  const name = data.name || '';
  const jobTitle = data.jobTitle || '';
  const contacts = [];

  if (data.phone) contacts.push({ icon: '☎', text: data.phone });
  if (data.email) contacts.push({ icon: '✉', text: data.email });
  if (data.city) contacts.push({ icon: '⌂', text: data.city });
  if (data.website) contacts.push({ icon: '🌐', text: data.website });
  (data.links || []).forEach((l) => {
    if (l && (l.url || l.label)) contacts.push({ icon: '🔗', text: l.label || l.url });
  });

  const contactHtml = contacts.length
    ? `<div class="contact-row" style="font-size:${contentSize - 1}px;color:${textColor};opacity:0.75">
         ${contacts.map((c) => `<span class="contact-item">${c.icon}&nbsp;${escHtml(c.text)}</span>`).join('')}
       </div>`
    : '';

  return `
    <header class="resume-header" style="text-align:${align};color:${textColor}">
      ${name ? `<h1 class="resume-name" style="font-size:${titleSize + 12}px;color:${titleColor}">${escHtml(name)}</h1>` : ''}
      ${jobTitle ? `<div class="resume-job" style="font-size:${contentSize + 1}px;color:${titleColor};opacity:0.8">${escHtml(jobTitle)}</div>` : ''}
      ${contactHtml}
    </header>`;
}

function renderTimelineItem(item, ctx, opts = {}) {
  const { titleSize, contentSize, titleColor, textColor, lineHeight, align } = ctx;
  const title = item.title || item.company || item.school || item.name || item.institution || '';
  const subtitle = item.subtitle || item.position || item.degree || item.role || item.major || '';
  const meta = [item.department, item.major].filter(Boolean).join(' · ');
  const start = item.startDate || '';
  const end = item.endDate || (item.current ? '至今' : '');
  const dateStr = start || end ? `${start}${start && end ? ' — ' : ''}${end}` : '';
  const tech = item.tech || '';
  const bullets = Array.isArray(item.bullets) ? item.bullets.filter((b) => b && String(b).trim()) : [];

  const metaLine = [subtitle, meta].filter(Boolean).join(' · ');

  let html = `<div class="entry" style="text-align:${align}">`;
  html += '<div class="entry-head">';
  html += `<div class="entry-title-group">
             <span class="entry-title" style="font-size:${titleSize}px;color:${titleColor}">${escHtml(title)}</span>
             ${metaLine ? `<span class="entry-meta" style="font-size:${contentSize - 1}px;color:${textColor}">${escHtml(metaLine)}</span>` : ''}
           </div>`;
  if (dateStr) {
    html += `<span class="entry-date" style="font-size:${contentSize - 2}px;color:${textColor}">${escHtml(dateStr)}</span>`;
  }
  html += '</div>';

  if (tech) {
    html += `<div class="entry-tech" style="font-size:${contentSize - 2}px;color:${titleColor}">
               <span class="entry-tech-label">技术栈</span>${escHtml(tech)}
             </div>`;
  }

  if (bullets.length) {
    html += '<ul class="entry-bullets">';
    bullets.forEach((b) => {
      const inner = isHtml(b)
        ? b
        : looksLikeMarkdown(b)
          ? marked.parseInline(b)
          : escHtml(b);
      html += `<li style="font-size:${contentSize - 1}px;color:${textColor};line-height:${lineHeight}">${inner}</li>`;
    });
    html += '</ul>';
  } else if (item.description) {
    html += renderRich(item.description, {
      fontSize: contentSize - 1,
      lineHeight,
      color: textColor,
      align,
    });
  }

  if (opts.link) {
    html += `<div class="entry-link" style="font-size:${contentSize - 2}px">${escHtml(opts.link)}</div>`;
  }

  html += '</div>';
  return html;
}

function renderSkills(data, ctx) {
  const { contentSize, titleColor, textColor } = ctx;
  const items = Array.isArray(data) ? data : data.items || [];
  if (!items.length) return emptyHint(contentSize);

  // 支持两种形态：字符串数组（标签式）与 {name, level, items} 对象数组（分组式）
  const grouped = items.some((i) => i && typeof i === 'object' && (i.name || i.category));

  if (!grouped) {
    return `<div class="skill-tags">${items
      .map((s) => `<span class="skill-tag" style="border-color:${hexToRgba(titleColor, 0.25)};background:${hexToRgba(titleColor, 0.06)};color:${titleColor};font-size:${contentSize - 1}px">${escHtml(s)}</span>`)
      .join('')}</div>`;
  }

  return `<div class="skill-groups">${items
    .map((g) => {
      if (!g || typeof g !== 'object') return '';
      const name = g.name || g.category || '';
      const list = Array.isArray(g.items) ? g.items : String(g.value || '').split(/[,，、]/).filter(Boolean);
      const level = g.level;
      return `<div class="skill-group">
                <span class="skill-group-name" style="color:${titleColor};font-size:${contentSize - 1}px">${escHtml(name)}</span>
                <span class="skill-group-items" style="color:${textColor};font-size:${contentSize - 1}px">${list.map((i) => escHtml(i)).join(' · ')}</span>
                ${level ? `<span class="skill-level" data-level="${escHtml(level)}" style="color:${titleColor}">${'●'.repeat(Number(level) || 0)}${'○'.repeat(Math.max(0, 5 - (Number(level) || 0)))}</span>` : ''}
              </div>`;
    })
    .join('')}</div>`;
}

function renderListItems(data, ctx) {
  const { contentSize, titleColor, textColor } = ctx;
  const items = Array.isArray(data) ? data : data.items || [];
  if (!items.length) return emptyHint(contentSize);

  return `<div class="award-list">${items
    .map((item) => {
      const title = item.title || item.name || '';
      const level = item.level || item.subtitle || '';
      const date = item.date || item.startDate || '';
      const desc = item.description || '';
      return `<div class="award-item">
                <div class="award-main">
                  <span class="award-title" style="color:${titleColor};font-size:${contentSize - 1}px">${escHtml(title)}</span>
                  ${level ? `<span class="award-level" style="color:${titleColor};font-size:${contentSize - 2}px">${escHtml(level)}</span>` : ''}
                  ${date ? `<span class="award-date" style="color:${textColor};font-size:${contentSize - 2}px">${escHtml(date)}</span>` : ''}
                </div>
                ${desc ? `<div class="award-desc" style="color:${textColor};font-size:${contentSize - 2}px">${escHtml(desc)}</div>` : ''}
              </div>`;
    })
    .join('')}</div>`;
}

function renderText(data, ctx) {
  const { contentSize, lineHeight, textColor, align } = ctx;
  return renderRich(data.content, {
    fontSize: contentSize - 1,
    lineHeight,
    color: textColor,
    align,
  });
}

function emptyHint(fontSize) {
  return `<div class="empty-hint" style="font-size:${fontSize - 1}px">待填写</div>`;
}

/**
 * 按每页可用高度分页。单栏顺排、侧栏独立续排；双栏的 auto 阅读顺序
 * 为左栏、右栏、下一页左栏，manual left/right placement 固定目标栏。
 */
function paginateSectionsByHeight(sections, { mode = 'two-column', firstPageCapacity, columnCapacity, heightFor = (s) => s.height || 0 }) {
  const pages = [];
  const capacityFor = (pageIndex) => pageIndex === 0 ? firstPageCapacity : columnCapacity;
  const ensurePage = (pageIndex) => {
    while (pages.length <= pageIndex) pages.push({ main: [], side: [], mainHeight: 0, sideHeight: 0 });
    return pages[pageIndex];
  };
  const fits = (pageIndex, column, height) => {
    const page = ensurePage(pageIndex);
    const used = column === 'main' ? page.mainHeight : page.sideHeight;
    const capacity = capacityFor(pageIndex);
    // Keep oversized modules visible and never search endlessly for a page
    // taller than the configured full-page capacity.
    if (used === 0) return height <= capacity || height > columnCapacity;
    return used + height <= capacity;
  };
  const place = (pageIndex, column, section, height) => {
    const page = ensurePage(pageIndex);
    page[column].push(section);
    if (column === 'main') page.mainHeight += height;
    else page.sideHeight += height;
  };

  if (mode !== 'two-column') {
    const nextPage = { main: 0, side: 0 };
    const sidebarTypes = new Set(['skills', 'awards', 'certificates', 'custom']);
    for (const section of sections) {
      const column = mode === 'sidebar' && (section.layout === 'left'
        || (section.layout !== 'right' && sidebarTypes.has(section.sectionType))) ? 'side' : 'main';
      const height = Math.max(1, Number(heightFor(section, column)) || 1);
      while (!fits(nextPage[column], column, height)) nextPage[column] += 1;
      place(nextPage[column], column, section, height);
    }
    return pages.map(({ main, side }) => ({ main, side }));
  }
  const manualPages = { main: 0, side: 0 };
  let flowPage = 0;
  let flowColumn = 'main';
  for (const section of sections) {
    if (section.layout === 'left' || section.layout === 'right') {
      const column = section.layout === 'left' ? 'main' : 'side';
      const height = Math.max(1, Number(heightFor(section, column)) || 1);
      // Keep each pinned column in section order after it continues to a new page.
      let pageIndex = Math.max(flowPage, manualPages[column]);
      while (!fits(pageIndex, column, height)) pageIndex += 1;
      place(pageIndex, column, section, height);
      manualPages[column] = pageIndex;
      continue;
    }

    let height = Math.max(1, Number(heightFor(section, flowColumn)) || 1);
    while (!fits(flowPage, flowColumn, height)) {
      if (flowColumn === 'main') flowColumn = 'side';
      else {
        flowColumn = 'main';
        flowPage += 1;
      }
      height = Math.max(1, Number(heightFor(section, flowColumn)) || 1);
    }
    place(flowPage, flowColumn, section, height);
  }

  return pages.map(({ main, side }) => ({ main, side }));
}

function estimateSectionHeight(section, { fontSize, lineHeight, moduleMargin, columnWidth }) {
  const data = parseJson(section.data, {});
  const config = data._config || {};
  const contentSize = Number(config.contentFontSize || fontSize);
  const linePx = contentSize * Number(config.lineSpacing || lineHeight);
  const charsPerLine = Math.max(12, Math.floor(columnWidth / Math.max(8, contentSize * 0.9)));
  const lines = (value) => {
    const text = typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ') : '';
    return text ? Math.max(1, Math.ceil(text.length / charsPerLine)) : 0;
  };
  const items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
  let contentHeight = 0;
  if (section.sectionType === 'skills') {
    const text = items.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join(' ');
    contentHeight = Math.max(linePx * 1.8, Math.ceil(text.length / Math.max(10, Math.floor(columnWidth / (contentSize * 4.5)))) * (contentSize * 2.2));
  } else if (items.length) {
    contentHeight = items.reduce((sum, item) => {
      if (typeof item === 'string') return sum + lines(item) * linePx + 5;
      if (!item || typeof item !== 'object') return sum + linePx;
      const record = item;
      const intro = [record.title, record.company, record.school, record.name, record.subtitle,
        record.position, record.degree, record.major, record.date, record.startDate,
        record.endDate, record.tech].filter((value) => typeof value === 'string').join(' ');
      const body = [record.description, record.content, record.bullets]
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .filter((value) => typeof value === 'string')
        .reduce((count, value) => count + lines(value), 0);
      return sum + Math.max(22, lines(intro) * linePx) + body * linePx + 12;
    }, 0);
  } else {
    contentHeight = lines(data.content) * linePx;
  }
  const titleHeight = config.hideTitle ? 0 : Number(config.titleFontSize || fontSize + 2) * 1.4 + 12;
  return Math.max(linePx, titleHeight + contentHeight + moduleMargin);
}

function estimateHeaderHeight(basicSection, resume, baseFontSize) {
  const data = basicSection ? parseJson(basicSection.data, {}) : {};
  const hasJob = Boolean(data.jobTitle || resume.targetJob);
  const contacts = ['phone', 'email', 'city', 'website'].filter((key) => data[key]).length
    + (Array.isArray(data.links) ? data.links.length : 0);
  const nameSize = Number(data._config?.titleFontSize || baseFontSize + 8) + 12;
  return Math.ceil(nameSize * 1.25 + (hasJob ? baseFontSize + 13 : 0) + (contacts ? baseFontSize * 1.7 + 8 : 0) + 20);
}

// ------------------------------------------------------------------
// 主渲染入口
// ------------------------------------------------------------------

/**
 * @param {object} resume  后端返回的 ResumeDetail（R<T>.data 结构）
 * @param {object} options 渲染选项：{ templateConfig, watermark }
 * @returns {string} 完整 HTML 文档
 */
function renderResumeHtml(resume, options = {}) {
  const layout = parseJson(resume.layoutConfig, {});
  const templateConfig = options.templateConfig || {};

  const themeColor = templateConfig.primaryColor || layout.themeColor || resume.themeColor || '#2563eb';
  const accentColor = templateConfig.accentColor || hexToRgba(themeColor, 0.08);
  const fontName = layout.globalFontFamily || 'system-ui';
  const baseFontSize = layout.globalFontSize ?? 14;
  const baseLineHeight = layout.globalLineSpacing ?? 1.65;
  const pageTop = layout.pageTopMargin ?? 40;
  const pageBottom = layout.pageBottomMargin ?? 40;
  const pageLeft = layout.pageLeftMargin ?? 40;
  const pageRight = layout.pageRightMargin ?? 40;
  const moduleMargin = layout.moduleMargin ?? 20;
  const titleTop = layout.titleTopPadding ?? 2;
  const titleBottom = layout.titleBottomMargin ?? 10;
  const headerStyle = templateConfig.headerStyle || layout.headerStyle || 'underline';

  const sections = (resume.sections || [])
    .filter((s) => s.isVisible !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  // 基础信息单独渲染在页首
  const basicSection = sections.find((s) => s.sectionType === 'basic');
  const bodySections = sections.filter((s) => s.sectionType !== 'basic');

  const globalCtx = {
    titleSize: baseFontSize + 2,
    contentSize: baseFontSize,
    titleColor: themeColor,
    textColor: '#334155',
    lineHeight: baseLineHeight,
    align: 'left',
  };

  // ---------- 头部 ----------
  let headerHtml = '';
  if (basicSection) {
    const basicData = parseJson(basicSection.data, {});
    const cfg = basicData._config || {};
    headerHtml = renderBasic(basicData, {
      titleSize: cfg.titleFontSize || globalCtx.titleSize + 6,
      contentSize: cfg.contentFontSize || globalCtx.contentSize,
      titleColor: cfg.titleColor || themeColor,
      textColor: cfg.textColor || globalCtx.textColor,
      align: cfg.textAlign || 'center',
    });
  } else {
    headerHtml = `
      <header class="resume-header" style="text-align:center">
        <h1 class="resume-name" style="font-size:${baseFontSize + 12}px;color:${themeColor}">${escHtml(resume.title || '个人简历')}</h1>
        ${resume.targetJob ? `<div class="resume-job" style="font-size:${baseFontSize + 1}px;color:${themeColor};opacity:0.8">${escHtml(resume.targetJob)}${resume.targetCompany ? ' · ' + escHtml(resume.targetCompany) : ''}</div>` : ''}
      </header>`;
  }

  // ---------- 正文模块 ----------
  const renderSectionBody = (section) => {
    const data = parseJson(section.data, {});
    const cfg = data._config || {};
    const ctx = {
      titleSize: cfg.titleFontSize || (cfg.fontSize ? cfg.fontSize + 2 : baseFontSize + 2),
      contentSize: cfg.contentFontSize || cfg.fontSize || baseFontSize,
      titleColor: cfg.titleColor || cfg.themeColor || themeColor,
      textColor: cfg.textColor || globalCtx.textColor,
      lineHeight: cfg.lineSpacing || baseLineHeight,
      align: cfg.textAlign || 'left',
    };
    switch (section.sectionType) {
      case 'summary':
      case 'custom':
        return renderText(data, ctx);
      case 'skills':
        return renderSkills(data, ctx);
      case 'awards':
      case 'certificates':
        return renderListItems(data, ctx);
      case 'experience':
      case 'work':
      case 'projects':
      case 'education':
      default: {
        const items = Array.isArray(data) ? data : data.items || [];
        if (!items.length) return emptyHint(ctx.contentSize);
        return items.map((it) => renderTimelineItem(it, ctx)).join('');
      }
    }
  };

  // 版式：与前端 ResumePreviewEngine.splitSectionsByLayout 保持一致
  const layoutMode = layout.layout || templateConfig.layout || 'single-column';
  const SIDEBAR_TYPES = ['skills', 'awards', 'certificates', 'custom'];
  function splitByLayout(list, mode) {
    const sorted = [...list].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    if (mode === 'sidebar') {
      return {
        main: sorted.filter((s) => s.layout === 'right' || (s.layout !== 'left' && !SIDEBAR_TYPES.includes(s.sectionType))),
        side: sorted.filter((s) => s.layout === 'left' || (s.layout !== 'right' && SIDEBAR_TYPES.includes(s.sectionType))),
      };
    }
    if (mode === 'two-column') {
      return { main: sorted, side: [] };
    }
    return { main: sorted, side: [] };
  }

  const renderOneSection = (section) => {
    const data = parseJson(section.data, {});
    const cfg = data._config || {};
    const titleColor = cfg.titleColor || themeColor;
    const titleSize =
      cfg.titleFontSize ??
      (cfg.contentFontSize ? cfg.contentFontSize + 2 : baseFontSize + 2);
    const moduleName = cfg.moduleName || SECTION_LABELS[section.sectionType] || section.sectionType;
    const resolvedHeaderStyle = cfg.titleStyle || headerStyle;

    const body = `<div class="section-body"${
      cfg.textAlign ? ` style="text-align:${cfg.textAlign}"` : ''
    }>${renderSectionBody(section)}</div>`;

    if (cfg.hideTitle) {
      return `
        <section class="resume-section" data-section="${escHtml(section.sectionType)}" data-sort-order="${Number(section.sortOrder) || 0}" data-section-id="${escHtml(section.id || `${section.sectionType}-${section.sortOrder}`)}" data-layout="${escHtml(section.layout || 'auto')}" style="margin-bottom:${moduleMargin}px">
          ${body}
        </section>`;
    }

    return `
        <section class="resume-section" data-section="${escHtml(section.sectionType)}" data-sort-order="${Number(section.sortOrder) || 0}" data-section-id="${escHtml(section.id || `${section.sectionType}-${section.sortOrder}`)}" data-layout="${escHtml(section.layout || 'auto')}" style="margin-bottom:${moduleMargin}px">
          <h2 class="section-title ${resolvedHeaderStyle}" style="font-size:${titleSize}px;line-height:1.4;color:${titleColor};margin-top:${titleTop}px;margin-bottom:${titleBottom}px">
            ${escHtml(moduleName)}
          </h2>
          ${body}
        </section>`;
  };


  const emptyState = !sections.length
    ? '<div class="page-empty">还没有任何模块 —— 回到编辑器添加你的第一段经历</div>'
    : '';

  const columnGap = Math.round(moduleMargin * 0.9) + 10;
  const contentWidth = 794 - pageLeft - pageRight;
  const mainWidth = layoutMode === 'single-column' ? contentWidth
    : layoutMode === 'sidebar' ? contentWidth - 210 - (columnGap - 2) : (contentWidth - columnGap) * 1.15 / 2;
  const sideWidth = layoutMode === 'sidebar' ? 195 : (contentWidth - columnGap) * 0.85 / 2 - 15;
  const pageCapacity = Math.max(120, 1123 - pageTop - pageBottom);
  const firstPageCapacity = Math.max(120, pageCapacity - estimateHeaderHeight(basicSection, resume, baseFontSize));
  const pages = paginateSectionsByHeight(bodySections, {
      mode: layoutMode,
      firstPageCapacity,
      columnCapacity: pageCapacity,
      heightFor: (section, column) => estimateSectionHeight(section, {
        fontSize: baseFontSize,
        lineHeight: baseLineHeight,
        moduleMargin,
        columnWidth: column === 'side' ? sideWidth : mainWidth,
      }),
    });
  if (!pages.length) pages.push({ main: [], side: [] });
  const renderBody = (page) => {
    if (layoutMode === 'sidebar') return `
      <div class="layout-sidebar" style="display:grid;grid-template-columns:210px minmax(0,1fr);gap:${columnGap - 2}px;align-items:start">
        <aside class="col-side" style="border-right:1px solid ${themeColor}22;padding-right:14px">${page.side.map(renderOneSection).join('')}</aside>
        <div class="col-main">${page.main.map(renderOneSection).join('')}</div>
      </div>`;
    if (layoutMode === 'two-column') return `
      <div class="layout-two-column" style="display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,0.85fr);gap:${columnGap}px;align-items:start">
        <div class="col-main">${page.main.map(renderOneSection).join('')}</div>
        <div class="col-side" style="border-left:1px solid ${themeColor}18;padding-left:14px">${page.side.map(renderOneSection).join('')}</div>
      </div>`;
    return `<div class="layout-single col-main">${page.main.map(renderOneSection).join('')}</div>`;
  };
  const documentMarkup = pages.map((page, index) => `
      <main class="page" data-page="${index + 1}">
        ${index === 0 ? headerHtml : ''}
        ${renderBody(page)}
        ${index === 0 ? emptyState : ''}
      </main>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${escHtml(resume.title || '个人简历')}</title>
<style>${buildStyles({
    themeColor,
    accentColor,
    fontStack: fontStack(fontName),
    baseFontSize,
    baseLineHeight,
    pageTop,
    pageBottom,
    pageLeft,
    pageRight,
  })}</style>
</head>
<body>${documentMarkup}</body>
</html>`;
}

// ------------------------------------------------------------------
// 样式表
// ------------------------------------------------------------------

function buildStyles(opts) {
  const {
    themeColor,
    accentColor,
    fontStack,
    baseFontSize,
    baseLineHeight,
    pageTop,
    pageBottom,
    pageLeft,
    pageRight,
  } = opts;

  return `
@page { size: A4; margin: 0; }

* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  font-family: ${fontStack};
  font-size: ${baseFontSize}px;
  line-height: ${baseLineHeight};
  color: #334155;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.page {
  width: 210mm;
  min-height: 297mm;
  padding: ${pageTop}px ${pageRight}px ${pageBottom}px ${pageLeft}px;
  background: #fff;
  break-after: page;
  page-break-after: always;
}
.page:last-child { break-after: auto; page-break-after: auto; }

/* ---------------- 头部 ---------------- */
.resume-header { margin-bottom: 20px; }
.resume-name {
  font-weight: 700;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  line-height: 1.25;
}
.resume-job { margin-bottom: 8px; font-weight: 500; }
.contact-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  justify-content: inherit;
}
.resume-header[style*="text-align:center"] .contact-row { justify-content: center; }
.resume-header[style*="text-align:left"] .contact-row { justify-content: flex-start; }
.resume-header[style*="text-align:right"] .contact-row { justify-content: flex-end; }
.contact-item { white-space: nowrap; }

/* ---------------- 模块标题 ---------------- */
.section-title {
  font-weight: 600;
  letter-spacing: 0.3px;
}
.section-title.underline { border-bottom: 2px solid currentColor; }
.section-title.bar {
  border-left: 4px solid currentColor;
  padding-left: 10px;
  border-bottom: none;
}
.section-title.pill {
  display: inline-block;
  background: ${accentColor};
  border-radius: 999px;
  padding: 2px 14px;
  border-bottom: none;
}
.section-title.solid {
  background: ${themeColor};
  color: #fff !important;
  padding: 4px 12px;
  border-radius: 4px;
  border-bottom: none;
}
.section-title.plain { border-bottom: none; }

/* ---------------- 条目 ---------------- */
.entry { margin-bottom: 13px; }
.entry:last-child { margin-bottom: 0; }
.entry-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}
.entry-title-group { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.entry-title { font-weight: 600; }
.entry-meta { opacity: 0.72; }
.entry-date { opacity: 0.5; white-space: nowrap; }
.entry-tech { margin-top: 3px; font-weight: 500; }
.entry-tech-label {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border-radius: 3px;
  background: ${accentColor};
  font-size: 0.85em;
}
.entry-bullets {
  margin-top: 4px;
  padding-left: 17px;
  list-style: disc;
}
.entry-bullets li { margin: 2px 0; }
.entry-bullets li::marker { color: ${themeColor}; }
.entry-link { opacity: 0.6; margin-top: 3px; word-break: break-all; }

/* ---------------- 技能 ---------------- */
.skill-tags { display: flex; flex-wrap: wrap; gap: 7px; }
.skill-tag {
  padding: 2px 11px;
  border-radius: 4px;
  border: 1px solid;
  font-weight: 500;
}
.skill-groups { display: flex; flex-direction: column; gap: 6px; }
.skill-group { display: flex; align-items: baseline; gap: 10px; }
.skill-group-name { font-weight: 600; min-width: 74px; flex-shrink: 0; }
.skill-group-items { flex: 1; }
.skill-level { letter-spacing: 1px; font-size: 0.85em; }

/* ---------------- 奖项 ---------------- */
.award-list { display: flex; flex-direction: column; gap: 7px; }
.award-main { display: flex; align-items: baseline; gap: 8px; }
.award-title { font-weight: 500; }
.award-level { opacity: 0.75; }
.award-date { margin-left: auto; opacity: 0.55; }
.award-desc { margin-top: 2px; opacity: 0.75; }

/* ---------------- 富文本 ---------------- */
.rich p { margin: 3px 0; }
.rich ul, .rich ol { padding-left: 18px; margin: 3px 0; }
.rich li { margin: 1px 0; }
.rich strong { font-weight: 600; color: #0f172a; }
.rich em { font-style: italic; }
.rich code {
  background: #f1f5f9;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 0.88em;
  color: #e11d48;
  font-family: ${FONT_STACKS.monospace};
}
.rich pre {
  background: #f8fafc;
  padding: 8px 12px;
  border-radius: 5px;
  border: 1px solid #e2e8f0;
  margin: 6px 0;
  overflow-x: auto;
}
.rich pre code { background: none; padding: 0; color: #334155; }
.rich blockquote {
  border-left: 3px solid ${themeColor};
  padding-left: 10px;
  margin: 5px 0;
  opacity: 0.8;
}
.rich a { color: ${themeColor}; text-decoration: none; }
.rich table { border-collapse: collapse; width: 100%; margin: 6px 0; }
.rich th, .rich td { border: 1px solid #e2e8f0; padding: 4px 8px; text-align: left; }
.rich th { background: #f8fafc; font-weight: 600; }

/* ---------------- 其他 ---------------- */
.empty-hint { opacity: 0.35; font-style: italic; }
.page-empty {
  text-align: center;
  padding: 60px 20px;
  opacity: 0.4;
  font-size: ${baseFontSize + 2}px;
}

/* 分页控制：避免模块标题孤立在页尾 */
.resume-section { break-inside: auto; }
.entry { break-inside: avoid; }
.section-title { break-after: avoid; }
`;
}

module.exports = { renderResumeHtml, paginateSectionsByHeight, escHtml, parseJson, hexToRgba };
