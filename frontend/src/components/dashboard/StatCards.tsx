/**
 * 统计指标卡
 * ------------------------------------------------------------------
 * 展示简历总数、完成度、累计浏览、已分享数量。
 * 未加载完成时显示骨架屏，避免布局跳动。
 */
import { Progress } from 'antd';
import {
  EyeOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import type { ResumeStats } from '../../types/resume';
import { brand, neutral, radius, semantic, shadow } from '../../styles/tokens';

interface Props {
  stats: ResumeStats | null;
}

const CARD: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${neutral[150]}`,
  borderRadius: radius.lg,
  padding: '18px 20px',
  boxShadow: shadow.xs,
  display: 'flex',
  alignItems: 'center',
  gap: 14,
};

function IconBadge({ icon, color, soft }: { icon: React.ReactNode; color: string; soft: string }) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.md,
        background: soft,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
  );
}

export default function StatCards({ stats }: Props) {
  if (!stats) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 16,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ ...CARD, height: 78 }}>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: radius.md }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: 48, height: 20, marginBottom: 6 }} />
              <div className="skeleton" style={{ width: 72, height: 12 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const items = [
    {
      icon: <FileTextOutlined />,
      color: brand.primary,
      soft: brand.primarySoft,
      value: stats.totalResumes,
      label: '简历总数',
    },
    {
      icon: <FileDoneOutlined />,
      color: semantic.success,
      soft: semantic.successSoft,
      value: stats.completedResumes,
      label: '已完成',
    },
    {
      icon: <EyeOutlined />,
      color: semantic.info,
      soft: semantic.infoSoft,
      value: stats.totalViews,
      label: '累计浏览',
    },
    {
      icon: <ShareAltOutlined />,
      color: semantic.warning,
      soft: semantic.warningSoft,
      value: stats.sharedResumes,
      label: '已开启分享',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 16,
      }}
    >
      {items.map((it) => (
        <div key={it.label} style={CARD}>
          <IconBadge icon={it.icon} color={it.color} soft={it.soft} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: neutral[900],
                lineHeight: 1.25,
                letterSpacing: -0.4,
              }}
            >
              {it.value}
            </div>
            <div style={{ fontSize: 12.5, color: neutral[500], marginTop: 1 }}>{it.label}</div>
          </div>
        </div>
      ))}

      {/* 完成度进度：单独占一格，视觉上作为「进度」强调 */}
      <div style={{ ...CARD, gridColumn: 'span 1' }}>
        <Progress
          type="circle"
          percent={stats.completeness}
          size={46}
          strokeWidth={9}
          strokeColor={{ '0%': brand.primary, '100%': brand.secondary }}
          trailColor={neutral[100]}
          format={(p) => (
            <span style={{ fontSize: 12, fontWeight: 700, color: neutral[800] }}>{p}%</span>
          )}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: neutral[900] }}>平均完成度</div>
          <div style={{ fontSize: 12.5, color: neutral[500], marginTop: 1 }}>
            按模块内容量估算
          </div>
        </div>
      </div>
    </div>
  );
}
