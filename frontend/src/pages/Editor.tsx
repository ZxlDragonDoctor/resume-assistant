import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout, Button, Select, message, Spin, Typography, Drawer, Input, Tag, Tooltip, Modal,
} from 'antd';
import {
  ArrowLeftOutlined, DownloadOutlined, SaveOutlined, BulbOutlined,
  AimOutlined,
} from '@ant-design/icons';
import { useResumeStore } from '../stores/resumeStore';
import { aiApi, resumeApi, exportApi } from '../services/api';
import LeftPanel from '../components/editor/LeftPanel';
import CenterPanel from '../components/editor/CenterPanel';
import ResumePreview from '../components/viewer/ResumePreview';
import type { AtsScoreResponse } from '../types/resume';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;
const { TextArea } = Input;

const EMPTY_SECTION_DATA: Record<string, any> = {
  basic: { name: '', phone: '', email: '', _config: {} },
  summary: { content: '', _config: {} },
  experience: { items: [], _config: {} },
  education: { items: [], _config: {} },
  projects: { items: [], _config: {} },
  skills: { items: [], _config: {} },
  awards: { items: [], _config: {} },
  certificates: { items: [], _config: {} },
  custom: { content: '', _config: {} },
};

const DEFAULT_LAYOUT = {
  globalFontSize: 14,
  globalLineSpacing: 1.6,
  globalFontFamily: 'system-ui',
  pageTopMargin: 40,
  pageLeftMargin: 35,
  pageRightMargin: 35,
  moduleMargin: 22,
  titleTopPadding: 4,
  titleBottomMargin: 12,
};

function parseLayout(layoutConfig: string | undefined): Record<string, any> {
  if (!layoutConfig) return { ...DEFAULT_LAYOUT };
  try { return { ...DEFAULT_LAYOUT, ...JSON.parse(layoutConfig) }; } catch { return { ...DEFAULT_LAYOUT }; }
}

