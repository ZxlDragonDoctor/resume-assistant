import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout, Button, Select, message, Spin, Typography, Drawer, Input, Tag, Tooltip, Modal,
} from 'antd';
import {
  ArrowLeftOutlined, DownloadOutlined, SaveOutlined, BulbOutlined,
  FileAddOutlined, DeleteOutlined, SettingOutlined, AimOutlined,
} from '@ant-design/icons';
import { useResumeStore } from '../stores/resumeStore';
import { templateApi, aiApi, resumeApi } from '../services/api';
import SectionList from '../components/editor/SectionList';
import ResumePreview from '../components/viewer/ResumePreview';
import type { Template, AtsScoreResponse } from '../types/resume';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;
const { TextArea } = Input;

const SECTION_TYPES = [
  { value: 'summary', label: '个人总结' },
  { value: 'experience', label: '工作经历' },
  { value: 'education', label: '教育背景' },
  { value: 'projects', label: '项目经历' },
  { value: 'skills', label: '专业技能' },
];

const EMPTY_SECTION_DATA: Record<string, any> = {
  summary: { content: '' },
  experience: { items: [] },
  education: { items: [] },
  projects: { items: [] },
  skills: { items: [] },
};

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentResume, fetchResume, fetchResumes } = useResumeStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [atsModalOpen, setAtsModalOpen] = useState(false);
  const [jobDesc, setJobDesc] = useState('');
  const [atsResult, setAtsResult] = useState<AtsScoreResponse | null>(null);
  const [atsLoading, setAtsLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchResume(id),
      templateApi.list().then((res: any) => setTemplates(res.data)),
    ]).finally(() => setLoading(false));
  }, [id]);

  const handleSave = useCallback(async () => {
    if (!currentResume || !id) return;
    setSaving(true);
    try {
      await resumeApi.update(id, {
        title: currentResume.title,
        templateId: currentResume.templateId,
      });
      message.success('已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  }, [currentResume, id]);

  const handleAddSection = async (sectionType: string) => {
    if (!id) return;
    const sections = currentResume?.sections || [];
    const maxOrder = sections.reduce((max, s) => Math.max(max, s.sortOrder), -1);

    const defaultData = EMPTY_SECTION_DATA[sectionType] || {};
    try {
      await resumeApi.addSection(id, {
        sectionType,
        sortOrder: maxOrder + 1,
        data: JSON.stringify(defaultData),
      });
      await fetchResume(id);
      message.success('已添加章节');
    } catch {
      message.error('添加失败');
    }
  };

  const handleExport = async (format: string) => {
    message.info(`导出 ${format.toUpperCase()} 功能需要 Export Service 运行`);
  };

  const handleOptimizeBullet = async (content: string) => {
    setAiLoading(true);
    try {
      const res: any = await aiApi.optimizeBullet(content, currentResume?.targetJob);
      setAiResult(res.data.result);
      setAiModalOpen(true);
    } catch {
      message.error('AI 优化失败，请检查 AI 服务是否启动');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAtsScore = async () => {
    if (!jobDesc.trim() || !currentResume) return;
    setAtsLoading(true);
    try {
      const resumeText = currentResume.sections
        .filter(s => s.isVisible)
        .map(s => `${s.sectionType}: ${JSON.stringify(s.data)}`)
        .join('\n');
      const res: any = await aiApi.atsScore(jobDesc, resumeText);
      setAtsResult(res.data);
    } catch {
      message.error('ATS 评分失败');
    } finally {
      setAtsLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!currentResume) {
    return <div style={{ padding: 40 }}>简历不存在</div>;
  }

  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{
        background: '#fff', padding: '0 20px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #e8e8e8', height: 56,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')} />
          <Input
            value={currentResume.title}
            onChange={(e) => useResumeStore.getState().setCurrentResume({
              ...currentResume, title: e.target.value,
            })}
            style={{ width: 200, border: 'none', fontWeight: 600, fontSize: 16 }}
            variant="borderless"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Select
            value={currentResume.templateId}
            onChange={(val) => {
              useResumeStore.getState().setCurrentResume({
                ...currentResume, templateId: val,
              });
              handleSave();
            }}
            style={{ width: 140 }}
            options={templates.map(t => ({ value: t.id, label: t.name }))}
          />
          <Tooltip title="AI 优化">
            <Button icon={<BulbOutlined />} loading={aiLoading}
              onClick={() => handleOptimizeBullet('请先在简历中填写经历内容')} />
          </Tooltip>
          <Tooltip title="ATS 评分">
            <Button icon={<AimOutlined />} onClick={() => setAtsModalOpen(true)} />
          </Tooltip>
          <Tooltip title="添加章节">
            <Select
              placeholder="+ 添加"
              style={{ width: 100 }}
              onChange={handleAddSection}
              options={SECTION_TYPES}
              value={undefined}
            />
          </Tooltip>
          <Button icon={<SaveOutlined />} onClick={handleSave} loading={saving} type="primary">
            保存
          </Button>
          <Button icon={<DownloadOutlined />} onClick={() => handleExport('pdf')}>
            导出 PDF
          </Button>
        </div>
      </Header>

      <Layout style={{ height: 'calc(100vh - 56px)' }}>
        <Sider width={420} style={{ background: '#fff', borderRight: '1px solid #e8e8e8', overflow: 'auto' }}>
          <SectionList
            resumeId={id!}
            sections={currentResume.sections}
            onRefresh={() => fetchResume(id!)}
          />
        </Sider>
        <Content style={{ background: '#f5f5f5', overflow: 'auto', padding: 24 }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <ResumePreview resume={currentResume} />
          </div>
        </Content>
      </Layout>

      <Modal
        title="AI 优化建议"
        open={aiModalOpen}
        onCancel={() => setAiModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setAiModalOpen(false)}>关闭</Button>,
        ]}
      >
        <p style={{ whiteSpace: 'pre-wrap' }}>{aiResult}</p>
      </Modal>

      <Drawer
        title="ATS 简历评分"
        open={atsModalOpen}
        onClose={() => { setAtsModalOpen(false); setAtsResult(null); }}
        width={400}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>职位描述</label>
          <TextArea rows={6} value={jobDesc} onChange={e => setJobDesc(e.target.value)}
            placeholder="粘贴职位描述（JD）以分析匹配度..." />
        </div>
        <Button type="primary" onClick={handleAtsScore} loading={atsLoading} block>
          开始评分
        </Button>

        {atsResult && (
          <div style={{ marginTop: 24 }}>
            <Title level={5}>评分结果</Title>
            {Object.entries(atsResult.scores).map(([key, val]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>{{
                    keywords: '关键词匹配', skills: '技能匹配', experience: '经验相关',
                    education: '教育背景', overall: '综合评分',
                  }[key] || key}</span>
                  <Tag color={val >= 80 ? 'green' : val >= 60 ? 'orange' : 'red'}>{val}</Tag>
                </div>
                <div style={{
                  height: 8, background: '#f0f0f0', borderRadius: 4,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${val}%`, height: '100%',
                    background: val >= 80 ? '#52c41a' : val >= 60 ? '#faad14' : '#ff4d4f',
                    borderRadius: 4, transition: 'width 0.5s',
                  }} />
                </div>
              </div>
            ))}
            {atsResult.suggestions.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Title level={5}>优化建议</Title>
                <ul>
                  {atsResult.suggestions.map((s, i) => (
                    <li key={i} style={{ marginBottom: 8, color: '#666' }}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </Layout>
  );
}
