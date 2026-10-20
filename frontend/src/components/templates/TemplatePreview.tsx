/**
 * 模板版式预览
 * ------------------------------------------------------------------
 * 用轻量 DOM 绘制真实范文节选与版式差异；
 * 缺少有效范文时使用明确标注的版式骨架。
 */
import type { CSSProperties } from 'react';
import type { ResumeItem, TemplateConfig, TemplateSample } from '../../types/resume';
import { SECTION_META } from '../../constants/sections';
import { sampleExcerpt } from '../../utils/templateSample';
import { brand, neutral, radius } from '../../styles/tokens';
import { backgroundColorFor } from '../../utils/thumbnail';

interface Props {
  config: TemplateConfig;
  sample?: TemplateSample | null;
  width?: number;
}

/** Lightweight excerpts: pagination and full rich text are only mounted in the modal. */
export default function TemplatePreview({ config, sample, width = 224 }: Props) {
  if (!sample) return <LegacyTemplatePreview config={config} width={width} />;
  const accent = config.primaryColor || brand.primary;
  const soft = config.accentColor || backgroundColorFor(accent, 0.08);
  const mode = config.layout || 'single-column';
  const sections = [...sample.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const basic = sections.find((section) => section.sectionType === 'basic')?.data || {};
  const body = sections.filter((section) => section.sectionType !== 'basic');
  const main: typeof body = [];
  const side: typeof body = [];
  body.forEach((section, index) => {
    const inSide = mode === 'sidebar'
      ? section.layout === 'left' || (section.layout !== 'right' && ['skills', 'awards', 'certificates', 'custom'].includes(section.sectionType))
      : mode === 'two-column' && (section.layout === 'right' || (section.layout === 'auto' && index >= Math.ceil(body.length / 2)));
    (inSide ? side : main).push(section);
  });
  const titleDecoration = (style = config.headerStyle || 'underline'): CSSProperties => {
    if (style === 'bar') return { borderLeft: `4px solid ${accent}`, paddingLeft: 8 };
    if (style === 'pill') return { background: soft, borderRadius: 18, padding: '2px 10px', display: 'inline-block' };
    if (style === 'solid') return { background: accent, color: '#fff', padding: '2px 9px', display: 'inline-block' };
    if (style === 'plain') return {};
    return { borderBottom: `2px solid ${accent}`, paddingBottom: 4 };
  };
  const renderSection = (section: typeof body[number]) => {
    const { data } = section;
    const cfg = data._config || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const item = items[0] as ResumeItem | undefined;
    const title = item && typeof item === 'object' ? item.title || item.company || item.school || item.name : '';
    const bullets = item && typeof item === 'object' && Array.isArray(item.bullets) ? item.bullets : [];
    return (
      <div key={`${section.sectionType}-${section.sortOrder}`} style={{ marginBottom: 19 }}>
        {!cfg.hideTitle && <div style={{ fontSize: 16, fontWeight: 700, color: accent, marginBottom: 7, ...titleDecoration(cfg.titleStyle) }}>
          {cfg.moduleName || SECTION_META[section.sectionType].label}
        </div>}
        {section.sectionType === 'skills' ? (
          <div style={{ lineHeight: 1.65 }}>
            {items.slice(0, 3).map((skill, index) => {
              if (typeof skill === 'string') return <span key={index}>{skill}{index < Math.min(items.length, 3) - 1 ? ' · ' : ''}</span>;
              const group = skill as { name?: string; category?: string; items?: string[]; value?: string };
              return <div key={index} style={{ marginBottom: 4 }}><b style={{ color: accent }}>{group.name || group.category} </b>{sampleExcerpt(group.items?.join(' · ') || group.value, 70)}</div>;
            })}
          </div>
        ) : data.content ? (
          <p style={{ margin: 0, lineHeight: 1.6 }}>{sampleExcerpt(data.content, mode === 'single-column' ? 160 : 115)}</p>
        ) : (
          <>
            {title && <div style={{ fontWeight: 600, marginBottom: 3 }}>{sampleExcerpt(title, 44)}</div>}
            {item && typeof item === 'object' && <div style={{ color: neutral[500], marginBottom: 5, fontSize: 12 }}>{[item.position || item.role || item.degree || item.major, item.startDate, item.endDate || (item.current ? '至今' : '')].filter(Boolean).join(' · ')}</div>}
            {bullets.length ? <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}><li style={{ lineHeight: 1.6 }}>{sampleExcerpt(bullets[0], mode === 'single-column' ? 140 : 110)}</li></ul>
              : item && typeof item === 'object' && item.description ? <p style={{ margin: 0, lineHeight: 1.6 }}>{sampleExcerpt(item.description, 100)}</p> : null}
          </>
        )}
      </div>
    );
  };
  const scale = width / 600;
  return (
    <div aria-hidden="true" className="template-document-excerpt" style={{ width, height: width * 1.414, background: '#fff', boxShadow: shadowPaper, border: `1px solid ${neutral[200]}`, overflow: 'hidden', flexShrink: 0, textAlign: 'left' }}>
      <div style={{ width: 600, minHeight: 848.4, boxSizing: 'border-box', transform: `scale(${scale})`, transformOrigin: 'top left', padding: '32px 36px', fontFamily: config.fonts?.[0] || "'Microsoft YaHei', sans-serif", fontSize: 14, color: neutral[700], lineHeight: 1.5 }}>
        <header style={{ textAlign: 'center', paddingBottom: 17, marginBottom: 22, borderBottom: `1px solid ${neutral[200]}` }}>
          <div style={{ fontSize: 32, lineHeight: 1.35, fontWeight: 700, color: accent, letterSpacing: 3 }}>{String(basic.name || '')}</div>
          <div style={{ fontSize: 16, marginTop: 4, color: neutral[800] }}>{String(basic.jobTitle || sample.profile.jobTitle)}</div>
          <div style={{ fontSize: 11, color: neutral[500], marginTop: 8 }}>{[basic.city, basic.phone, basic.email].filter((part) => typeof part === 'string' && part).join(' · ')}</div>
        </header>
        {mode === 'single-column' || !side.length ? main.map(renderSection) : (
          <div style={{ display: 'grid', gridTemplateColumns: mode === 'sidebar' ? '168px 1fr' : '1.15fr .85fr', gap: 22, alignItems: 'start' }}>
            {mode === 'sidebar' ? <><aside style={{ borderRight: `1px solid ${accent}30`, paddingRight: 16 }}>{side.map(renderSection)}</aside><div>{main.map(renderSection)}</div></>
              : <><div>{main.map(renderSection)}</div><aside style={{ borderLeft: `1px solid ${accent}30`, paddingLeft: 14 }}>{side.map(renderSection)}</aside></>}
          </div>
        )}
      </div>
    </div>
  );
}

