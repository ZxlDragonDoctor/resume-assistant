/**
 * 模板库
 * ------------------------------------------------------------------
 * 左侧分类筛选，右侧模板卡片网格。
 * 每张卡片用 CSS 渲染模板的版式骨架（而非图片），
 * 配色跟随模板的 primaryColor，鼠标悬浮时展示「使用此模板」。
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as AntApp, Button, Empty, Input, Segmented, Spin } from 'antd';
import { CheckOutlined, SearchOutlined, ThunderboltOutlined } from '@ant-design/icons';

import TemplatePreview from '../components/templates/TemplatePreview';
import { templateApi, auth } from '../services/api';
import { useResumeStore } from '../stores/resumeStore';
import {
  normalizeTemplateConfig,
  type Template,
  type TemplateCategory,
} from '../types/resume';
import { brand, layout as layoutTokens, neutral, radius, semantic, shadow, space } from '../styles/tokens';

export default function Templates() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const { createResume } = useResumeStore();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [usingId, setUsingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([templateApi.list(), templateApi.categories()])
      .then(([list, cats]) => {
        setTemplates(list);
        setCategories(cats);
      })
      .catch(() => {
        setTemplates([]);
        setCategories([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = templates;
    if (activeCategory !== 'all') {
      list = list.filter((t) => t.category === activeCategory);
    }
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(kw) ||
          (t.description || '').toLowerCase().includes(kw) ||
          (t.tags || []).some((tag) => tag.toLowerCase().includes(kw))
      );
    }
    return list;
  }, [templates, activeCategory, keyword]);

  /** 用某套模板创建简历并进入编辑器 */
  const handleUse = async (template: Template) => {
    if (!auth.getToken()) {
      message.info('请先登录后再使用模板');
      navigate('/login', { state: { from: '/templates' } });
      return;
    }
    setUsingId(template.id);
    try {
      const resume = await createResume(`${template.name}简历`, template.id);
      message.success('已基于该模板创建简历');
      navigate(`/editor/${resume.id}`);
    } finally {
      setUsingId(null);
    }
  };

  const categoryOptions = [
    { value: 'all', label: `全部 ${templates.length}` },
    ...categories.map((c) => ({ value: c.key, label: `${c.label} ${c.count}` })),
  ];

  return (
    <div style={{ background: neutral[25], minHeight: 'calc(100vh - 56px)' }}>
      {/* ---------------- 页头 ---------------- */}
      <div
        style={{
          background: '#fff',
          borderBottom: `1px solid ${neutral[150]}`,
          padding: `${space.xxxl}px 32px ${space.xxl}px`,
        }}
      >
        <div style={{ maxWidth: layoutTokens.contentMaxWidth, margin: '0 auto' }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: neutral[900],
              letterSpacing: -0.5,
              marginBottom: 8,
            }}
          >
            简历模板
          </h1>
          <p style={{ fontSize: 14.5, color: neutral[500], maxWidth: 620, lineHeight: 1.7 }}>
            每套模板都是独立的版式与配色方案。选定后仍可在编辑器内自由调整字体、颜色和间距，
            切换到其它模板时内容不会丢失。
          </p>
        </div>
      </div>

      {/* ---------------- 筛选条 ---------------- */}
      <div
        style={{
          position: 'sticky',
          top: 56,
          zIndex: 50,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${neutral[150]}`,
          padding: '14px 32px',
        }}
      >
        <div
          style={{
            maxWidth: layoutTokens.contentMaxWidth,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <Segmented
            value={activeCategory}
            onChange={(v) => setActiveCategory(v as string)}
            options={categoryOptions}
          />
          <Input
            placeholder="搜索模板名称或标签"
            prefix={<SearchOutlined style={{ color: neutral[400] }} />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
            style={{ width: 240, borderRadius: radius.md }}
          />
        </div>
      </div>

      {/* ---------------- 网格 ---------------- */}
      <div
        style={{
          maxWidth: layoutTokens.contentMaxWidth,
          margin: '0 auto',
          padding: `${space.xxl}px 32px ${space.giant}px`,
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Spin size="large" />
          </div>
        ) : filtered.length === 0 ? (
          <Empty description="没有匹配的模板" style={{ padding: '80px 0' }} />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))',
              gap: 22,
            }}
          >
            {filtered.map((template) => {
              const config = normalizeTemplateConfig(template.config);
              return (
                <div
                  key={template.id}
                  className="template-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleUse(template)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleUse(template);
                    }
                  }}
                  style={{
                    background: '#fff',
                    borderRadius: radius.xl,
                    border: `1px solid ${neutral[150]}`,
                    boxShadow: shadow.xs,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                  }}
                >
                  {/* 预览区 */}
                  <div
                    style={{
                      position: 'relative',
                      height: 210,
                      background: `linear-gradient(160deg, ${neutral[50]}, ${neutral[100]})`,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      paddingTop: 20,
                      borderBottom: `1px solid ${neutral[150]}`,
                      overflow: 'hidden',
                    }}
                  >
                    <TemplatePreview config={config} width={148} />

                    {/* 悬浮操作 */}
                    <div
                      className="template-card-actions"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(15,23,42,0.44)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Button
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        loading={usingId === template.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUse(template);
                        }}
                        style={{
                          height: 38,
                          padding: '0 20px',
                          borderRadius: radius.md,
                          fontWeight: 500,
                          background: brand.gradient,
                          border: 'none',
                        }}
                      >
                        使用此模板
                      </Button>
                    </div>
                  </div>

                  {/* 信息区 */}
                  <div style={{ padding: '15px 17px 17px', flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: neutral[900],
                        }}
                      >
                        {template.name}
                      </span>
                      {!template.isPremium && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: semantic.success,
                            background: semantic.successSoft,
                            padding: '2px 7px',
                            borderRadius: radius.xs,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <CheckOutlined style={{ fontSize: 9 }} />
                          免费
                        </span>
                      )}
                    </div>

                    <p
                      style={{
                        fontSize: 12.5,
                        color: neutral[500],
                        lineHeight: 1.65,
                        marginBottom: 12,
                        minHeight: 40,
                      }}
                    >
                      {template.description}
                    </p>

                    {/* 标签 */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(template.tags || []).slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 11,
                            color: neutral[600],
                            background: neutral[100],
                            padding: '2px 8px',
                            borderRadius: radius.xs,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                      <span
                        style={{
                          fontSize: 11,
                          color: config.primaryColor || brand.primary,
                          background: `${config.primaryColor || brand.primary}12`,
                          padding: '2px 8px',
                          borderRadius: radius.xs,
                          fontWeight: 500,
                        }}
                      >
                        {layoutLabel(config.layout)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function layoutLabel(layout?: string): string {
  switch (layout) {
    case 'two-column':
      return '双栏';
    case 'sidebar':
      return '侧边栏';
    default:
      return '单栏';
  }
}
