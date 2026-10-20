/**
 * 简历渲染引擎
 * ------------------------------------------------------------------
 * 产品的心脏：把「数据 + 布局配置」渲染为与导出一致的 A4 视觉结果。
 *
 * 设计原则：
 *   1. 纯函数 —— 同一份数据必然渲染出同一结果，便于导出时复用
 *   2. 样式内联 —— 不依赖外部 CSS，避免导出时样式丢失
 *   3. 三级样式覆盖 —— 模板默认 < 全局布局 < 模块级 _config
 *   4. 分页友好 —— 模块标题与内容绑定，避免标题孤立在页尾
 *
 * 与 export-service/src/renderer.js 的规则保持同步。
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  normalizeSectionData,
  type LayoutConfig,
  type ResumeDetail,
  type ResumeItem,
  type ResumeSection,
  type SectionConfig,
  type SkillGroup,
  type TemplateConfig,
} from '../../types/resume';
import { SECTION_META } from '../../constants/sections';
import RichText from './RichText';
import { brand, fontOptions, fontSize as fs, neutral, radius } from '../../styles/tokens';

// ==================================================================
// 常量
// ==================================================================

const FONT_STACKS: Record<string, string> = Object.fromEntries(
  fontOptions.map((f) => [f.value, f.stack])
);

export const DEFAULT_LAYOUT: Required<
  Pick<
    LayoutConfig,
    | 'globalFontSize'
    | 'globalLineSpacing'
    | 'globalFontFamily'
    | 'pageTopMargin'
    | 'pageBottomMargin'
    | 'pageLeftMargin'
    | 'pageRightMargin'
    | 'moduleMargin'
    | 'titleTopPadding'
    | 'titleBottomMargin'
    | 'headerStyle'
  >
> = {
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
};

export function parseLayout(raw: string | undefined | null): LayoutConfig {
  if (!raw) return { ...DEFAULT_LAYOUT };
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? { ...DEFAULT_LAYOUT, ...parsed }
      : { ...DEFAULT_LAYOUT };
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

/** 版式：正文分栏策略 */
export type ResumeLayoutMode = 'single-column' | 'two-column' | 'sidebar';

/** 侧边栏版式时放在左窄栏的模块类型 */
const SIDEBAR_TYPES = new Set(['skills', 'awards', 'certificates', 'custom']);

/**
 * 按版式把正文模块分成主栏 / 副栏。
 * - single-column：全部主栏
 * - two-column：明确指定 left/right 的模块固定分栏，其余按内容高度平衡
 * - sidebar：技能/奖项/证书进侧栏，其余进主栏
 */
export function splitSectionsByLayout<
  T extends { sectionType: string; sortOrder: number; layout?: string; data?: unknown }
>(sections: T[], mode: ResumeLayoutMode): { main: T[]; side: T[] } {
  const sorted = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
  if (mode === 'sidebar') {
    const main: T[] = [];
    const side: T[] = [];
    for (const s of sorted) {
      if (s.layout === 'left' || (s.layout !== 'right' && SIDEBAR_TYPES.has(s.sectionType))) side.push(s);
      else main.push(s);
    }
    return { main, side };
  }
  if (mode === 'two-column') {
    return { main: sorted, side: [] };
  }
  return { main: sorted, side: [] };
}

export function paginateSectionsByHeight<
  T extends { layout?: string; sectionType?: string }