const SliderRow = ({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 2 }}>
      <span>{label}</span><span>{value}px</span>
    </div>
    <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value))} style={{ width: '100%', margin: 0 }} />
  </div>
);

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentResume, fetchResume } = useResumeStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState('');
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [atsModalOpen, setAtsModalOpen] = useState(false);
  const [jobDesc, setJobDesc] = useState('');
  const [atsResult, setAtsResult] = useState<AtsScoreResponse | null>(null);
  const [atsLoading, setAtsLoading] = useState(false);
    const [layout, setLayout] = useState<any>(DEFAULT_LAYOUT);

  useEffect(() => {
    if (!id) return;
    fetchResume(id).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (currentResume) {
      setTitleText(currentResume.title);
      setLayout(parseLayout(currentResume.layoutConfig));
    }
  }, [currentResume?.title, currentResume?.layoutConfig]);

  const saveLayout = async (newLayout: any) => {
    if (!id || !currentResume) return;
    setLayout(newLayout);
    useResumeStore.getState().setCurrentResume({ ...currentResume, layoutConfig: JSON.stringify(newLayout) });
    try {
      await resumeApi.update(id, { layoutConfig: JSON.stringify(newLayout) });
    } catch { message.error('布局保存失败'); }
  };

  const resetLayout = () => {
    saveLayout({ ...DEFAULT_LAYOUT });
    message.success('已重置为默认布局');
  };

  const handleSave = useCallback(async () => {
    if (!currentResume || !id) return;
    setSaving(true);
    try {
      await resumeApi.update(id, { title: currentResume.title });
      message.success('已保存');
    } catch { message.error('保存失败'); } finally { setSaving(false); }
  }, [currentResume, id]);

  const handleAddSection = async (sectionType: string) => {
    if (!id) return;
    const sections = currentResume?.sections || [];
    const maxOrder = sections.reduce((max, s) => Math.max(max, s.sortOrder), -1);
    const defaultData = EMPTY_SECTION_DATA[sectionType] || {};
    try {
      await resumeApi.addSection(id, { sectionType, sortOrder: maxOrder + 1, data: JSON.stringify(defaultData) });
      await fetchResume(id);
      message.success('已添加模块');
    } catch { message.error('添加失败'); }
  };

  const handleExport = async () => {
    if (!currentResume) return;
    setSaving(true);
    try {
      const res: any = await exportApi.exportPdf(currentResume as any);
      const blob = new Blob([res], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${currentResume.title}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      message.success('PDF 导出成功');
    } catch { message.error('导出失败，请确保导出服务已启动（端口 8085）'); } finally { setSaving(false); }
  };

  const handleOptimizeBullet = async (content: string) => {
    setAiLoading(true);
    try { const res: any = await aiApi.optimizeBullet(content, ''); setAiResult(res.data.result); setAiModalOpen(true); }
    catch { message.error('AI 优化失败'); } finally { setAiLoading(false); }
  };

  const handleAtsScore = async () => {
    if (!jobDesc.trim() || !currentResume) return;
    setAtsLoading(true);
    try {
      const resumeText = currentResume.sections.filter(s => s.isVisible !== false)
        .map(s => `${s.sectionType}: ${JSON.stringify(s.data)}`).join('\n');
      const res: any = await aiApi.atsScore(jobDesc, resumeText);
      setAtsResult(res.data);
    } catch { message.error('ATS 评分失败'); } finally { setAtsLoading(false); }
  };

  const handleTitleChange = async () => {
    setEditingTitle(false);
    if (!id || !currentResume) return;
    if (titleText.trim() && titleText !== currentResume.title) {
      try {
        await resumeApi.update(id, { title: titleText.trim() });
        useResumeStore.getState().setCurrentResume({ ...currentResume, title: titleText.trim() });
      } catch { message.error('标题保存失败'); }
    }
  };

  const handleReorder = async (orderedIds: string[]) => {
    if (!id || !currentResume) return;
    const idToSection = new Map(currentResume.sections.map(s => [s.id, s]));
    const reordered = orderedIds.map(id => idToSection.get(id)).filter(Boolean) as typeof currentResume.sections;
    useResumeStore.getState().setCurrentResume({ ...currentResume, sections: reordered });
    try {
      await resumeApi.reorderSections(id, orderedIds.map(id => ({ id })));
      await fetchResume(id);
    } catch { message.error('排序保存失败'); }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  }
  if (!currentResume) return <div style={{ padding: 40 }}>简历不存在</div>;

  const RangeInput = ({ label, value, min, max, step, onChange }: any) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#475569' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="range" min={min} max={max} step={step || 1}
          value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#64748b', minWidth: 30, textAlign: 'right' }}>{value}</span>
      </div>
    </div>
  );

  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e8e8e8', height: 52, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')} />
          {editingTitle ? (
            <Input value={titleText} onChange={(e) => setTitleText(e.target.value)}
              onBlur={handleTitleChange} onPressEnter={handleTitleChange}
              style={{ width: 240, fontSize: 16, fontWeight: 600 }} autoFocus />
          ) : (
            <span onClick={() => setEditingTitle(true)} style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}>
              {currentResume.title} ✏️
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tooltip title="AI 优化">
            <Button icon={<BulbOutlined />} loading={aiLoading} size="small"
              onClick={() => handleOptimizeBullet('请先在简历中填写经历内容')} />
          </Tooltip>
          <Tooltip title="ATS 评分">
            <Button icon={<AimOutlined />} size="small" onClick={() => setAtsModalOpen(true)} />
          </Tooltip>
          <Button icon={<SaveOutlined />} onClick={handleSave} loading={saving} type="primary" size="small">保存</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport} loading={saving} size="small">导出 PDF</Button>
        </div>
      </Header>

      <Layout style={{ height: 'calc(100vh - 52px)' }}>
        <Sider width={200} style={{ background: '#fafafa', borderRight: '1px solid #e8e8e8', overflow: 'auto' }}>
          <LeftPanel sections={currentResume.sections} selectedId={selectedSectionId}
            onSelect={setSelectedSectionId} onAdd={handleAddSection} onReorder={handleReorder} />
        </Sider>
        <Content style={{ background: '#fff', borderRight: '1px solid #e8e8e8', overflow: 'auto' }}>
          <CenterPanel sectionId={selectedSectionId} onRefresh={() => id && fetchResume(id)} />
        </Content>
        <Sider width={750} style={{ background: '#f5f5f5', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: '10px 16px', background: '#fff', borderBottom: '1px solid #e8e8e8',
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0,
          }}>
            <select value={layout.globalFontFamily}
              onChange={(e) => saveLayout({ ...layout, globalFontFamily: e.target.value })}
              style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #d9d9d9', fontSize: 12, outline: 'none' }}>
              <option value="system-ui">系统字体</option>
              <option value="SimSun, serif">宋体</option>
              <option value="SimHei, sans-serif">黑体</option>
              <option value="KaiTi, serif">楷体</option>
              <option value="FangSong, serif">仿宋</option>
            </select>
            <select value={layout.globalFontSize}
              onChange={(e) => saveLayout({ ...layout, globalFontSize: parseInt(e.target.value) })}
              style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #d9d9d9', fontSize: 12, outline: 'none' }}>
              {[12,13,14,15,16,17,18].map(v => (<option key={v} value={v}>{v}px</option>))}
            </select>
            <select value={layout.globalLineSpacing}
              onChange={(e) => saveLayout({ ...layout, globalLineSpacing: parseFloat(e.target.value) })}
              style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #d9d9d9', fontSize: 12, outline: 'none' }}>
              {[1.0,1.2,1.4,1.6,1.8,2.0,2.2].map(v => (<option key={v} value={v}>{v}</option>))}
            </select>
            <span style={{ fontSize: 11, color: '#999' }}>|</span>
            <div style={{ position: 'relative', display: 'inline-block' }}
              onMouseEnter={(e) => { const d = e.currentTarget.querySelector('.layout-popup'); if (d) (d as HTMLElement).style.display = 'block'; }}
              onMouseLeave={(e) => { const d = e.currentTarget.querySelector('.layout-popup'); if (d) (d as HTMLElement).style.display = 'none'; }}>
              <button style={{ padding: '2px 10px', border: '1px solid #d9d9d9', borderRadius: 4, background: '#fff', fontSize: 11, cursor: 'pointer', color: '#475569' }}>布局 ▾</button>
              <div className="layout-popup" style={{
                display: 'none', position: 'absolute', top: '100%', right: 0, zIndex: 100,
                background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8,
                padding: '14px 16px', width: 260, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 10 }}>页面间距</div>
                <SliderRow label="上边距" value={layout.pageTopMargin} min={20} max={80} onChange={(v) => saveLayout({ ...layout, pageTopMargin: v })} />
                <SliderRow label="左边距" value={layout.pageLeftMargin} min={20} max={60} onChange={(v) => saveLayout({ ...layout, pageLeftMargin: v })} />
                <SliderRow label="右边距" value={layout.pageRightMargin} min={20} max={60} onChange={(v) => saveLayout({ ...layout, pageRightMargin: v })} />
                <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', margin: '10px 0 8px' }}>模块间距</div>
                <SliderRow label="模块间距" value={layout.moduleMargin} min={10} max={50} onChange={(v) => saveLayout({ ...layout, moduleMargin: v })} />
                <SliderRow label="标题上边距" value={layout.titleTopPadding} min={0} max={16} onChange={(v) => saveLayout({ ...layout, titleTopPadding: v })} />
                <SliderRow label="标题下边距" value={layout.titleBottomMargin} min={4} max={30} onChange={(v) => saveLayout({ ...layout, titleBottomMargin: v })} />
                <div style={{ textAlign: 'center', marginTop: 10 }}>
                  <button onClick={resetLayout} style={{ padding: '3px 16px', border: '1px solid #ff4d4f', borderRadius: 4, background: 'transparent', color: '#ff4d4f', fontSize: 11, cursor: 'pointer' }}>重置为默认</button>
                </div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 40px', display: 'flex', justifyContent: 'center' }}>
            <ResumePreview resume={currentResume} />
          </div>
        </Sider>
      </Layout>

      <Modal title="AI 优化建议" open={aiModalOpen} onCancel={() => setAiModalOpen(false)}
        footer={[<Button key="close" onClick={() => setAiModalOpen(false)}>关闭</Button>]}>
        <p style={{ whiteSpace: 'pre-wrap' }}>{aiResult}</p>
      </Modal>

      <Drawer title="ATS 简历评分" open={atsModalOpen}
        onClose={() => { setAtsModalOpen(false); setAtsResult(null); }} width={400}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 500 }}>职位描述</label>
          <TextArea rows={6} value={jobDesc} onChange={e => setJobDesc(e.target.value)}
            placeholder="粘贴职位描述（JD）以分析匹配度..." />
        </div>
        <Button type="primary" onClick={handleAtsScore} loading={atsLoading} block>开始评分</Button>
        {atsResult && (
          <div style={{ marginTop: 24 }}>
            <Title level={5}>评分结果</Title>
            {Object.entries(atsResult.scores).map(([key, val]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{{ keywords: '关键词匹配', skills: '技能匹配', experience: '经验相关', education: '教育背景', overall: '综合评分' }[key] || key}</span>
                  <Tag color={val >= 80 ? 'green' : val >= 60 ? 'orange' : 'red'}>{val}</Tag>
                </div>
                <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{ width: `${val}%`, height: '100%', background: val >= 80 ? '#52c41a' : val >= 60 ? '#faad14' : '#ff4d4f', borderRadius: 4 }} />
                </div>
              </div>
            ))}
            {atsResult.suggestions?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Title level={5}>优化建议</Title>
                <ul>{atsResult.suggestions.map((s: string, i: number) => <li key={i} style={{ color: '#666' }}>{s}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </Drawer>


    </Layout>
  );
}
