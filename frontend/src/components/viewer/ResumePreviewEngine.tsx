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
import type { ReactNode } from 'react';
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
 * - two-column：前半主栏、后半副栏（保证左右视觉平衡）
 * - sidebar：技能/奖项/证书进侧栏，其余进主栏
 */
export function splitSectionsByLayout<
  T extends { sectionType: string; sortOrder: number }
>(sections: T[], mode: ResumeLayoutMode): { main: T[]; side: T[] } {
  const sorted = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
  if (mode === 'sidebar') {
    const main: T[] = [];
    const side: T[] = [];
    for (const s of sorted) {
      if (SIDEBAR_TYPES.has(s.sectionType)) side.push(s);
      else main.push(s);
    }
    return { main, side };
  }
  if (mode === 'two-column') {
    // 后 40% 的模块进副栏（至少 1 个，至多一半）
    const n = sorted.length;
    const sideCount = Math.max(1, Math.min(Math.floor(n * 0.4), Math.ceil(n / 2)));
    return { main: sorted.slice(0, n - sideCount), side: sorted.slice(n - sideCount) };
  }
  return { main: sorted, side: [] };
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
    <header style={{ textAlign: ctx.align, marginBottom: 20 }}>
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
    (templateConfig?.layout as ResumeLayoutMode) || (layout.layout as ResumeLayoutMode) || 'single-column';
  const { main: bodyMain, side: bodySide } = splitSectionsByLayout(bodySections, layoutMode);

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

  return (
    <div
      className="resume-paper"
      style={{
        fontFamily: fontStack(layout.globalFontFamily),
        fontSize: baseFontSize,
        lineHeight: baseLineHeight,
        color: neutral[700],
        padding: `${layout.pageTopMargin}px ${layout.pageRightMargin}px ${layout.pageBottomMargin}px ${layout.pageLeftMargin}px`,
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'top center',
      }}
    >
      {/* ---------- 头部 ---------- */}
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

      {/* ---------- 正文模块（按版式分栏） ---------- */}
      {sections.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 24px',
            color: neutral[400],
            fontSize: baseFontSize + 2,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.35 }}>📄</div>
          在左侧添加简历模块，开始构建你的简历
        </div>
      ) : (
        <BodyColumns mode={layoutMode} main={bodyMain} side={bodySide} layout={layout} baseFontSize={baseFontSize} themeColor={themeColor} accentColor={accentColor} headerStyle={headerStyle}>
          {(section) => {
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
          const moduleName =
            cfg.moduleName ?? SECTION_META[section.sectionType]?.label ?? section.sectionType;
          const resolvedTitleStyle = cfg.titleStyle || headerStyle;

          if (cfg.hideTitle) {
            return (
              <section key={section.id} style={{ marginBottom: layout.moduleMargin }}>
                <SectionContent section={section} ctx={sectionCtx} />
              </section>
            );
          }

          return (
            <section
              key={section.id}
              style={{ marginBottom: layout.moduleMargin, breakInside: 'auto' }}
            >
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
          }}
        </BodyColumns>
      )}
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

  if (mode === 'single-column' || (!side.length && mode !== 'two-column')) {
    return <div>{main.map((s) => children(s))}</div>;
  }

  if (mode === 'sidebar') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: gap + 8, alignItems: 'start' }}>
        <aside style={{ borderRight: `1px solid ${themeColor}22`, paddingRight: 14 }}>
          {side.map((s) => children(s))}
          {side.length === 0 && (
            <div style={{ color: neutral[400], fontSize: baseFontSize - 1, lineHeight: 1.6 }}>
              将技能、奖项等模块移入可形成侧栏
            </div>
          )}
        </aside>
        <div>{main.map((s) => children(s))}</div>
      </div>
    );
  }

  // two-column
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: gap + 10, alignItems: 'start' }}>
      <div>{main.map((s) => children(s))}</div>
      <div style={{ borderLeft: `1px solid ${themeColor}18`, paddingLeft: 14 }}>
        {side.map((s) => children(s))}
      </div>
    </div>
  );
}