>(
  sections: T[],
  options: {
    mode?: ResumeLayoutMode;
    firstPageCapacity: number;
    columnCapacity: number;
    heightFor: (section: T, column: 'main' | 'side') => number;
  }
): { main: T[]; side: T[] }[] {
  const { mode = 'two-column', firstPageCapacity, columnCapacity, heightFor } = options;
  const pages: { main: T[]; side: T[]; mainHeight: number; sideHeight: number }[] = [];
  const ensurePage = (index: number) => {
    while (pages.length <= index) pages.push({ main: [], side: [], mainHeight: 0, sideHeight: 0 });
    return pages[index];
  };
  const fits = (pageIndex: number, column: 'main' | 'side', height: number) => {
    const page = ensurePage(pageIndex);
    const used = column === 'main' ? page.mainHeight : page.sideHeight;
    const capacity = pageIndex === 0 ? firstPageCapacity : columnCapacity;
    // A module taller than a full page must still be placed once; otherwise
    // searching for a page that fits it never terminates.
    if (used === 0) return height <= capacity || height > columnCapacity;
    return used + height <= capacity;
  };
  const place = (pageIndex: number, column: 'main' | 'side', section: T, height: number) => {
    const page = ensurePage(pageIndex);
    page[column].push(section);
    if (column === 'main') page.mainHeight += height;
    else page.sideHeight += height;
  };

  if (mode !== 'two-column') {
    const nextPage = { main: 0, side: 0 };
    for (const section of sections) {
      const column = mode === 'sidebar' && (section.layout === 'left'
        || (section.layout !== 'right' && SIDEBAR_TYPES.has(section.sectionType || ''))) ? 'side' : 'main';
      const height = Math.max(1, Number(heightFor(section, column)) || 1);
      while (!fits(nextPage[column], column, height)) nextPage[column] += 1;
      place(nextPage[column], column, section, height);
    }
    return pages.map(({ main, side }) => ({ main, side }));
  }
  const manualPages = { main: 0, side: 0 };
  let flowPage = 0;
  let flowColumn: 'main' | 'side' = 'main';
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

function estimateSectionHeight(
  section: ResumeSection,
  options: { fontSize: number; lineHeight: number; moduleMargin: number; columnWidth: number }
): number {
  const data = normalizeSectionData(section.data);
  const config = (data._config || {}) as SectionConfig;
  const contentSize = Number(config.contentFontSize || options.fontSize);
  const linePx = contentSize * Number(config.lineSpacing || options.lineHeight);
  const charsPerLine = Math.max(12, Math.floor(options.columnWidth / Math.max(8, contentSize * 0.9)));
  const lines = (value: unknown) => {
    const text = typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ') : '';
    return text ? Math.max(1, Math.ceil(text.length / charsPerLine)) : 0;
  };
  const items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
  let contentHeight = 0;
  if (section.sectionType === 'skills') {
    const text = items.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join(' ');
    contentHeight = Math.max(linePx * 1.8, Math.ceil(text.length / Math.max(10, Math.floor(options.columnWidth / (contentSize * 4.5)))) * contentSize * 2.2);
  } else if (items.length) {
    contentHeight = items.reduce((sum, item) => {
      if (typeof item === 'string') return sum + lines(item) * linePx + 5;
      if (!item || typeof item !== 'object') return sum + linePx;
      const record = item as Record<string, unknown>;
      const intro = ['title', 'company', 'school', 'name', 'subtitle', 'position', 'degree', 'major', 'date', 'startDate', 'endDate', 'tech']
        .map((key) => record[key]).filter((value): value is string => typeof value === 'string').join(' ');
      const body = [record.description, record.content, record.bullets]
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .filter((value): value is string => typeof value === 'string')
        .reduce((count, value) => count + lines(value), 0);
      return sum + Math.max(22, lines(intro) * linePx) + body * linePx + 12;
    }, 0);
  } else {
    contentHeight = lines(data.content) * linePx;
  }
  const titleHeight = config.hideTitle ? 0 : Number(config.titleFontSize || options.fontSize + 2) * 1.4 + 12;
  return Math.max(linePx, titleHeight + contentHeight + options.moduleMargin);
}

function estimateHeaderHeight(basicSection: ResumeSection | undefined, resume: ResumeDetail, fontSize: number): number {
  const data = basicSection ? normalizeSectionData(basicSection.data) : {};
  const contacts = ['phone', 'email', 'city', 'website'].filter((key) => data[key]).length
    + (Array.isArray(data.links) ? data.links.length : 0);
  const nameSize = Number((data._config as SectionConfig | undefined)?.titleFontSize || fontSize + 8) + 12;
  return Math.ceil(nameSize * 1.25 + (data.jobTitle || resume.targetJob ? fontSize + 13 : 0) + (contacts ? fontSize * 1.7 + 8 : 0) + 20);
}

function fontStack(name?: string): string {
  if (!name) return FONT_STACKS['system-ui'];
  return FONT_STACKS[name] ?? `${name}, ${FONT_STACKS['system-ui']}`;
}

/** 标题装饰样式 */
function titleStyle(style: string, color: string, accent: string): React.CSSProperties {
  switch (style) {
    case 'bar':
      return {
        borderLeft: `4px solid ${color}`,
        paddingLeft: 10,
        paddingBottom: 2,
      };
    case 'pill':
      return {
        display: 'inline-block',
        background: accent,
        borderRadius: radius.pill,
        padding: '2px 14px',
      };
    case 'solid':
      return {
        display: 'inline-block',
        background: color,
        color: '#fff',
        padding: '3px 12px',
        borderRadius: radius.xs,
      };
    case 'plain':
      return {};
    case 'underline':
    default:
      return { borderBottom: `2px solid ${color}`, paddingBottom: 4 };
  }
}

/** 空模块提示 */
function EmptyHint({ fontSize, color }: { fontSize: number; color: string }) {
  return (
    <div style={{ fontSize: fontSize - 1, color, opacity: 0.32, fontStyle: 'italic' }}>
      待填写
    </div>
  );
}

// ==================================================================
// 单条目渲染（经历 / 教育 / 项目）
// ==================================================================

interface Ctx {
  titleSize: number;
  contentSize: number;
  titleColor: string;
  textColor: string;
  lineHeight: number;
  align: 'left' | 'center' | 'right';
}

function EntryBlock({ item, ctx }: { item: ResumeItem; ctx: Ctx }) {
  const title =
    item.title || item.company || item.school || item.name || item.institution || '';
  const subtitle =
    item.subtitle || item.position || item.degree || item.role || item.major || '';
  const start = item.startDate || '';
  const end = item.endDate || (item.current ? '至今' : '');
  const dateStr = start || end ? `${start}${start && end ? ' — ' : ''}${end}` : '';
  const meta = [subtitle, item.major && subtitle !== item.major ? item.major : '']
    .filter(Boolean)
    .join(' · ');
  const bullets = (item.bullets || []).filter((b) => b && b.trim());

  return (
    <div style={{ marginBottom: 13, breakInside: 'avoid' }}>
      {/* 标题行：左侧机构/职位，右侧时间 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: ctx.titleSize,
              fontWeight: 600,
              color: ctx.titleColor,
              lineHeight: 1.4,
            }}
          >
            {title}
          </span>
          {meta && (
            <span style={{ fontSize: ctx.contentSize - 1, color: ctx.textColor, opacity: 0.72 }}>
              {meta}
            </span>
          )}
        </div>
        {dateStr && (
          <span
            style={{
              fontSize: ctx.contentSize - 2,
              color: ctx.textColor,
              opacity: 0.5,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {dateStr}
          </span>
        )}
      </div>

      {/* 技术栈 */}
      {item.tech && (
        <div
          style={{
            marginTop: 3,
            fontSize: ctx.contentSize - 2,
            color: ctx.titleColor,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: ctx.contentSize - 3,
              padding: '0 6px',
              borderRadius: radius.xs,
              background: `${ctx.titleColor}14`,
              lineHeight: 1.6,
            }}
          >
            技术栈
          </span>
          <span>{item.tech}</span>
        </div>
      )}

      {/* 要点列表 */}
      {bullets.length > 0 && (
        <ul style={{ margin: '4px 0 0', paddingLeft: 17, listStyle: 'disc' }}>
          {bullets.map((b, i) => (
            <li
              key={i}
              style={{
                margin: '2px 0',
                fontSize: ctx.contentSize - 1,
                lineHeight: ctx.lineHeight,
                color: ctx.textColor,
              }}
            >
              <RichText content={b} inline fontSize={ctx.contentSize - 1} color={ctx.textColor} />
            </li>
          ))}
        </ul>
      )}

      {/* 无要点时回退到描述字段 */}
      {bullets.length === 0 && item.description && (
        <RichText
          content={item.description}
          fontSize={ctx.contentSize - 1}
          lineHeight={ctx.lineHeight}
          color={ctx.textColor}
        />
      )}
    </div>
  );
}

// ==================================================================
// 各模块内容
// ==================================================================

function SectionContent({
  section,
  ctx,
}: {
  section: ResumeSection;
  ctx: Ctx;
}) {
  const data = normalizeSectionData(section.data);

  switch (section.sectionType) {
    // ---------- 个人总结 / 自定义 ----------
    case 'summary':
    case 'custom':
      return data.content ? (
        <RichText
          content={String(data.content)}
          fontSize={ctx.contentSize - 1}
          lineHeight={ctx.lineHeight}
          color={ctx.textColor}
        />
      ) : (
        <EmptyHint fontSize={ctx.contentSize} color={ctx.textColor} />
      );

    // ---------- 技能 ----------
    case 'skills': {
      const items = (data.items || []) as (string | SkillGroup)[];
      if (!items.length) return <EmptyHint fontSize={ctx.contentSize} color={ctx.textColor} />;

      // 分组式：每项是 { name, items[] }，适合「语言 / 框架 / 中间件」分类
      const grouped = items.some(
        (i) => i && typeof i === 'object' && ((i as SkillGroup).name || (i as SkillGroup).category)
      );

      if (!grouped) {
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {items.map((s, i) => (
              <span
                key={i}
                style={{
                  padding: '2px 11px',
                  borderRadius: radius.xs,
                  border: `1px solid ${ctx.titleColor}40`,
                  background: `${ctx.titleColor}0F`,
                  color: ctx.titleColor,
                  fontSize: ctx.contentSize - 1,
                  fontWeight: 500,
                  lineHeight: 1.7,
                }}
              >
                {String(s)}
              </span>
            ))}
          </div>
        );
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((raw, i) => {
            const g = raw as SkillGroup;
            if (!g || typeof g !== 'object') return null;
            const name = g.name || g.category || '';
            const list = Array.isArray(g.items)
              ? g.items
              : String(g.value || '')
                  .split(/[,，、|]/)
                  .filter(Boolean);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                {name && (
                  <span
                    style={{
                      fontSize: ctx.contentSize - 1,
                      fontWeight: 600,
                      color: ctx.titleColor,
                      minWidth: 76,
                      flexShrink: 0,
                    }}
                  >
                    {name}
                  </span>
                )}
                <span
                  style={{
                    fontSize: ctx.contentSize - 1,
                    color: ctx.textColor,
                    lineHeight: ctx.lineHeight,
                  }}
                >
                  {list.join(' · ')}
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    // ---------- 奖项 / 证书 ----------
    case 'awards':
    case 'certificates': {
      const items = (data.items || []) as ResumeItem[];
      if (!items.length) return <EmptyHint fontSize={ctx.contentSize} color={ctx.textColor} />;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {items.map((item, i) => (
            <div key={i} style={{ breakInside: 'avoid' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span
                  style={{
                    fontSize: ctx.contentSize - 1,
                    fontWeight: 500,
                    color: ctx.titleColor,
                  }}
                >
                  {item.title || item.name}
                </span>
                {item.level && (
                  <span
                    style={{ fontSize: ctx.contentSize - 2, color: ctx.titleColor, opacity: 0.75 }}
                  >
                    {item.level}
                  </span>
                )}
                {(item.date || item.startDate) && (
                  <span
                    style={{
                      fontSize: ctx.contentSize - 2,
                      color: ctx.textColor,
                      opacity: 0.55,
                      marginLeft: 'auto',
                    }}
                  >
                    {item.date || item.startDate}
                  </span>
                )}
              </div>
              {item.description && (
                <div
                  style={{
                    marginTop: 2,
                    fontSize: ctx.contentSize - 2,
                    color: ctx.textColor,
                    opacity: 0.78,
                    lineHeight: ctx.lineHeight,
                  }}
                >
                  {item.description}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    // ---------- 列表型：经历 / 教育 / 项目 ----------
    default: {
      const items = (data.items || []) as ResumeItem[];
      if (!items.length) return <EmptyHint fontSize={ctx.contentSize} color={ctx.textColor} />;
      return (
        <>
          {items.map((item, i) => (
            <EntryBlock key={i} item={item} ctx={ctx} />
          ))}
        </>
      );
    }
  }
}

// ==================================================================
// 头部（基本信息）
// ==================================================================

function ResumeHeader({
  data,
  ctx,
  fallbackTitle,
  targetJob,
  targetCompany,
}: {
  data: Record<string, unknown>;
  ctx: Ctx;
  fallbackTitle: string;
  targetJob?: string;
  targetCompany?: string;
}) {
  const name = String(data.name || '');
  const jobTitle = String(data.jobTitle || '');
  const contacts: { icon: string; text: string }[] = [];
  if (data.phone) contacts.push({ icon: '☎', text: String(data.phone) });
  if (data.email) contacts.push({ icon: '✉', text: String(data.email) });
  if (data.city) contacts.push({ icon: '⌂', text: String(data.city) });
  if (data.website) contacts.push({ icon: '⌘', text: String(data.website) });
  const links = (data.links || []) as { label?: string; url?: string }[];
  links.forEach((l) => {
    if (l?.url || l?.label) contacts.push({ icon: '🔗', text: l.label || l.url || '' });
  });

  const isCenter = ctx.align === 'center';

  return (
    <header className="resume-header" style={{ textAlign: ctx.align, marginBottom: 20 }}>
      <div
        style={{
          fontSize: ctx.titleSize + 12,
          fontWeight: 700,
          color: ctx.titleColor,
          lineHeight: 1.25,
          letterSpacing: 0.5,
        }}
      >
        {name || fallbackTitle}
      </div>
      {(jobTitle || targetJob) && (
        <div
          style={{
            fontSize: ctx.contentSize + 1,
            color: ctx.titleColor,
            opacity: 0.82,
            marginTop: 4,
            fontWeight: 500,
          }}
        >
          {jobTitle || targetJob}
          {targetCompany && !jobTitle ? ` · ${targetCompany}` : ''}
        </div>
      )}
      {contacts.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '5px 18px',
            justifyContent: isCenter ? 'center' : ctx.align === 'right' ? 'flex-end' : 'flex-start',
            marginTop: 8,
            fontSize: ctx.contentSize - 1,
            color: ctx.textColor,
            opacity: 0.78,
          }}
        >
          {contacts.map((c, i) => (
            <span key={i} style={{ whiteSpace: 'nowrap' }}>
              <span style={{ marginRight: 4, opacity: 0.7 }}>{c.icon}</span>
              {c.text}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}

// ==================================================================
// 主组件
// ==================================================================

interface ResumePreviewProps {
  resume: ResumeDetail;
  templateConfig?: TemplateConfig;
  /** 缩放比例，用于编辑器内的自适应预览 */
  scale?: number;
}

export default function ResumePreviewEngine({
  resume,
  templateConfig,
  scale = 1,
}: ResumePreviewProps) {
  const documentRef = useRef<HTMLDivElement>(null);
  const sectionNodesRef = useRef(new Map<string, HTMLElement>());
  const [measuredPlacements, setMeasuredPlacements] = useState<{ main: string[]; side: string[] }[] | null>(null);
  const layout = parseLayout(resume.layoutConfig);

  const themeColor =
    templateConfig?.primaryColor || layout.themeColor || resume.themeColor || brand.primary;
  const accentColor = templateConfig?.accentColor || `${themeColor}12`;
  const headerStyle = templateConfig?.headerStyle || layout.headerStyle || 'underline';

  const baseFontSize = layout.globalFontSize ?? DEFAULT_LAYOUT.globalFontSize;
  const baseLineHeight = layout.globalLineSpacing ?? DEFAULT_LAYOUT.globalLineSpacing;

  const sections = [...(resume.sections || [])]
    .filter((s) => s.isVisible !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const basicSection = sections.find((s) => s.sectionType === 'basic');
  const bodySections = sections.filter((s) => s.sectionType !== 'basic');

  const layoutMode: ResumeLayoutMode =
    (layout.layout as ResumeLayoutMode) || (templateConfig?.layout as ResumeLayoutMode) || 'single-column';

  const globalCtx: Ctx = {
    titleSize: baseFontSize + 2,
    contentSize: baseFontSize,
    titleColor: themeColor,
    textColor: neutral[700],
    lineHeight: baseLineHeight,
    align: 'left',
  };

  const basicData = basicSection ? normalizeSectionData(basicSection.data) : {};
  const basicCfg = (basicData._config || {}) as SectionConfig;
  const pageHeight = 1123;
  const pageCapacity = Math.max(120, pageHeight - (layout.pageTopMargin ?? 44) - (layout.pageBottomMargin ?? 44));
  const columnGap = Math.round((layout.moduleMargin ?? 20) * 0.9) + 10;
  const contentWidth = 794 - (layout.pageLeftMargin ?? 52) - (layout.pageRightMargin ?? 52);
  const availableColumnWidth = contentWidth - columnGap;
  const mainColumnWidth = layoutMode === 'single-column' ? contentWidth
    : layoutMode === 'sidebar' ? contentWidth - 210 - (columnGap - 2) : availableColumnWidth * 1.15 / 2;
  const sideColumnWidth = layoutMode === 'sidebar' ? 210 - 15 : availableColumnWidth * 0.85 / 2 - 15;
  const estimatedPages = paginateSectionsByHeight(bodySections, {
    mode: layoutMode,
    firstPageCapacity: Math.max(120, pageCapacity - estimateHeaderHeight(basicSection, resume, baseFontSize)),
    columnCapacity: pageCapacity,
    heightFor: (section, column) => estimateSectionHeight(section, {
      fontSize: baseFontSize,
      lineHeight: baseLineHeight,
      moduleMargin: layout.moduleMargin ?? 20,
      columnWidth: column === 'side' ? sideColumnWidth : mainColumnWidth,
    }),
  });
  useLayoutEffect(() => {
    const root = documentRef.current;
    const firstPaper = root?.querySelector<HTMLElement>('.resume-paper');
    const mainColumn = firstPaper?.querySelector<HTMLElement>('[data-resume-column="main"]');
    const sideColumn = firstPaper?.querySelector<HTMLElement>('[data-resume-column="side"]');
    if (!root || !firstPaper || !mainColumn) return;
    if (bodySections.some((section) => !sectionNodesRef.current.has(section.id))) return;

    const innerWidth = (column: HTMLElement) => {
      const style = getComputedStyle(column);
      return column.clientWidth - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0');
    };
    const mainWidth = innerWidth(mainColumn);
    const sideWidth = sideColumn ? innerWidth(sideColumn) : mainWidth;
    const rootStyle = getComputedStyle(root);
    const probe = document.createElement('div');
    Object.assign(probe.style, {
      position: 'fixed',
      left: '-100000px',
      top: '0',
      width: '794px',
      padding: '0',
      margin: '0',
      visibility: 'hidden',
      pointerEvents: 'none',
      fontFamily: rootStyle.fontFamily,
      fontSize: rootStyle.fontSize,
      fontWeight: rootStyle.fontWeight,
      lineHeight: rootStyle.lineHeight,
      color: rootStyle.color,
    });
    document.body.appendChild(probe);

    const measure = (section: ResumeSection, width: number) => {
      const source = sectionNodesRef.current.get(section.id)!;
      const clone = source.cloneNode(true) as HTMLElement;
      clone.style.width = `${width}px`;
      probe.appendChild(clone);
      const style = getComputedStyle(clone);
      const height = clone.getBoundingClientRect().height
        + parseFloat(style.marginTop || '0')
        + parseFloat(style.marginBottom || '0');
      clone.remove();
      return height;
    };

    const measured = bodySections.map((section) => ({
      section,
      mainHeight: measure(section, mainWidth),
      sideHeight: measure(section, sideWidth),
    }));
    probe.remove();

    const header = firstPaper.querySelector<HTMLElement>('.resume-header');
    const headerHeight = header
      ? header.offsetHeight + parseFloat(getComputedStyle(header).marginBottom || '0')
      : 0;
    const exactCapacity = Math.max(1, 1122.52 - (layout.pageTopMargin ?? 44) - (layout.pageBottomMargin ?? 44) - 8);
    const heightsById = new Map(measured.map((item) => [item.section.id, item]));
    const exactPages = paginateSectionsByHeight(
      bodySections,
      {
        mode: layoutMode,
        firstPageCapacity: Math.max(1, exactCapacity - headerHeight),
        columnCapacity: exactCapacity,
        heightFor: (section, column) => {
          const item = heightsById.get(section.id);
          return column === 'side' ? item?.sideHeight || 1 : item?.mainHeight || 1;
        },
      },
    ).map((page) => ({
      main: page.main.map((section) => section.id),
      side: page.side.map((section) => section.id),
    }));
    setMeasuredPlacements((current) => JSON.stringify(current) === JSON.stringify(exactPages) ? current : exactPages);
  }, [
    resume.sections,
    resume.title,
    resume.targetJob,
    resume.targetCompany,
    headerStyle,
    layoutMode,
    layout.pageTopMargin,
    layout.pageBottomMargin,
    layout.pageLeftMargin,
    layout.pageRightMargin,
    layout.globalFontFamily,
    layout.moduleMargin,
    layout.titleTopPadding,
    layout.titleBottomMargin,
    baseFontSize,
    baseLineHeight,
  ]);

  const sectionsById = new Map(bodySections.map((section) => [section.id, section]));
  const measuredPages = measuredPlacements?.map((page) => ({
    main: page.main.flatMap((id) => sectionsById.has(id) ? [sectionsById.get(id)!] : []),
    side: page.side.flatMap((id) => sectionsById.has(id) ? [sectionsById.get(id)!] : []),
  }));
  const measuredPagesMatch = measuredPages?.reduce((count, page) => count + page.main.length + page.side.length, 0)
    === bodySections.length;
  const bodyPages = measuredPagesMatch ? measuredPages : estimatedPages;
  if (!bodyPages.length) bodyPages.push({ main: [], side: [] });

  const bindSectionNode = (sectionId: string) => (node: HTMLElement | null) => {
    if (node) sectionNodesRef.current.set(sectionId, node);
    else sectionNodesRef.current.delete(sectionId);
  };

  const renderSection = (section: ResumeSection) => {
    const data = normalizeSectionData(section.data);
    const cfg = (data._config || {}) as SectionConfig;
    const sectionCtx: Ctx = {
      titleSize: cfg.titleFontSize ?? (cfg.contentFontSize ? cfg.contentFontSize + 2 : baseFontSize + 2),
      contentSize: cfg.contentFontSize ?? baseFontSize,
      titleColor: cfg.titleColor ?? themeColor,
      textColor: cfg.textColor ?? neutral[700],
      lineHeight: cfg.lineSpacing ?? baseLineHeight,
      align: cfg.textAlign ?? 'left',
    };
    const moduleName = cfg.moduleName ?? SECTION_META[section.sectionType]?.label ?? section.sectionType;
    const resolvedTitleStyle = cfg.titleStyle || headerStyle;

    if (cfg.hideTitle) {
      return (
        <section key={section.id} ref={bindSectionNode(section.id)} data-section-id={section.id} data-layout={section.layout || 'auto'} style={{ marginBottom: layout.moduleMargin, breakInside: 'auto' }}>
          <SectionContent section={section} ctx={sectionCtx} />
        </section>
      );
    }

    return (
      <section key={section.id} ref={bindSectionNode(section.id)} data-section-id={section.id} data-layout={section.layout || 'auto'} style={{ marginBottom: layout.moduleMargin, breakInside: 'auto' }}>
        <h2
          style={{
            fontSize: sectionCtx.titleSize,
            fontWeight: 600,
            color: sectionCtx.titleColor,
            margin: 0,
            marginTop: layout.titleTopPadding,
            marginBottom: layout.titleBottomMargin,
            lineHeight: 1.4,
            letterSpacing: 0.3,
            breakAfter: 'avoid',
            ...titleStyle(resolvedTitleStyle, sectionCtx.titleColor, accentColor),
          }}
        >
          {moduleName}
        </h2>
        <div style={{ textAlign: sectionCtx.align }}>
          <SectionContent section={section} ctx={sectionCtx} />
        </div>
      </section>
    );
  };

  return (
    <div
      ref={documentRef}
      className="resume-document"
      style={{
        fontFamily: fontStack(layout.globalFontFamily),
        fontSize: baseFontSize,
        lineHeight: baseLineHeight,
        color: neutral[700],
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'top center',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {bodyPages.map((page, pageIndex) => (
        <div
          key={pageIndex}
          className="resume-paper"
          data-page={pageIndex + 1}
          style={{
            width: 794,
            minHeight: pageHeight,
            flexShrink: 0,
            boxSizing: 'border-box',
            padding: `${layout.pageTopMargin}px ${layout.pageRightMargin}px ${layout.pageBottomMargin}px ${layout.pageLeftMargin}px`,
          }}
        >
          {pageIndex === 0 && (
            <ResumeHeader
              data={basicData as Record<string, unknown>}
              ctx={{
                titleSize: basicCfg.titleFontSize ?? baseFontSize + 8,
                contentSize: basicCfg.contentFontSize ?? baseFontSize,
                titleColor: basicCfg.titleColor ?? themeColor,
                textColor: basicCfg.textColor ?? neutral[700],
                lineHeight: baseLineHeight,
                align: basicCfg.textAlign ?? 'center',
              }}
              fallbackTitle={resume.title || '个人简历'}
              targetJob={resume.targetJob}
              targetCompany={resume.targetCompany}
            />
          )}
          {sections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 24px', color: neutral[400], fontSize: baseFontSize + 2 }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.35 }}>📄</div>
              在左侧添加简历模块，开始构建你的简历
            </div>
          ) : (
            <BodyColumns
              mode={layoutMode}
              main={page.main}
              side={page.side}
              layout={layout}
              baseFontSize={baseFontSize}
              themeColor={themeColor}
              accentColor={accentColor}
              headerStyle={headerStyle}
            >
              {renderSection}
            </BodyColumns>
          )}
        </div>
      ))}
    </div>
  );
}

/** 版式容器：单栏纵排 / 双栏网格 / 侧边栏 */
function BodyColumns({
  mode,
  main,
  side,
  layout,
  baseFontSize,
  themeColor,
  accentColor,
  headerStyle,
  children,
}: {
  mode: ResumeLayoutMode;
  main: ResumeSection[];
  side: ResumeSection[];
  layout: LayoutConfig;
  baseFontSize: number;
  themeColor: string;
  accentColor: string;
  headerStyle: string;
  children: (section: ResumeSection) => ReactNode;
}) {
  const gap = Math.round((layout.moduleMargin ?? 20) * 0.9);

  if (mode === 'single-column') {
    return <div data-resume-column="main">{main.map((s) => children(s))}</div>;
  }

  if (mode === 'sidebar') {
    return (
      <div data-resume-columns="sidebar" style={{ display: 'grid', gridTemplateColumns: '210px minmax(0, 1fr)', gap: gap + 8, alignItems: 'start' }}>
        <aside data-resume-column="side" style={{ borderRight: `1px solid ${themeColor}22`, paddingRight: 14 }}>
          {side.map((s) => children(s))}
        </aside>
        <div data-resume-column="main">{main.map((s) => children(s))}</div>
      </div>
    );
  }

  // two-column
  return (
    <div data-resume-columns="two-column" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)', gap: gap + 10, alignItems: 'start' }}>
      <div data-resume-column="main">{main.map((s) => children(s))}</div>
      <div data-resume-column="side" style={{ borderLeft: `1px solid ${themeColor}18`, paddingLeft: 14 }}>
        {side.map((s) => children(s))}
      </div>
    </div>
  );
}
