/**
 * 简历缩略图
 * ------------------------------------------------------------------
 * 在卡片中用小比例渲染简历的「骨架」，让用户一眼分辨各份简历。
 *
 * 注意：这里不请求完整 section 数据（列表接口不返回），
 * 而是提取简历的元信息（模板配色、目标岗位、更新时间）生成
 * 一份确定性的抽象缩略图 —— 成本极低且视觉稳定。
 */
import type { Resume } from '../../types/resume';
import { brand, neutral, radius } from '../../styles/tokens';
import { backgroundColorFor, hashSeed } from '../../utils/thumbnail';

interface Props {
  resume: Resume;
  width?: number;
}

export default function ResumeThumbnail({ resume, width = 150 }: Props) {
  const seed = hashSeed(resume.id);
  const accent = resume.themeColor || brand.primary;
  const headerBg = backgroundColorFor(accent, 0.08);

  // 基于 seed 决定文本行的宽度分布，使每份简历的缩略图各不相同但稳定
  const lineWidths = generateWidths(seed, 7);

  return (
    <div
      style={{
        width,
        height: width * 1.414, // A4 比例
        background: '#fff',
        borderRadius: radius.sm,
        border: `1px solid ${neutral[200]}`,
        boxShadow: '0 2px 10px rgba(15,23,42,0.07)',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 头部：姓名条 */}
      <div
        style={{
          padding: '9px 10px 8px',
          background: headerBg,
          borderBottom: `1px solid ${neutral[150]}`,
        }}
      >
        <div
          style={{
            width: '46%',
            height: 6,
            borderRadius: 2,
            background: accent,
            marginBottom: 5,
          }}
        />
        <div
          style={{
            width: '68%',
            height: 3,
            borderRadius: 2,
            background: neutral[300],
          }}
        />
      </div>

      {/* 正文骨架 */}
      <div style={{ padding: '9px 10px', flex: 1 }}>
        {[0, 1, 2].map((block) => (
          <div key={block} style={{ marginBottom: 9 }}>
            {/* 模块标题 */}
            <div
              style={{
                width: block === 0 ? '34%' : block === 1 ? '28%' : '40%',
                height: 4,
                borderRadius: 2,
                background: accent,
                opacity: 0.55,
                marginBottom: 5,
              }}
            />

            {/* 文本行 */}
            {lineWidths
              .slice(block * 2, block * 2 + (block === 1 ? 3 : 2))
              .map((w, i) => (
                <div
                  key={i}
                  style={{
                    width: `${w}%`,
                    height: 3,
                    borderRadius: 2,
                    background: neutral[200],
                    marginBottom: 3.5,
                  }}
                />
              ))}
          </div>
        ))}

        {/* 技能标签行 */}
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 20 + (seed >> i) % 12,
                height: 7,
                borderRadius: 2,
                background: backgroundColorFor(accent, 0.14),
              }}
            />
          ))}
        </div>
      </div>

      {/* 底部：状态条 */}
      <div
        style={{
          height: 3,
          background: resume.status === 'complete' ? accent : neutral[200],
          opacity: resume.status === 'complete' ? 0.75 : 1,
        }}
      />
    </div>
  );
}

/** 用种子生成一组确定性的百分比宽度 */
function generateWidths(seed: number, count: number): number[] {
  const widths: number[] = [];
  let s = seed || 1;
  for (let i = 0; i < count; i++) {
    // 线性同余，保证同一种子每次结果一致
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    widths.push(58 + (s % 38)); // 58% ~ 95%
  }
  return widths;
}
