/**
 * 简历编辑器
 * ------------------------------------------------------------------
 * 三栏工作台：
 *   ┌──────────┬────────────────────────┬──────────────┐
 *   │ 模块管理  │  内容编辑 / 预览        │  样式 / AI    │
 *   │ 232px    │  flex                  │  320px       │
 *   └──────────┴────────────────────────┴──────────────┘
 *
 * 本页是唯一的状态编排者：
 *   - 从 resumeStore 拉取简历详情
 *   - 把 store action 接到各个子面板
 *   - 统一做「本地乐观更新 + 防抖落库」，避免每次敲键盘都打接口
 *
 * 自动保存策略：
 *   内容编辑 → 本地更新（脏标记）→ 800ms 静默后落库
 *   样式调整 → 立即本地更新 + 落库（参数少、改动明确）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Dropdown, Result, Spin, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CloudUploadOutlined,
  DownloadOutlined,
  EyeOutlined,
  HistoryOutlined,
  LoadingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoreOutlined,
  PhoneOutlined,
  RedoOutlined,
  SaveOutlined,
  ShareAltOutlined,
  SlidersOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

import SectionSidebar from '../components/editor/SectionSidebar';
import SectionContentEditor from '../components/editor/SectionContentEditor';
import { GlobalStylePanel, SectionStylePanel } from '../components/editor/StylePanel';
import AiPanel, { AiOptimizeModal } from '../components/editor/AiPanel';
import VersionPanel from '../components/editor/VersionPanel';
import PreviewPanel from '../components/editor/PreviewPanel';
import ExportDialog from '../components/editor/ExportDialog';
import ShareDialog from '../components/editor/ShareDialog';
import SectionIcon from '../components/common/SectionIcon';
import { SECTION_META } from '../constants/sections';
import { useResumeStore } from '../stores/resumeStore';
import {
  normalizeSectionData,
  normalizeTemplateConfig,
  type LayoutConfig,
  type SectionConfig,
  type SectionType,
  type TemplateConfig,
} from '../types/resume';
import { templateApi } from '../services/api';
import { message } from '../utils/antdStatic';
import { DEFAULT_LAYOUT, parseLayout } from '../components/viewer/ResumePreviewEngine';
import { clearConfigKeys, readConfig, writeConfig } from '../components/editor/sectionData';
import { brand, neutral, radius, semantic, shadow, transition } from '../styles/tokens';

// ==================================================================
// 主组件
// ==================================================================

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ---- store ----
  const current = useResumeStore((s) => s.current);
  const detailLoading = useResumeStore((s) => s.detailLoading);
  const saving = useResumeStore((s) => s.saving);
  const lastSavedAt = useResumeStore((s) => s.lastSavedAt);
  const dirty = useResumeStore((s) => s.dirty);
  const versions = useResumeStore((s) => s.versions);

  const fetchDetail = useResumeStore((s) => s.fetchDetail);
  const clearCurrent = useResumeStore((s) => s.clearCurrent);
  const updateMeta = useResumeStore((s) => s.updateMeta);
  const persistMeta = useResumeStore((s) => s.persistMeta);
  const saveLayout = useResumeStore((s) => s.saveLayout);
  const addSection = useResumeStore((s) => s.addSection);
  const updateSectionData = useResumeStore((s) => s.updateSectionData);
  const persistSection = useResumeStore((s) => s.persistSection);
  const renameSection = useResumeStore((s) => s.renameSection);
  const toggleSectionVisible = useResumeStore((s) => s.toggleSectionVisible);
  const deleteSection = useResumeStore((s) => s.deleteSection);
  const reorderSections = useResumeStore((s) => s.reorderSections);
  const duplicateSection = useResumeStore((s) => s.duplicateSection);
  const patchSectionLocal = useResumeStore((s) => s.patchSectionLocal);
  const fetchVersions = useResumeStore((s) => s.fetchVersions);
  const createVersion = useResumeStore((s) => s.createVersion);
  const restoreVersion = useResumeStore((s) => s.restoreVersion);
  const deleteVersionAction = useResumeStore((s) => s.deleteVersion);
  const setCurrent = useResumeStore((s) => s.setCurrent);

  // ---- 本地 UI 状态 ----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<'style' | 'ai' | 'version'>('style');
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [optimize, setOptimize] = useState<{ text: string; apply: (r: string) => void } | null>(
    null
  );
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig | undefined>();
  const [notFound, setNotFound] = useState(false);

  // ---- 响应式布局：小屏始终保住实时预览 ----
  const [vw, setVw] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth
  );
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 宽度阈值：1440+ 三栏全开；1100–1439 收窄；<1100 侧栏可收起，预览优先
  const isNarrow = vw < 1400;
  const isVeryNarrow = vw < 1100;
  /**
   * 极窄屏自动收起侧栏（优先露出预览），放大后自动恢复，
   * 避免「缩一下就再也找不到模块列表」——若用户曾手动关掉，则只恢复被自动收起的那部分。
   */
  const autoCollapsedRef = useRef<{ left: boolean; right: boolean } | null>(null);
  useEffect(() => {
    if (isVeryNarrow) {
      if (!autoCollapsedRef.current) {
        autoCollapsedRef.current = { left: leftOpen, right: rightOpen };
      }
      setLeftOpen(false);
      setRightOpen(false);
    } else if (autoCollapsedRef.current) {
      const saved = autoCollapsedRef.current;
      autoCollapsedRef.current = null;
      if (saved.left) setLeftOpen(true);
      if (saved.right) setRightOpen(true);
    }
    // 仅在跨越窄屏阈值时同步开合；开合值本身写入 ref 保存，无需进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVeryNarrow]);

  const leftWidth = !leftOpen ? 0 : isVeryNarrow ? 200 : isNarrow ? 200 : 232;
  const rightWidth = !rightOpen ? 0 : isNarrow ? 280 : 320;

  /** 正在编辑的内容（本地草稿），用于防抖保存 */
  const draftRef = useRef<{ sectionId: string; data: Record<string, unknown> } | null>(null);
  const timerRef = useRef<number | null>(null);

  // ---------------------------------------------------------------
  // 加载
  // ---------------------------------------------------------------

  useEffect(() => {
    if (!id) return;
    setNotFound(false);
    fetchDetail(id).catch(() => setNotFound(true));
    fetchVersions(id);
    return () => {
      clearCurrent();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [id, fetchDetail, fetchVersions, clearCurrent]);

  // 默认选中第一个模块
  useEffect(() => {
    if (!current) return;
    if (selectedId && current.sections.some((s) => s.id === selectedId)) return;
    const first =
      current.sections.find((s) => s.sectionType === 'basic') || current.sections[0] || null;
    setSelectedId(first ? first.id : null);
  }, [current, selectedId]);

  // 模板配置（用于字号/主色/标题样式的默认值）
  useEffect(() => {
    const templateId = current?.templateId;
    if (!templateId) {
      setTemplateConfig(undefined);
      return;
    }
    let cancelled = false;
    templateApi
      .detail(templateId)
      .then((t) => {
        if (!cancelled) setTemplateConfig(normalizeTemplateConfig(t.config));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [current?.templateId]);

  // 离开页面前提醒未保存
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // 快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        flushSave();
        message.success('已保存');
      }
      if (meta && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setExportOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------
  // 数据派生
  // ---------------------------------------------------------------

  const sections = useMemo(() => current?.sections ?? [], [current?.sections]);
  const selectedSection = useMemo(
    () => sections.find((s) => s.id === selectedId) || null,
    [sections, selectedId]
  );

  const layout = useMemo(() => parseLayout(current?.layoutConfig), [current?.layoutConfig]);
  /**
   * 全局排版：先铺默认值，再用用户配置覆盖，最后补齐枚举字段。
   * 注意 themeColor 不参与 Required —— 它是可选的覆盖项。
   */
  const resolvedLayout = useMemo(
    () => ({
      ...DEFAULT_LAYOUT,
      ...layout,
      layout: (layout.layout || 'single-column') as LayoutConfig['layout'],
    }),
    [layout]
  );

  const themeColor =
    templateConfig?.primaryColor || layout.themeColor || current?.themeColor || brand.primary;
  const globalHeaderStyle = useMemo<
    NonNullable<SectionConfig['titleStyle']>
  >(
    () => templateConfig?.headerStyle || resolvedLayout.headerStyle || 'underline',
    [templateConfig?.headerStyle, resolvedLayout.headerStyle]
  );

  const selectedConfig = useMemo(
    () => (selectedSection ? readConfig(selectedSection.data) : {}),
    [selectedSection]
  );

  // ---------------------------------------------------------------
  // 保存
  // ---------------------------------------------------------------

  /** 立即把草稿落库 */
  const flushSave = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const draft = draftRef.current;
    if (draft) {
      draftRef.current = null;
      persistSection(draft.sectionId).catch(() => undefined);
    }
    if (dirty) {
      persistMeta({}).catch(() => undefined);
    }
  }, [dirty, persistMeta, persistSection]);

  /** 立即把本地内容同步到 store（用于切换模块 / 关闭页面） */
  const flushLocal = useCallback(() => {
    const draft = draftRef.current;
    if (!draft) return;
    draftRef.current = null;
    updateSectionData(draft.sectionId, draft.data);
  }, [updateSectionData]);

  /** 内容编辑：本地立即更新 + 防抖落库 */
  const handleContentChange = useCallback(
    (sectionId: string, data: Record<string, unknown>) => {
      const withConfig = { ...data };
      updateSectionData(sectionId, withConfig);
      draftRef.current = { sectionId, data: withConfig };

      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        draftRef.current = null;
        timerRef.current = null;
        persistSection(sectionId).catch(() => undefined);
      }, 800);
    },
    [updateSectionData, persistSection]
  );

  /** 样式调整：本地立即更新 + 落库（改动明确，不必防抖太久） */
  const handleSectionStyleChange = useCallback(
    (patch: Partial<SectionConfig>) => {
      if (!selectedSection) return;
      const next = writeConfig(selectedSection.data, patch);
      updateSectionData(selectedSection.id, next);
      // 复用同一把定时器，避免与内容保存竞争
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        persistSection(selectedSection.id).catch(() => undefined);
      }, 400);
    },
    [selectedSection, updateSectionData, persistSection]
  );

  const handleSectionStyleReset = useCallback(() => {
    if (!selectedSection) return;
    const next = clearConfigKeys(selectedSection.data, [
      'titleFontSize',
      'contentFontSize',
      'titleColor',
      'textColor',
      'lineSpacing',
      'textAlign',
      'titleStyle',
      'hideTitle',
    ]);
    updateSectionData(selectedSection.id, next);
    persistSection(selectedSection.id).catch(() => undefined);
    message.success('已恢复默认样式');
  }, [selectedSection, updateSectionData, persistSection]);

  /** 全局样式 */
  const handleGlobalStyleChange = useCallback(
    (patch: Partial<LayoutConfig>) => {
      saveLayout({ ...resolvedLayout, ...patch }).catch(() => undefined);
    },
    [resolvedLayout, saveLayout]
  );

  /** 批量写回某个模块的 data（AI 应用、批量优化用） */
  const applyToSection = useCallback(
    (sectionId: string, producer: (data: Record<string, unknown>) => Record<string, unknown>) => {
      const target = sections.find((s) => s.id === sectionId);
      if (!target) return false;
      const next = producer(normalizeSectionData(target.data));
      updateSectionData(sectionId, next);
      persistSection(sectionId).catch(() => undefined);
      return true;
    },
    [sections, updateSectionData, persistSection]
  );

  /** AI：把生成的总结写入「个人总结」模块 */
  const handleApplySummary = useCallback(
    (text: string) => {
      let target = sections.find((s) => s.sectionType === 'summary');
      if (target) {
        applyToSection(target.id, (data) => ({ ...data, content: text }));
        setSelectedId(target.id);
        message.success('已写入「个人总结」模块');
        return;
      }
      // 没有该模块则先创建，再写入
      addSection('summary')
        .then(() => {
          const created = useResumeStore
            .getState()
            .current?.sections.find((s) => s.sectionType === 'summary');
          if (!created) return;
          updateSectionData(created.id, {
            ...normalizeSectionData(created.data),
            content: text,
          });
          persistSection(created.id).catch(() => undefined);
          setSelectedId(created.id);
          message.success('已创建「个人总结」模块并写入内容');
        })
        .catch(() => message.error('写入失败'));
    },
    [sections, applyToSection, addSection, updateSectionData, persistSection]
  );

  // ---------------------------------------------------------------
  // 模块操作
  // ---------------------------------------------------------------

  const handleAddSection = useCallback(
    (type: SectionType) => {
      flushLocal();
      addSection(type)
        .then(() => {
          // 新建后自动选中该模块，便于直接开始输入
          const created = useResumeStore
            .getState()
            .current?.sections.slice()
            .sort((a, b) => b.sortOrder - a.sortOrder)
            .find((s) => s.sectionType === type);
          if (created) setSelectedId(created.id);
        })
        .catch(() => message.error('添加模块失败'));
    },
    [addSection, flushLocal]
  );

  const handleSelect = useCallback(
    (nextId: string) => {
      if (nextId === selectedId) return;
      flushLocal();
      flushSave();
      setSelectedId(nextId);
    },
    [selectedId, flushLocal, flushSave]
  );

  const handleDelete = useCallback(
    (sectionId: string) => {
      const target = sections.find((s) => s.id === sectionId);
      deleteSection(sectionId)
        .then(() => {
          if (selectedId === sectionId) setSelectedId(null);
          message.success(`已删除「${target ? SECTION_META[target.sectionType]?.label : '模块'}」`);
        })
        .catch(() => message.error('删除失败'));
    },
    [sections, selectedId, deleteSection]
  );

  const handleJumpToBasic = useCallback(() => {
    const basic = sections.find((s) => s.sectionType === 'basic');
    if (basic) handleSelect(basic.id);
  }, [sections, handleSelect]);

  const handleRenameSection = useCallback(
    (name: string) => {
      if (!selectedSection) return;
      renameSection(selectedSection.id, name);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        persistSection(selectedSection.id).catch(() => undefined);
      }, 400);
    },
    [selectedSection, renameSection, persistSection]
  );

  // ---------------------------------------------------------------
  // 标题重命名
  // ---------------------------------------------------------------

  const commitTitle = () => {
    const next = titleDraft.trim();
    setTitleEditing(false);
    if (!next || next === current?.title) return;
    updateMeta({ title: next });
    persistMeta({ title: next }).catch(() => message.error('重命名失败'));
  };

  // ---------------------------------------------------------------
  // 渲染
  // ---------------------------------------------------------------

  if (notFound) {
    return (
      <Result
        status="404"
        title="简历不存在"
        subTitle="它可能已被删除，或你没有访问权限。"
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            返回我的简历
          </Button>
        }
        style={{ paddingTop: 120 }}
      />
    );
  }

  if (detailLoading && !current) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 14,
          background: neutral[25],
        }}
      >
        <Spin indicator={<LoadingOutlined style={{ fontSize: 28, color: brand.primary }} spin />} />
        <span style={{ fontSize: 13, color: neutral[400] }}>正在加载简历…</span>
      </div>
    );
  }


  /** 把当前简历的版式/主题保存为自定义模板 */
  const handleSaveAsTemplate = useCallback(async () => {
    const name = window.prompt('模板名称', `${current?.title || '我的简历'} 模板`);
    if (!name || !name.trim()) return;
    try {
      await templateApi.create({
        name: name.trim(),
        description: '由当前简历样式保存',
        category: 'custom',
        tags: ['自定义'],
        config: JSON.stringify({
          layout: resolvedLayout.layout || 'single-column',
          headerStyle: resolvedLayout.headerStyle || 'underline',
          primaryColor: themeColor,
          fonts: [resolvedLayout.globalFontFamily || 'system-ui'],
        }),
      });
      message.success('已保存为模板，可在模板页使用');
    } catch {
      message.error('保存模板失败');
    }
  }, [current?.title, resolvedLayout, themeColor]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ============ 顶栏 ============ */}
      <header
        style={{
          height: 56,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 14px',
          background: '#fff',
          borderBottom: `1px solid ${neutral[150]}`,
          zIndex: 20,
        }}
      >
        <Tooltip title="返回我的简历" mouseEnterDelay={0.4}>
          <button onClick={() => navigate('/dashboard')} style={iconBtn}>
            <ArrowLeftOutlined />
          </button>
        </Tooltip>

        <span
          style={{ width: 1, height: 20, background: neutral[150], margin: '0 4px' }}
          aria-hidden
        />

        {/* 标题 */}
        {titleEditing ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') setTitleEditing(false);
            }}
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: neutral[800],
              border: `1px solid ${brand.primary}`,
              borderRadius: radius.sm,
              padding: '3px 8px',
              outline: 'none',
              width: 220,
            }}
          />
        ) : (
          <Tooltip title="点击重命名" mouseEnterDelay={0.4}>
            <button
              onClick={() => {
                setTitleDraft(current?.title || '');
                setTitleEditing(true);
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'text',
                fontSize: 14,
                fontWeight: 600,
                color: neutral[800],
                padding: '3px 6px',
                borderRadius: radius.sm,
                maxWidth: 260,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {current?.title || '未命名简历'}
            </button>
          </Tooltip>
        )}

        {/* 保存状态 */}
        <SaveIndicator saving={saving} dirty={dirty} lastSavedAt={lastSavedAt} />

        <span style={{ flex: 1 }} />

        {/* 窄屏面板开关：优先保证预览可见；收起后始终露出，避免找不到入口 */}
        <Tooltip title={leftOpen ? '收起模块列表' : '展开模块列表'} mouseEnterDelay={0.4}>
          <button
            onClick={() => setLeftOpen((v) => !v)}
            style={{
              ...textBtn,
              color: leftOpen ? brand.primary : neutral[600],
              background: leftOpen ? '#fff' : brand.primarySoft,
              borderColor: leftOpen ? neutral[200] : brand.primaryBorder,
            }}
          >
            <MenuFoldOutlined style={{ fontSize: 13, transform: leftOpen ? 'none' : 'rotate(180deg)' }} />
            {!isNarrow && '模块'}
          </button>
        </Tooltip>
        <Tooltip title={rightOpen ? '收起样式/AI 面板' : '展开样式/AI 面板'} mouseEnterDelay={0.4}>
          <button
            onClick={() => setRightOpen((v) => !v)}
            style={{
              ...textBtn,
              color: rightOpen ? brand.primary : neutral[600],
              background: rightOpen ? '#fff' : brand.primarySoft,
              borderColor: rightOpen ? neutral[200] : brand.primaryBorder,
            }}
          >
            <MenuUnfoldOutlined style={{ fontSize: 13, transform: rightOpen ? 'none' : 'rotate(180deg)' }} />
            {!isNarrow && '面板'}
          </button>
        </Tooltip>

        {/* 右侧操作 */}
        <Tooltip title="分享只读链接" mouseEnterDelay={0.4}>
          <button onClick={() => setShareOpen(true)} style={{ ...textBtn, position: 'relative' }}>
            <ShareAltOutlined style={{ fontSize: 13 }} />
            分享
            {current?.shareEnabled && (
              <span
                style={{
                  position: 'absolute',
                  top: 3,
                  right: 3,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: brand.primary,
                  border: '1.5px solid #fff',
                }}
              />
            )}
          </button>
        </Tooltip>

        <Tooltip title="导出 PDF（Ctrl+P）" mouseEnterDelay={0.4}>
          <button onClick={() => setExportOpen(true)} style={textBtn}>
            <DownloadOutlined style={{ fontSize: 13 }} />
            导出
          </button>
        </Tooltip>

        <Tooltip title="把当前版式与配色保存为我的模板" mouseEnterDelay={0.4}>
          <button onClick={handleSaveAsTemplate} style={textBtn}>
            <SaveOutlined style={{ fontSize: 13 }} />
            存为模板
          </button>
        </Tooltip>

        <button
          onClick={() => {
            flushSave();
            message.success('已保存');
          }}
          style={{
            ...textBtn,
            background: brand.gradient,
            color: '#fff',
            border: 'none',
            padding: '0 14px',
            height: 32,
            marginLeft: 4,
          }}
        >
          <CloudUploadOutlined style={{ fontSize: 13 }} />
          保存
        </button>

        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            items: [
              {
                key: 'export',
                icon: <DownloadOutlined />,
                label: '导出 PDF',
                onClick: () => setExportOpen(true),
              },
              {
                key: 'print',
                icon: <EyeOutlined />,
                label: '打印预览',
                onClick: () => {
                  window.print();
                },
              },
              { type: 'divider' },
              {
                key: 'dashboard',
                icon: <ArrowLeftOutlined />,
                label: '返回我的简历',
                onClick: () => {
                  flushSave();
                  navigate('/dashboard');
                },
              },
            ],
          }}
        >
          <button style={{ ...iconBtn, marginLeft: 2 }}>
            <MoreOutlined />
          </button>
        </Dropdown>
      </header>

      {/* ============ 工作区 ============ */}
      <div
        className="editor-workspace"
        style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
          overflow: isVeryNarrow ? 'auto' : 'hidden',
          overflowX: isVeryNarrow ? 'auto' : 'hidden',
        }}
      >
        {/* ---------- 左：模块管理 ---------- */}
        {/* 收起后保留「右拉」把手，拖拽或点击即可重新拉出模块列表 */}
        {!leftOpen && (
          <button
            type="button"
            title="拖拽或点击展开模块列表"
            aria-label="展开模块列表"
            onClick={() => setLeftOpen(true)}
            onMouseDown={(e) => {
              const startX = e.clientX;
              const onMove = (ev: MouseEvent) => {
                if (ev.clientX - startX > 24) {
                  setLeftOpen(true);
                  cleanup();
                }
              };
              const onUp = () => cleanup();
              const cleanup = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
            style={{
              width: 18,
              flexShrink: 0,
              border: 'none',
              borderRight: `1px solid ${neutral[150]}`,
              background: neutral[25],
              cursor: 'e-resize',
              color: neutral[400],
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              userSelect: 'none',
            }}
          >
            <MenuUnfoldOutlined style={{ fontSize: 11, transform: 'none' }} />
          </button>
        )}
        {leftOpen && (
          <aside style={{ width: leftWidth, flexShrink: 0, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
            <SectionSidebar
              sections={sections}
              selectedId={selectedId}
              onSelect={handleSelect}
              onAdd={handleAddSection}
              onReorder={(ids) => reorderSections(ids).catch(() => undefined)}
              onToggleVisible={(sid) => toggleSectionVisible(sid).catch(() => undefined)}
              onDuplicate={(sid) => duplicateSection(sid).catch(() => undefined)}
              onDelete={handleDelete}
              onJumpToBasic={handleJumpToBasic}
            />
            {/* 右缘拉手：向左拖可收起，双击也可收起 */}
            <div
              title="向左拖拽收起模块列表"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const onMove = (ev: MouseEvent) => {
                  if (startX - ev.clientX > 32) {
                    setLeftOpen(false);
                    cleanup();
                  }
                };
                const onUp = () => cleanup();
                const cleanup = () => {
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 6,
                height: '100%',
                cursor: 'w-resize',
                background: 'transparent',
                zIndex: 2,
              }}
            />
          </aside>
        )}

        {/* ---------- 中：编辑区 ---------- */}
        <main
          style={{
            flex: '1 1 46%',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            borderRight: `1px solid ${neutral[150]}`,
          }}
        >
          {selectedSection ? (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 22px',
                  borderBottom: `1px solid ${neutral[150]}`,
                  flexShrink: 0,
                }}
              >
                <SectionIcon
                  name={SECTION_META[selectedSection.sectionType]?.icon ?? 'file'}
                  style={{ fontSize: 14, color: brand.primary }}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: neutral[800] }}>
                  {selectedConfig.moduleName ||
                    SECTION_META[selectedSection.sectionType]?.label ||
                    '模块'}
                </span>
                {selectedSection.isVisible === false && (
                  <span
                    style={{
                      fontSize: 10.5,
                      color: neutral[400],
                      background: neutral[100],
                      borderRadius: radius.xs,
                      padding: '1px 6px',
                    }}
                  >
                    已隐藏
                  </span>
                )}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11.5, color: neutral[400] }}>Ctrl+S 保存</span>
              </div>

              <div
                className="thin-scroll"
                style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 60px' }}
              >
                <div style={{ maxWidth: 640 }}>
                  <SectionContentEditor
                    key={selectedSection.id}
                    sectionType={selectedSection.sectionType}
                    data={selectedSection.data}
                    onChange={(data) => handleContentChange(selectedSection.id, data)}
                    jobTitle={current?.targetJob || String(normalizeSectionData(
                      sections.find((s) => s.sectionType === 'basic')?.data
                    ).jobTitle || '')}
                    onOptimize={(text, apply) => setOptimize({ text, apply })}
                  />
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 10,
                color: neutral[400],
              }}
            >
              <span style={{ fontSize: 32, opacity: 0.4 }}>📝</span>
              <span style={{ fontSize: 13.5, color: neutral[500] }}>从左侧选择一个模块开始编辑</span>
            </div>
          )}
        </main>

        {/* ---------- 中偏右：预览（始终可见） ---------- */}
        <section
          className="editor-preview-pane"
          style={{
            flex: '1 1 38%',
            minWidth: isVeryNarrow ? 300 : isNarrow ? 280 : 320,
            display: 'flex',
            flexDirection: 'column',
            background: neutral[100],
          }}
        >
          <PreviewPanel
            resume={current}
            templateConfig={templateConfig}
            focusSectionId={selectedId}
            initialScale={isNarrow ? 0.72 : 0.8}
          />
        </section>

        {/* ---------- 右：样式 / AI / 版本 ---------- */}
        {/* 收起后保留「左拉」把手 */}
        {!rightOpen && (
          <button
            type="button"
            title="拖拽或点击展开样式/AI 面板"
            aria-label="展开样式/AI 面板"
            onClick={() => setRightOpen(true)}
            onMouseDown={(e) => {
              const startX = e.clientX;
              const onMove = (ev: MouseEvent) => {
                if (startX - ev.clientX > 24) {
                  setRightOpen(true);
                  cleanup();
                }
              };
              const onUp = () => cleanup();
              const cleanup = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
            style={{
              width: 18,
              flexShrink: 0,
              border: 'none',
              borderLeft: `1px solid ${neutral[150]}`,
              background: neutral[25],
              cursor: 'w-resize',
              color: neutral[400],
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              userSelect: 'none',
            }}
          >
            <MenuFoldOutlined style={{ fontSize: 11, transform: 'none' }} />
          </button>
        )}
        {rightOpen && (
        <aside
          style={{
            width: rightWidth,
            flexShrink: 0,
            background: '#fff',
            borderLeft: `1px solid ${neutral[150]}`,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            position: 'relative',
          }}
        >
          {/* 页签 */}
          <div
            style={{
              display: 'flex',
              borderBottom: `1px solid ${neutral[150]}`,
              flexShrink: 0,
            }}
          >
            {(
              [
                { key: 'style', label: '样式', icon: <SlidersOutlined /> },
                { key: 'ai', label: 'AI 助手', icon: <ThunderboltOutlined /> },
                { key: 'version', label: '版本', icon: <HistoryOutlined /> },
              ] as const
            ).map((t) => {
              const active = rightTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setRightTab(t.key)}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    padding: '12px 0',
                    fontSize: 12.5,
                    fontWeight: active ? 600 : 400,
                    color: active ? brand.primary : neutral[500],
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    borderBottom: `2px solid ${active ? brand.primary : 'transparent'}`,
                    marginBottom: -1,
                    transition: transition.fast,
                  }}
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* 面板内容 */}
          <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {rightTab === 'style' && (
              <div key="style" className="animate-fade">
                {selectedSection && (
                  <SectionStylePanel
                    sectionType={selectedSection.sectionType}
                    config={selectedConfig}
                    themeColor={themeColor}
                    baseFontSize={resolvedLayout.globalFontSize}
                    baseLineSpacing={resolvedLayout.globalLineSpacing}
                    globalHeaderStyle={globalHeaderStyle}
                    onChange={handleSectionStyleChange}
                    onReset={handleSectionStyleReset}
                  />
                )}

                <GlobalStylePanel
                  layout={{
                    ...resolvedLayout,
                    layout: resolvedLayout.layout || 'single-column',
                    themeColor: resolvedLayout.themeColor || themeColor,
                  }}
                  themeColor={themeColor}
                  onChange={handleGlobalStyleChange}
                  onThemeColor={(color) => saveLayout({ ...resolvedLayout, themeColor: color })}
                />
              </div>
            )}

            {rightTab === 'ai' && (
              <div key="ai" style={{ height: '100%' }}>
                <AiPanel
                  resume={current}
                  onApplySummary={handleApplySummary}
                  onApplyBullets={() => undefined}
                />
              </div>
            )}

            {rightTab === 'version' && (
              <div key="version" style={{ height: '100%' }}>
                <VersionPanel
                  versions={versions}
                  saving={saving}
                  onCreate={createVersion}
                  onRestore={restoreVersion}
                  onDelete={deleteVersionAction}
                />
              </div>
            )}
          </div>
          {/* 左缘拉手：向右拖可收起 */}
          <div
            title="向右拖拽收起样式/AI 面板"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const onMove = (ev: MouseEvent) => {
                if (ev.clientX - startX > 32) {
                  setRightOpen(false);
                  cleanup();
                }
              };
              const onUp = () => cleanup();
              const cleanup = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 6,
              height: '100%',
              cursor: 'e-resize',
              background: 'transparent',
              zIndex: 2,
            }}
          />
        </aside>
        )}
      </div>

      {/* ============ 弹层 ============ */}
      <ExportDialog
        open={exportOpen}
        resume={current}
        templateConfig={templateConfig}
        onClose={() => setExportOpen(false)}
      />

      <ShareDialog
        open={shareOpen}
        resume={current}
        onClose={() => setShareOpen(false)}
        onChanged={(patch) => {
          if (current) setCurrent({ ...current, ...patch });
        }}
      />

      <AiOptimizeModal
        open={!!optimize}
        source={optimize?.text || ''}
        jobTitle={current?.targetJob}
        onClose={() => setOptimize(null)}
        onApply={(text) => optimize?.apply(text)}
      />
    </div>
  );
}

