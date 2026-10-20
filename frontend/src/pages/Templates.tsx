/** 模板库：轻量范文节选、匿名全文预览和独立创建操作。 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as AntApp, Button, Empty, Input, Segmented, Spin } from 'antd';
import { CheckOutlined, EyeOutlined, SearchOutlined, ThunderboltOutlined } from '@ant-design/icons';
import TemplatePreview from '../components/templates/TemplatePreview';
import TemplateSampleModal from '../components/templates/TemplateSampleModal';
import { templateApi, auth } from '../services/api';
import { useResumeStore } from '../stores/resumeStore';
import { normalizeTemplateConfig, type Template, type TemplateCategory } from '../types/resume';
import { normalizeTemplateSample, templateSearchText } from '../utils/templateSample';
import { neutral, semantic } from '../styles/tokens';
import '../components/templates/templates.css';

export default function Templates() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const { createResume } = useResumeStore();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    Promise.allSettled([templateApi.list(), templateApi.categories()]).then(([list, cats]) => {
      if (!active) return;
      if (list.status === 'fulfilled') setTemplates(list.value);
      else { setTemplates([]); setLoadFailed(true); }
      setCategories(cats.status === 'fulfilled' ? cats.value : []);
      setLoading(false);
    });
    return () => { active = false; };
  }, [retry]);

  const entries = useMemo(() => templates.map((template) => {
    const sample = normalizeTemplateSample(template.previewConfig);
    return { template, sample, config: normalizeTemplateConfig(template.config), searchable: templateSearchText(template, sample) };
  }), [templates]);

  const filtered = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return entries.filter(({ template, searchable }) =>
      (activeCategory === 'all' || template.category === activeCategory) && (!term || searchable.includes(term)));
  }, [entries, activeCategory, keyword]);

  const handleUse = async (template: Template) => {
    if (usingId) return;
    if (!auth.getToken()) {
      message.info('请先登录后再使用模板');
      navigate('/login', { state: { from: '/templates' } });
      return;
    }
    setUsingId(template.id);
    try {
      const resume = await createResume(`${template.name}简历`, template.id);
      message.success(normalizeTemplateSample(template.previewConfig)
        ? '已创建简历。示例内容，请替换为真实经历'
        : '已创建简历，请在编辑器中核对示例并替换为真实经历', 5);
      navigate(`/editor/${resume.id}`);
    } catch {
      message.error('创建简历失败，请稍后重试');
    } finally {
      setUsingId(null);
    }
  };

  const categoryOptions = [
    { value: 'all', label: `全部 ${templates.length}` },
    ...categories.map((category) => ({ value: category.key, label: `${category.label} ${category.count}` })),
  ];

  return (
    <div style={{ background: neutral[25], minHeight: 'calc(100vh - 56px)' }}>
      <header className="template-library-header">
        <div className="template-library-container">
          <h1>简历模板</h1>
          <p>从适合岗位的范文开始，看看经历、技能和项目如何组织。打开预览可阅读完整内容，使用后可自由修改文字、字体、配色与间距。</p>
        </div>
      </header>
      <div className="template-library-filters">
        <div className="template-library-container template-library-filter-content">
          <div className="template-library-categories">
            <Segmented aria-label="模板分类" value={activeCategory} onChange={(value) => setActiveCategory(String(value))} options={categoryOptions} />
          </div>
          <Input aria-label="搜索模板、岗位、求职阶段或内容亮点" placeholder="搜索岗位、阶段或内容亮点" prefix={<SearchOutlined style={{ color: neutral[400] }} />} value={keyword} onChange={(event) => setKeyword(event.target.value)} allowClear className="template-library-search" style={{ width: 260 }} />
        </div>
      </div>
      <main className="template-library-container template-library-results">
        {loading ? <div style={{ textAlign: 'center', padding: '80px 0' }} role="status" aria-label="正在加载模板"><Spin size="large" /></div>
          : loadFailed ? <Empty description="模板加载失败，请稍后重试" style={{ padding: '60px 0' }}><Button onClick={() => setRetry((value) => value + 1)}>重新加载</Button></Empty>
            : filtered.length === 0 ? <Empty description="没有匹配的模板，试试其他岗位或关键词" style={{ padding: '80px 0' }} />
              : <>
                <p className="template-library-count" aria-live="polite">{filtered.length} 套模板 · 预览无需登录 · 示例内容，请替换为真实经历</p>
                <div className="template-library-grid">
                  {filtered.map(({ template, sample, config }) => (
                    <article key={template.id} className="template-sample-card" data-testid="template-card" data-template-id={template.id} aria-labelledby={`template-title-${template.id}`}>
                      <button type="button" className="template-sample-cover" aria-label={`预览${template.name}${sample ? '完整范文' : '版式'}`} onClick={() => setPreviewTemplate(template)}>
                        <TemplatePreview config={config} sample={sample} width={224} />
                        <span className="template-sample-cover-caption">{sample ? '真实范文节选 · 点击阅读全文' : '版式示意 · 暂无完整范文'}</span>
                      </button>
                      <div className="template-sample-card-info">
                        <div className="template-sample-card-heading">
                          <h2 id={`template-title-${template.id}`}>{template.name}</h2>
                          {!template.isPremium && <span style={{ color: semantic.success, background: semantic.successSoft, padding: '2px 6px', borderRadius: 4, fontSize: 10, whiteSpace: 'nowrap' }}><CheckOutlined /> 免费</span>}
                        </div>
                        {sample && <p className="template-sample-card-stage">{sample.profile.jobTitle} · {sample.profile.experienceLevel}</p>}
                        <p className="template-sample-card-description">{template.description}</p>
                        <div className="template-sample-card-tags">
                          <span>{layoutLabel(config.layout)}</span>
                          {(sample?.profile.highlights || template.tags || []).slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
                          {sample && <span>{sample.sections.length} 个可编辑模块</span>}
                        </div>
                      </div>
                      <div className="template-sample-card-controls">
                        <Button icon={<EyeOutlined />} onClick={() => setPreviewTemplate(template)} aria-label={`预览${template.name}${sample ? '范文' : '版式'}`}>{sample ? '预览范文' : '预览版式'}</Button>
                        <Button type="primary" icon={<ThunderboltOutlined />} loading={usingId === template.id} disabled={Boolean(usingId && usingId !== template.id)} onClick={() => handleUse(template)} aria-label={`使用${template.name}模板`}>使用此模板</Button>
                      </div>
                    </article>
                  ))}
                </div>
              </>}
      </main>
      {previewTemplate && <TemplateSampleModal key={previewTemplate.id} template={previewTemplate} using={usingId === previewTemplate.id} onClose={() => setPreviewTemplate(null)} onUse={handleUse} />}
    </div>
  );
}

function layoutLabel(layout?: string): string {
  return layout === 'two-column' ? '双栏' : layout === 'sidebar' ? '侧边栏' : '单栏';
}
