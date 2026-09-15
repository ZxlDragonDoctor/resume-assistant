/**
 * Hero 简历预览
 * ------------------------------------------------------------------
 * 用真实 DOM 渲染一份示例简历，比静态图更有说服力，
 * 且与编辑器中的排版规则完全一致（同在渲染引擎下设计）。
 */
import { brand, neutral, radius, semantic, shadow } from '../../styles/tokens';

/** 示例数据：一位后端工程师的简历片段（人名/联系方式均为虚构占位） */
const SAMPLE = {
  name: '张小北',
  jobTitle: 'Java 后端开发工程师',
  contacts: ['☎ 138****0000', '✉ zhangxb@example.com', '⌂ 杭州'],
  sections: [
    {
      title: '个人总结',
      type: 'text' as const,
      content:
        '计算机专业本科，3 年 Java 后端开发经验。熟悉 Spring Cloud 微服务架构，主导过日活 20w+ 的订单系统重构，将接口 P99 延迟从 850ms 降至 120ms。',
    },
    {
      title: '专业技能',
      type: 'tags' as const,
      items: ['Java', 'Spring Cloud', 'Redis', 'Kafka', 'PostgreSQL', 'Docker', 'Kubernetes'],
    },
    {
      title: '实习经历',
      type: 'entries' as const,
      items: [
        {
          title: '某互联网科技公司',
          meta: '后端开发工程师',
          date: '2023.07 — 至今',
          tech: 'Spring Cloud · Kafka · Redis',
          bullets: [
            '主导订单服务重构，引入本地消息表 + 定时补偿，解决分布式事务数据不一致问题，日均修复异常订单 200+',
            '设计多级缓存方案（Caffeine + Redis），核心接口 P99 延迟由 850ms 降至 120ms，QPS 提升 4 倍',
          ],
        },
      ],
    },
  ],
};

export default function HeroPreview() {
  const themeColor = brand.primary;

  return (
    <div
      style={{
        position: 'relative',
        maxWidth: 880,
        margin: '0 auto',
      }}
    >
      {/* 纸张 */}
      <div
        style={{
          background: '#fff',
          borderRadius: radius.lg,
          boxShadow: '0 24px 64px rgba(15,23,42,0.14), 0 8px 20px rgba(15,23,42,0.06)',
          border: `1px solid ${neutral[150]}`,
          padding: '38px 44px',
          fontFamily: "'Inter', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
          textAlign: 'left',
          overflow: 'hidden',
        }}
      >
        {/* 头部 */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: themeColor,
              letterSpacing: 0.4,
              lineHeight: 1.3,
            }}
          >
            {SAMPLE.name}
          </div>
          <div
            style={{
              fontSize: 14,
              color: themeColor,
              opacity: 0.82,
              fontWeight: 500,
              marginTop: 3,
            }}
          >
            {SAMPLE.jobTitle}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 18,
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: 7,
              fontSize: 12.5,
              color: neutral[600],
              opacity: 0.8,
            }}
          >
            {SAMPLE.contacts.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>

        {/* 模块 */}
        {SAMPLE.sections.map((section) => (
          <div key={section.title} style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: themeColor,
                borderBottom: `2px solid ${themeColor}`,
                paddingBottom: 4,
                marginBottom: 9,
              }}
            >
              {section.title}
            </div>

            {section.type === 'text' && (
              <p
                style={{
                  fontSize: 12.5,
                  lineHeight: 1.72,
                  color: neutral[700],
                  margin: 0,
                }}
              >
                {section.content}
              </p>
            )}

            {section.type === 'tags' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {section.items!.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 12,
                      padding: '2px 10px',
                      borderRadius: radius.xs,
                      border: `1px solid ${themeColor}40`,
                      background: `${themeColor}0F`,
                      color: themeColor,
                      fontWeight: 500,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {section.type === 'entries' &&
              section.items!.map((item, i) => (
                <div key={i}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: themeColor }}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: 12.5, color: neutral[600], opacity: 0.72 }}>
                        {item.meta}
                      </span>
                    </div>
                    <span style={{ fontSize: 11.5, color: neutral[500], opacity: 0.6 }}>
                      {item.date}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 11.5,
                      color: themeColor,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10.5,
                        padding: '0 5px',
                        borderRadius: 3,
                        background: `${themeColor}14`,
                      }}
                    >
                      技术栈
                    </span>
                    {item.tech}
                  </div>

                  <ul style={{ margin: '4px 0 0', paddingLeft: 16, listStyle: 'disc' }}>
                    {item.bullets!.map((b, bi) => (
                      <li
                        key={bi}
                        style={{
                          fontSize: 12.5,
                          lineHeight: 1.7,
                          color: neutral[700],
                          margin: '2px 0',
                        }}
                      >
                        {/* 高亮数字，直观展示「量化成果」的价值 */}
                        {highlightNumbers(b).map((part, pi) =>
                          part.highlight ? (
                            <strong key={pi} style={{ color: themeColor, fontWeight: 600 }}>
                              {part.text}
                            </strong>
                          ) : (
                            <span key={pi}>{part.text}</span>
                          )
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        ))}
      </div>

      {/* 浮动徽标：AI 优化 */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          right: -28,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '8px 14px',
          borderRadius: radius.pill,
          background: '#fff',
          boxShadow: shadow.lg,
          border: `1px solid ${neutral[150]}`,
          fontSize: 12.5,
          fontWeight: 500,
          color: brand.secondary,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: brand.secondary,
            animation: 'pulseSoft 1.8s ease-in-out infinite',
          }}
        />
        AI 已优化 2 条要点
      </div>

      {/* 浮动徽标：ATS 分数 */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: -32,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '10px 16px',
          borderRadius: radius.lg,
          background: '#fff',
          boxShadow: shadow.lg,
          border: `1px solid ${neutral[150]}`,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'conic-gradient(${semantic.success} 0% 87%, ${neutral[200]} 87% 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10.5,
              fontWeight: 700,
              color: semantic.success,
            }}
          >
            87
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: neutral[800] }}>ATS 匹配度</div>
          <div style={{ fontSize: 11, color: neutral[400] }}>高于 82% 的候选人</div>
        </div>
      </div>
    </div>
  );
}

/** 把数字 / 百分比切分为可高亮的片段 */
function highlightNumbers(text: string): { text: string; highlight: boolean }[] {
  const parts: { text: string; highlight: boolean }[] = [];
  const regex = /\d+(\.\d+)?\s*(%|％|倍|万|亿|k|K|w|W|ms|s|QPS|日活)?/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), highlight: false });
    }
    parts.push({ text: match[0], highlight: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false });
  }
  return parts.length ? parts : [{ text, highlight: false }];
}
