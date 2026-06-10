import { useNavigate } from 'react-router-dom';
import { Button, Typography } from 'antd';
import { FileTextOutlined, DownloadOutlined, BulbOutlined, SafetyOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const FEATURES = [
  { icon: <FileTextOutlined />, title: '灵活编辑', desc: '支持 Markdown 和富文本，每个模块独立控制字体、颜色、间距' },
  { icon: <BulbOutlined />, title: 'AI 智能优化', desc: 'AI 帮你优化措辞，ATS 评分让简历更符合招聘要求' },
  { icon: <DownloadOutlined />, title: 'PDF 导出', desc: '一键导出 A4 格式 PDF，所见即所得' },
  { icon: <SafetyOutlined />, title: '隐私安全', desc: '简历数据加密存储，分享时可一键脱敏' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div>
      {/* Hero */}
      <div style={{
        textAlign: 'center', padding: '80px 24px 60px',
        background: 'linear-gradient(135deg, #f0f4ff 0%, #f5f0ff 100%)',
      }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{
            display: 'inline-block', padding: '4px 16px', borderRadius: 20,
            background: 'rgba(37,99,235,0.1)', color: '#2563eb', fontSize: 13, marginBottom: 20,
          }}>
            🚀 免费在线简历制作工具
          </div>
          <Title style={{ fontSize: 42, fontWeight: 700, margin: 0, marginBottom: 16, lineHeight: 1.2 }}>
            写简历，从未如此{' '}
            <span style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              简单
            </span>
          </Title>
          <Text style={{ fontSize: 16, color: '#64748b', display: 'block', marginBottom: 32, lineHeight: 1.7 }}>
            晓龙简历是一款免费的在线简历制作工具。提供精美的模板和灵活的自定义选项，
            让你在几分钟内创建一份专业的简历。
          </Text>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Button
              type="primary"
              size="large"
              onClick={() => navigate('/login')}
              style={{ height: 48, padding: '0 32px', borderRadius: 12, fontSize: 16, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', border: 'none' }}
            >
              免费开始制作
            </Button>
            <Button
              size="large"
              onClick={() => navigate('/login')}
              style={{ height: 48, padding: '0 32px', borderRadius: 12, fontSize: 16 }}
            >
              了解更多
            </Button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <Title level={2} style={{ textAlign: 'center', marginBottom: 48, fontSize: 28, color: '#0f172a' }}>
          为什么选择晓龙简历？
        </Title>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              padding: 28, borderRadius: 16, border: '1px solid #f0f0f0',
              transition: 'all 0.3s', background: '#fff',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#2563eb', marginBottom: 16 }}>
                {f.icon}
              </div>
              <Title level={4} style={{ fontSize: 16, margin: 0, marginBottom: 8, color: '#0f172a' }}>{f.title}</Title>
              <Text style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{f.desc}</Text>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '32px 24px', borderTop: '1px solid #f0f0f0', color: '#94a3b8', fontSize: 13 }}>
        晓龙简历 © {new Date().getFullYear()} · 让简历更简单
      </div>
    </div>
  );
}
