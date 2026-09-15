/**
 * 模板版式预览
 * ------------------------------------------------------------------
 * 用纯 DOM + 模板的 primaryColor 渲染一份抽象简历骨架，
 * 直观展示该模板的版式差异（单栏 / 双栏 / 侧边栏、标题装饰样式）。
 */
import type { TemplateConfig } from '../../types/resume';
import { brand, neutral, radius } from '../../styles/tokens';
import { backgroundColorFor } from '../../utils/thumbnail';

interface Props {
  config: TemplateConfig;
  width?: number;
}

export default function TemplatePreview({ config, width = 148 }: Props) {
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