const shadowPaper = '0 3px 14px rgba(15,23,42,0.10)';

function LegacyTemplatePreview({ config, width = 148 }: Props) {
  const accent = config.primaryColor || brand.primary;
  const accentSoft = config.accentColor || backgroundColorFor(accent, 0.1);
  const headerStyle = config.headerStyle || 'underline';
  const layout = config.layout || 'single-column';

  const height = width * 1.414;

  /** 模块标题（体现 headerStyle 差异） */
  const ModuleTitle = ({ w = '32%' }: { w?: string }) => {
    const base: React.CSSProperties = {
      height: 4.5,
      borderRadius: 2,
      background: accent,
      marginBottom: 5,
      width: w,
    };
    if (headerStyle === 'bar') {
      return (
        <div
          style={{
            borderLeft: `2.5px solid ${accent}`,
            paddingLeft: 4,
            marginBottom: 5,
          }}
        >
          <div style={{ ...base, width: w, marginBottom: 0, opacity: 0.85 }} />
        </div>
      );
    }
    if (headerStyle === 'pill') {
      return (
        <div
          style={{
            width: w,
            height: 8,
            borderRadius: 999,
            background: accentSoft,
            marginBottom: 5,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 3,
          }}
        >
          <div style={{ width: '55%', height: 3, borderRadius: 2, background: accent }} />
        </div>
      );
    }
    if (headerStyle === 'solid') {
      return (
        <div
          style={{
            width: w,
            height: 8,
            borderRadius: 2,
            background: accent,
            marginBottom: 5,
          }}
        />
      );
    }
    if (headerStyle === 'plain') {
      return <div style={{ ...base, opacity: 0.9 }} />;
    }
    // underline（默认）
    return (
      <div style={{ borderBottom: `1.5px solid ${accent}`, width: w, marginBottom: 5 }}>
        <div style={{ height: 3.5, width: '70%', borderRadius: 2, background: accent }} />
      </div>
    );
  };

  /** 文本行 */
  const Lines = ({ count = 3 }: { count?: number }) => (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: `${[100, 92, 74, 86, 66][i % 5]}%`,
            height: 3,
            borderRadius: 2,
            background: neutral[200],
            marginBottom: 3.5,
          }}
        />
      ))}
    </>
  );

  return (
    <div
      style={{
        width,
        height,
        background: '#fff',
        borderRadius: radius.sm,
        border: `1px solid ${neutral[200]}`,
        boxShadow: '0 2px 10px rgba(15,23,42,0.07)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* ---------------- 双栏：左侧色带 + 右侧内容 ---------------- */}
      {layout === 'sidebar' ? (
        <div style={{ display: 'flex', height: '100%' }}>
          {/* 侧栏 */}
          <div
            style={{
              width: '34%',
              background: accentSoft,
              padding: '10px 8px',
              borderRight: `1px solid ${neutral[150]}`,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: accent,
                marginBottom: 7,
              }}
            />
            <div
              style={{
                width: '72%',
                height: 4,
                borderRadius: 2,
                background: accent,
                marginBottom: 8,
              }}
            />
            {[0, 1, 2].map((g) => (
              <div key={g} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    width: '50%',
                    height: 3,
                    borderRadius: 2,
                    background: accent,
                    opacity: 0.7,
                    marginBottom: 4,
                  }}
                />
                <Lines count={2} />
              </div>
            ))}
          </div>

          {/* 主内容 */}
          <div style={{ flex: 1, padding: '10px 9px' }}>
            {[0, 1, 2].map((b) => (
              <div key={b} style={{ marginBottom: 9 }}>
                <div
                  style={{
                    width: b === 0 ? '42%' : '34%',
                    height: 4,
                    borderRadius: 2,
                    background: accent,
                    marginBottom: 5,
                  }}
                />
                <Lines count={b === 1 ? 3 : 2} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* ---------------- 头部 ---------------- */}
          <div
            style={{
              padding: '11px 10px 9px',
              textAlign: layout === 'two-column' ? 'left' : 'center',
              borderBottom:
                layout === 'two-column' ? 'none' : `1px solid ${neutral[150]}`,
              background: backgroundColorFor(accent, 0.05),
            }}
          >
            <div
              style={{
                width: layout === 'two-column' ? '42%' : '48%',
                height: 7,
                borderRadius: 2,
                background: accent,
                marginBottom: 5,
                marginLeft: layout === 'two-column' ? 0 : 'auto',
                marginRight: layout === 'two-column' ? 0 : 'auto',
              }}
            />
            <div
              style={{
                width: layout === 'two-column' ? '58%' : '34%',
                height: 3.5,
                borderRadius: 2,
                background: neutral[300],
                marginLeft: layout === 'two-column' ? 0 : 'auto',
                marginRight: layout === 'two-column' ? 0 : 'auto',
              }}
            />
            {/* 联系方式行 */}
            <div
              style={{
                display: 'flex',
                gap: 5,
                marginTop: 6,
                justifyContent: layout === 'two-column' ? 'flex-start' : 'center',
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 18,
                    height: 3,
                    borderRadius: 2,
                    background: neutral[300],
                  }}
                />
              ))}
            </div>
          </div>

          {/* ---------------- 正文 ---------------- */}
          {layout === 'two-column' ? (
            <div style={{ display: 'flex', flex: 1 }}>
              {/* 左主栏 */}
              <div style={{ flex: 1.7, padding: '9px 8px 9px 10px' }}>
                {[0, 1].map((b) => (
                  <div key={b} style={{ marginBottom: 10 }}>
                    <ModuleTitle w={b === 0 ? '40%' : '46%'} />
                    <Lines count={3} />
                  </div>
                ))}
              </div>
              {/* 右侧栏 */}
              <div
                style={{
                  flex: 1,
                  padding: '9px 10px 9px 8px',
                  borderLeft: `1px solid ${neutral[150]}`,
                  background: backgroundColorFor(accent, 0.03),
                }}
              >
                {[0, 1, 2].map((b) => (
                  <div key={b} style={{ marginBottom: 9 }}>
                    <ModuleTitle w="52%" />
                    <Lines count={2} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '10px', flex: 1 }}>
              {[0, 1, 2].map((b) => (
                <div key={b} style={{ marginBottom: 10 }}>
                  <ModuleTitle w={b === 0 ? '34%' : b === 1 ? '28%' : '44%'} />
                  <Lines count={b === 1 ? 3 : 2} />

                  {/* 技能标签（最后一个模块模拟技能区） */}
                  {b === 2 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          style={{
                            width: 16 + i * 3,
                            height: 7,
                            borderRadius: 2,
                            background: backgroundColorFor(accent, 0.14),
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