// ==================================================================
// 保存状态指示
// ==================================================================

function SaveIndicator({
  saving,
  dirty,
  lastSavedAt,
}: {
  saving: boolean;
  dirty: boolean;
  lastSavedAt: number | null;
}) {
  const [, force] = useState(0);

  // 让「x 秒前」自动刷新
  useEffect(() => {
    const t = window.setInterval(() => force((v) => v + 1), 15000);
    return () => window.clearInterval(t);
  }, []);

  const text = saving
    ? '保存中…'
    : dirty
      ? '有未保存的修改'
      : lastSavedAt
        ? `已保存 · ${relativeTime(lastSavedAt)}`
        : '已自动保存';

  const color = saving ? neutral[400] : dirty ? semantic.warning : semantic.success;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11.5,
        color,
        padding: '3px 9px',
        background: dirty ? semantic.warningSoft : neutral[25],
        border: `1px solid ${dirty ? semantic.warningBorder : neutral[150]}`,
        borderRadius: radius.pill,
        whiteSpace: 'nowrap',
      }}
    >
      {saving ? (
        <LoadingOutlined spin style={{ fontSize: 11 }} />
      ) : (
        <CheckCircleFilled style={{ fontSize: 11 }} />
      )}
      {text}
    </span>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 10000) return '刚刚';
  if (diff < 60000) return `${Math.floor(diff / 1000)} 秒前`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  return `${Math.floor(diff / 3600000)} 小时前`;
}

// ==================================================================
// 样式常量
// ==================================================================

const iconBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: neutral[500],
  width: 32,
  height: 32,
  borderRadius: radius.md,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: 14,
  transition: transition.fast,
};

const textBtn: React.CSSProperties = {
  border: `1px solid ${neutral[200]}`,
  background: '#fff',
  color: neutral[600],
  height: 32,
  borderRadius: radius.md,
  padding: '0 12px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  cursor: 'pointer',
  fontSize: 12.5,
  fontWeight: 500,
  transition: transition.fast,
  marginLeft: 2,
};
