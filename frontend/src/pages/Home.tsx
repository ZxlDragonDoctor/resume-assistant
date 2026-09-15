/**
 * 落地页
 * ------------------------------------------------------------------
 * 结构：Hero（含简历实例预览） → 数据背书 → 功能网格 → 工作流 → CTA
 * 设计取向：安静的渐变背景 + 克制的阴影 + 真实产品截图式预览，
 * 避免大色块堆砌，用留白和排版建立专业感。
 */
import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import {
  ArrowRightOutlined,
  BulbOutlined,
  CheckCircleFilled,
  DownloadOutlined,
  LayoutOutlined,
  LineChartOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

import HeroPreview from '../components/home/HeroPreview';
import { useAuthStore } from '../stores/authStore';
import { brand, layout, neutral, radius, semantic, shadow, space, transition } from '../styles/tokens';

// ------------------------------------------------------------------
// 内容配置
// ------------------------------------------------------------------

const FEATURES = [
  {
    icon: <LayoutOutlined />,
    title: '模块化编辑',
    desc: '基本信息、实习、项目、技能等模块自由增删排序，每个模块独立控制字号、颜色与间距。',
    tone: brand.primary,
    toneSoft: brand.primarySoft,
  },
  {
    icon: <BulbOutlined />,
    title: 'AI 内容优化',
    desc: '把「负责开发功能」改写成量化成果。基于 STAR 法则润色措辞，无 API Key 时也有本地规则引擎兜底。',
    tone: brand.secondary,
    toneSoft: brand.secondarySoft,
  },
  {
    icon: <LineChartOutlined />,
    title: 'ATS 匹配度评分',
    desc: '粘贴目标岗位 JD，从关键词、技能、经验、学历四个维度打分并给出可执行的改进建议。',
    tone: semantic.info,
    toneSoft: semantic.infoSoft,
  },
  {
    icon: <DownloadOutlined />,
    title: '所见即所得导出',
    desc: '服务端渲染 A4 PDF，字体、分页、颜色与编辑器预览完全一致，不再出现「导出后排版全乱」。',
    tone: semantic.success,
    toneSoft: semantic.successSoft,
  },
  {
    icon: <SafetyOutlined />,
    title: '分享与版本管理',
    desc: '一键生成只读分享链接，投递不同岗位前保存版本快照，随时回滚到任意历史节点。',
    tone: semantic.warning,
    toneSoft: semantic.warningSoft,
  },
  {
    icon: <ThunderboltOutlined />,
    title: '多模板一键切换',
    desc: '内置简约、经典、创意、技术等风格，切换模板自动套用全新的版式与配色，内容不丢失。',
    tone: semantic.danger,
    toneSoft: semantic.dangerSoft,
  },
];

const STATS = [
  { value: '6', label: '内置模板' },
  { value: '10+', label: '可组合模块' },
  { value: '4', label: 'ATS 评分维度' },
  { value: '100%', label: '免费使用' },
];

const STEPS = [
  { step: '01', title: '选择模板', desc: '从模板库挑选贴合岗位风格的版式' },
  { step: '02', title: '填写内容', desc: '按模块录入经历，AI 协助润色措辞' },
  { step: '03', title: '匹配岗位', desc: '粘贴 JD 获取 ATS 评分与改进建议' },
  { step: '04', title: '导出投递', desc: '导出 A4 PDF 或生成在线分享链接' },
];

// ------------------------------------------------------------------

export default function Home() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const startNow = () => navigate(user ? '/dashboard' : '/login');

  return (
    <div style={{ background: '#fff' }}>
      {/* ================= Hero ================= */}
      <section
        style={{
          position: 'relative',
          padding: `${space.giant}px 32px ${space.huge}px`,
          background:
            `radial-gradient(1200px 520px at 50% -10%, ${brand.primarySoft} 0%, ${brand.secondarySoft} 42%, ${neutral[0]} 100%)`,
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: layout.contentMaxWidth, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: 780, margin: '0 auto' }}>
            {/* 标签 */}
            <div
              className="animate-in"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '5px 14px 5px 8px',
                borderRadius: radius.pill,
                background: '#fff',
                border: `1px solid ${brand.primaryBorder}`,
                fontSize: 12.5,
                color: brand.primaryActive,
                fontWeight: 500,
                marginBottom: 22,
                boxShadow: shadow.xs,
              }}
            >
              <span
                style={{
                  background: brand.gradient,
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: radius.pill,
                  letterSpacing: 0.4,
                }}
              >
                AI
              </span>
              智能润色 · ATS 评分 · 一键导出
            </div>

            <h1
              className="animate-in"
              style={{
                fontSize: 50,
                lineHeight: 1.16,
                letterSpacing: -1.2,
                fontWeight: 700,
                color: neutral[900],
                marginBottom: 20,
                animationDelay: '0.05s',
              }}
            >
              写出让 HR
              <span className="text-gradient"> 多看两眼 </span>
              的简历
            </h1>

            <p
              className="animate-in"
              style={{
                fontSize: 17,
                lineHeight: 1.75,
                color: neutral[500],
                marginBottom: 34,
                animationDelay: '0.1s',
              }}
            >
              免费的在线简历编辑器。模块化排版、AI 措辞优化、ATS 匹配度分析，
              帮你把经历讲成有数字、有方法的成果。几分钟做出专业简历。
            </p>

            <div
              className="animate-in"
              style={{
                display: 'flex',
                gap: 12,
                justifyContent: 'center',
                flexWrap: 'wrap',
                animationDelay: '0.15s',
              }}
            >
              <Button
                type="primary"
                size="large"
                onClick={startNow}
                style={{
                  height: 48,
                  padding: '0 26px',
                  borderRadius: radius.lg,
                  fontSize: 15,
                  fontWeight: 500,
                  background: brand.gradient,
                  border: 'none',
                  boxShadow: '0 6px 20px rgba(79,70,229,0.28)',
                }}
                icon={<ArrowRightOutlined />}
                iconPosition="end"
              >
                免费开始制作
              </Button>
              <Button
                size="large"
                onClick={() => navigate('/templates')}
                style={{
                  height: 48,
                  padding: '0 26px',
                  borderRadius: radius.lg,
                  fontSize: 15,
                  fontWeight: 500,
                  border: `1px solid ${neutral[200]}`,
                  color: neutral[700],
                  background: '#fff',
                }}
              >
                浏览模板
              </Button>
            </div>

            <div
              className="animate-in"
              style={{
                marginTop: 18,
                fontSize: 12.5,
                color: neutral[400],
                display: 'flex',
                gap: 18,
                justifyContent: 'center',
                flexWrap: 'wrap',
                animationDelay: '0.2s',
              }}
            >
              {['无需下载', '数据本地部署', '支持分享与版本回溯'].map((t) => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircleFilled style={{ color: semantic.success, fontSize: 12 }} />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* 简历预览 */}
          <div className="animate-in" style={{ marginTop: 52, animationDelay: '0.25s' }}>
            <HeroPreview />
          </div>
        </div>
      </section>

      {/* ================= 数据 ================= */}
      <section style={{ borderTop: `1px solid ${neutral[150]}`, background: neutral[25] }}>
        <div
          style={{
            maxWidth: layout.contentMaxWidth,
            margin: '0 auto',
            padding: '36px 32px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 24,
          }}
        >
          {STATS.map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  letterSpacing: -0.8,
                  color: neutral[900],
                  lineHeight: 1.2,
                }}
              >
                {s.value}
              </div>
              <div style={{ fontSize: 13, color: neutral[500], marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= 功能 ================= */}
      <section style={{ padding: `${space.giant}px 32px` }}>
        <div style={{ maxWidth: layout.contentMaxWidth, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: brand.primary,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Features
            </div>
            <h2
              style={{
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: -0.6,
                color: neutral[900],
                marginBottom: 12,
              }}
            >
              从「写简历」到「过筛选」的完整链路
            </h2>
            <p style={{ fontSize: 15.5, color: neutral[500], maxWidth: 560, margin: '0 auto' }}>
              不只是排版工具。我们把招聘方的筛选逻辑做进产品里，帮你提前发现简历里的短板。
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 20,
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="hover-lift"
                style={{
                  padding: 26,
                  borderRadius: radius.xl,
                  border: `1px solid ${neutral[150]}`,
                  background: '#fff',
                  boxShadow: shadow.xs,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: radius.lg,
                    background: f.toneSoft,
                    color: f.tone,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    marginBottom: 16,
                  }}
                >
                  {f.icon}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: neutral[900],
                    marginBottom: 8,
                  }}
                >
                  {f.title}
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.72, color: neutral[500] }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 流程 ================= */}
      <section
        style={{
          padding: `${space.giant}px 32px`,
          background: neutral[25],
          borderTop: `1px solid ${neutral[150]}`,
          borderBottom: `1px solid ${neutral[150]}`,
        }}
      >
        <div style={{ maxWidth: layout.contentMaxWidth, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <h2
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: -0.5,
                color: neutral[900],
                marginBottom: 10,
              }}
            >
              四步完成一份简历
            </h2>
            <p style={{ fontSize: 15, color: neutral[500] }}>
              平均 15 分钟，从空白到可直接投递
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 20,
            }}
          >
            {STEPS.map((s, i) => (
              <div key={s.step} style={{ position: 'relative' }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: brand.primary,
                    letterSpacing: 1,
                    marginBottom: 10,
                    fontFamily: 'monospace',
                  }}
                >
                  {s.step}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: neutral[900],
                    marginBottom: 7,
                  }}
                >
                  {s.title}
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.7, color: neutral[500] }}>{s.desc}</div>

                {/* 连接线 */}
                {i < STEPS.length - 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      right: -12,
                      top: 6,
                      width: 24,
                      height: 2,
                      background: `linear-gradient(90deg, ${brand.primaryBorder}, transparent)`,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section style={{ padding: `${space.giant}px 32px` }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div
            style={{
              position: 'relative',
              borderRadius: 24,
              padding: '52px 40px',
              textAlign: 'center',
              background: brand.gradient,
              overflow: 'hidden',
              boxShadow: '0 20px 48px rgba(79,70,229,0.28)',
            }}
          >
            {/* 装饰光斑 */}
            <div
              style={{
                position: 'absolute',
                top: -70,
                right: -50,
                width: 240,
                height: 240,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: -90,
                left: -40,
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
              }}
            />

            <div style={{ position: 'relative' }}>
              <h2
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: '#fff',
                  marginBottom: 12,
                  letterSpacing: -0.5,
                }}
              >
                现在就开始，让简历更有说服力
              </h2>
              <p
                style={{
                  fontSize: 15.5,
                  color: 'rgba(255,255,255,0.86)',
                  marginBottom: 28,
                  lineHeight: 1.7,
                }}
              >
                注册即可创建简历，全部功能免费开放
              </p>
              <Button
                size="large"
                onClick={startNow}
                style={{
                  height: 48,
                  padding: '0 30px',
                  borderRadius: radius.lg,
                  fontSize: 15,
                  fontWeight: 600,
                  color: brand.primaryActive,
                  background: '#fff',
                  border: 'none',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.14)',
                }}
                icon={<ArrowRightOutlined />}
                iconPosition="end"
              >
                {user ? '进入工作台' : '免费创建账号'}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
