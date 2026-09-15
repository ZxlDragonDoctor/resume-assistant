/**
 * 我的简历（工作台首页）
 * ------------------------------------------------------------------
 * 顶部：欢迎语 + 关键指标卡
 * 主体：简历卡片网格，含缩略图、状态、操作
 * 交互：新建（可选模板）、复制、重命名、分享、删除
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App as AntApp,
  Button,
  Dropdown,
  Empty,
  Input,
  Modal,
  Segmented,
  Select,
  Tag,
  Tooltip,
} from 'antd';
import {
  AppstoreOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  EyeOutlined,
  FileTextOutlined,
  LinkOutlined,
  PlusOutlined,
  SearchOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import ResumeThumbnail from '../components/dashboard/ResumeThumbnail';
import StatCards from '../components/dashboard/StatCards';
import { useResumeStore } from '../stores/resumeStore';
import { useAuthStore } from '../stores/authStore';
import { templateApi } from '../services/api';
import type { Resume, Template } from '../types/resume';
import { brand, layout, neutral, radius, shadow, space } from '../styles/tokens';

type FilterKey = 'all' | 'draft' | 'complete' | 'shared';

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'complete', label: '已完成' },
  { value: 'shared', label: '已分享' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { message, modal } = AntApp.useApp();
  const user = useAuthStore((s) => s.user);

  const {
    resumes,
    stats,
    listLoading,
    fetchList,
    fetchStats,
    createResume,
    duplicateResume,
    deleteResume,
    updateMeta,
    persistMeta,
  } = useResumeStore();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTemplate, setNewTemplate] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [keyword, setKeyword] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    fetchList();
    fetchStats();
    templateApi.list().then(setTemplates).catch(() => setTemplates([]));
  }, [fetchList, fetchStats]);

  // ---------------------------------------------------------------
  // 过滤
  // ---------------------------------------------------------------
  const filtered = useMemo(() => {
    let list = resumes;
    if (filter === 'draft') list = list.filter((r) => r.status !== 'complete');
    if (filter === 'complete') list = list.filter((r) => r.status === 'complete');
    if (filter === 'shared') list = list.filter((r) => r.shareEnabled);
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(kw) ||
          (r.targetJob || '').toLowerCase().includes(kw) ||
          (r.targetCompany || '').toLowerCase().includes(kw)
      );
    }
    return list;
  }, [resumes, filter, keyword]);

  // ---------------------------------------------------------------
  // 操作
  // ---------------------------------------------------------------

  const openCreate = () => {
    setNewTitle(`我的简历 ${resumes.length + 1}`);
    setNewTemplate(templates[0]?.id);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      message.warning('请输入简历名称');
      return;
    }
    setCreating(true);
    try {
      const resume = await createResume(newTitle.trim(), newTemplate);
      setCreateOpen(false);
      fetchStats();
      message.success('简历已创建');
      navigate(`/editor/${resume.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    const newId = await duplicateResume(id);
    fetchStats();
    message.success('已复制一份副本');
    navigate(`/editor/${newId}`);
  };

  const handleDelete = (resume: Resume) => {
    modal.confirm({
      title: '删除这份简历？',
      content: `「${resume.title}」及其所有模块和版本记录将被永久删除，此操作不可恢复。`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await deleteResume(resume.id);
        fetchStats();
        message.success('已删除');
      },
    });
  };

  const handleShare = async (resume: Resume) => {
    const url = `${window.location.origin}/share/${resume.shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      message.success('分享链接已复制到剪贴板');
    } catch {
      modal.info({
        title: '分享链接',
        content: (
          <Input.TextArea value={url} readOnly autoSize style={{ marginTop: 8 }} />
        ),
      });
    }
  };

  const handleRename = async () => {
    if (!renameId || !renameValue.trim()) return;
    updateMeta({ title: renameValue.trim() });
    await persistMeta({ title: renameValue.trim() });
    setRenameId(null);
    message.success('已重命名');
  };

  const cardMenu = (resume: Resume) => ({
    items: [
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: '编辑简历',
        onClick: () => navigate(`/editor/${resume.id}`),
      },
      {
        key: 'rename',
        icon: <FileTextOutlined />,
        label: '重命名',
        onClick: () => {
          setRenameId(resume.id);
          setRenameValue(resume.title);
        },
      },
      {
        key: 'duplicate',
        icon: <CopyOutlined />,
        label: '复制一份',
        onClick: () => handleDuplicate(resume.id),
      },
      { type: 'divider' as const },
      {
        key: 'share',
        icon: <LinkOutlined />,
        label: resume.shareEnabled ? '复制分享链接' : '未开启分享',
        disabled: !resume.shareEnabled,
        onClick: () => handleShare(resume),
      },
      { type: 'divider' as const },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: '删除',
        danger: true,
        onClick: () => handleDelete(resume),
      },
    ],
  });

  // ---------------------------------------------------------------

  return (
    <div
      style={{
        maxWidth: layout.contentMaxWidth,
        margin: '0 auto',
        padding: `${space.xxl}px 32px ${space.giant}px`,
      }}
    >
      {/* ---------------- 标题区 ---------------- */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 20,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: neutral[900],
              letterSpacing: -0.4,
              marginBottom: 6,
            }}
          >
            {user?.name ? `${user.name}，你好` : '我的简历'}
          </h1>
          <p style={{ fontSize: 14, color: neutral[500] }}>
            {stats?.lastEditedAt
              ? `最近编辑于 ${dayjs(stats.lastEditedAt).format('M 月 D 日 HH:mm')}`
              : '创建你的第一份简历，开始记录你的经历'}
          </p>
        </div>

        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={openCreate}
          style={{
            height: 42,
            padding: '0 22px',
            borderRadius: radius.md,
            fontWeight: 500,
            background: brand.gradient,
            border: 'none',
            boxShadow: '0 4px 14px rgba(79,70,229,0.26)',
          }}
        >
          新建简历
        </Button>
      </div>

      {/* ---------------- 指标卡 ---------------- */}
      <StatCards stats={stats} />

      {/* ---------------- 过滤条 ---------------- */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 14,
          margin: '26px 0 18px',
          flexWrap: 'wrap',
        }}
      >
        <Segmented
          value={filter}
          onChange={(v) => setFilter(v as FilterKey)}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
        />

        <Input
          placeholder="搜索简历名称或目标岗位"
          prefix={<SearchOutlined style={{ color: neutral[400] }} />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          allowClear
          style={{ width: 260, borderRadius: radius.md }}
        />
      </div>

      {/* ---------------- 简历网格 ---------------- */}
      {!listLoading && filtered.length === 0 ? (
        <EmptyResumes
          hasResumes={resumes.length > 0}
          onCreate={openCreate}
          onClear={() => {
            setKeyword('');
            setFilter('all');
          }}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))',
            gap: 20,
          }}
        >
          {filtered.map((resume) => (
            <ResumeCard
              key={resume.id}
              resume={resume}
              menu={cardMenu(resume)}
              onOpen={() => navigate(`/editor/${resume.id}`)}
              onShare={() => handleShare(resume)}
            />
          ))}
        </div>
      )}

      {/* ---------------- 新建弹窗 ---------------- */}
      <Modal
        title="新建简历"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        okText="创建并编辑"
        cancelText="取消"
        confirmLoading={creating}
        width={480}
      >
        <div style={{ marginTop: 20 }}>
          <div className="form-group-title">简历名称</div>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onPressEnter={handleCreate}
            placeholder="例如：Java 后端开发 - 2026 春招"
            autoFocus
            style={{ borderRadius: radius.md }}
          />

          <div className="form-group-title" style={{ marginTop: 22 }}>
            选择模板
          </div>
          <Select
            value={newTemplate}
            onChange={setNewTemplate}
            placeholder="选择一套版式"
            style={{ width: '100%' }}
            options={templates.map((t) => ({
              value: t.id,
              label: (
                <span>
                  {t.name}
                  <span style={{ color: neutral[400], fontSize: 12, marginLeft: 8 }}>
                    {t.description?.slice(0, 18)}…
                  </span>
                </span>
              ),
            }))}
          />
          <p style={{ fontSize: 12, color: neutral[400], marginTop: 10, lineHeight: 1.6 }}>
            模板决定初始版式与配色，创建后仍可随时切换，内容不会丢失。
          </p>
        </div>
      </Modal>

      {/* ---------------- 重命名弹窗 ---------------- */}
      <Modal
        title="重命名简历"
        open={Boolean(renameId)}
        onOk={handleRename}
        onCancel={() => setRenameId(null)}
        okText="保存"
        cancelText="取消"
        width={420}
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={handleRename}
          autoFocus
          style={{ marginTop: 16, borderRadius: radius.md }}
        />
      </Modal>
    </div>
  );
}

// ==================================================================
// 简历卡片
// ==================================================================

function ResumeCard({
  resume,
  menu,
  onOpen,
  onShare,
}: {
  resume: Resume;
  menu: { items: unknown[] };
  onOpen: () => void;
  onShare: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="resume-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        borderRadius: radius.xl,
        border: `1px solid ${neutral[150]}`,
        boxShadow: shadow.xs,
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={onOpen}
    >
      {/* 缩略图区 */}
      <div
        style={{
          position: 'relative',
          height: 168,
          background: `linear-gradient(160deg, ${neutral[50]} 0%, ${neutral[100]} 100%)`,
          borderBottom: `1px solid ${neutral[150]}`,
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingTop: 16,
        }}
      >
        <ResumeThumbnail resume={resume} width={150} />

        {/* 悬浮遮罩 */}
        <div
          className="resume-card-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15,23,42,0.42)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            opacity: hovered ? 1 : 0,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          <Button
            icon={<EditOutlined />}
            size="small"
            style={{ borderRadius: radius.md, fontWeight: 500 }}
          >
            编辑
          </Button>
          {resume.shareEnabled && (
            <Tooltip title="复制分享链接">
              <Button
                icon={<ShareAltOutlined />}
                size="small"
                style={{ borderRadius: radius.md }}
                onClick={(e) => {
                  e.stopPropagation();
                  onShare();
                }}
              />
            </Tooltip>
          )}
        </div>
      </div>

      {/* 信息区 */}
      <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                color: neutral[900],
                marginBottom: 5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {resume.title}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: neutral[500],
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {resume.targetJob || '未设置目标岗位'}
            </div>
          </div>

          <Dropdown menu={menu as never} trigger={['click']} placement="bottomRight">
            <Button
              type="text"
              size="small"
              icon={<EllipsisOutlined />}
              onClick={(e) => e.stopPropagation()}
              style={{ color: neutral[400], flexShrink: 0 }}
            />
          </Dropdown>
        </div>

        {/* 元信息 */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {resume.status === 'complete' ? (
            <Tag color="success" style={{ margin: 0, fontSize: 11 }}>
              已完成
            </Tag>
          ) : (
            <Tag style={{ margin: 0, fontSize: 11 }}>草稿</Tag>
          )}

          {resume.shareEnabled && (
            <Tag color="processing" style={{ margin: 0, fontSize: 11 }}>
              已分享
            </Tag>
          )}

          {resume.viewCount > 0 && (
            <span
              style={{
                fontSize: 11.5,
                color: neutral[400],
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <EyeOutlined style={{ fontSize: 11 }} />
              {resume.viewCount}
            </span>
          )}

          <span style={{ fontSize: 11.5, color: neutral[400], marginLeft: 'auto' }}>
            {dayjs(resume.updatedAt).format('M/D')}
          </span>
        </div>
      </div>
    </div>
  );
}

// ==================================================================
// 空状态
// ==================================================================

function EmptyResumes({
  hasResumes,
  onCreate,
  onClear,
}: {
  hasResumes: boolean;
  onCreate: () => void;
  onClear: () => void;
}) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '72px 24px',
        background: '#fff',
        borderRadius: radius.xl,
        border: `2px dashed ${neutral[200]}`,
      }}
    >
      <div
        style={{
          width: 68,
          height: 68,
          borderRadius: 20,
          background: brand.primarySoft,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        {hasResumes ? (
          <SearchOutlined style={{ fontSize: 28, color: brand.primary }} />
        ) : (
          <AppstoreOutlined style={{ fontSize: 28, color: brand.primary }} />
        )}
      </div>

      <div
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: neutral[800],
          marginBottom: 8,
        }}
      >
        {hasResumes ? '没有符合条件的简历' : '还没有简历'}
      </div>
      <p style={{ fontSize: 14, color: neutral[500], marginBottom: 24 }}>
        {hasResumes ? '换个关键词或筛选条件试试' : '创建第一份简历，把经历整理成专业的表达'}
      </p>

      {hasResumes ? (
        <Button onClick={onClear} style={{ borderRadius: radius.md }}>
          清除筛选
        </Button>
      ) : (
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={onCreate}
          style={{
            height: 42,
            padding: '0 22px',
            borderRadius: radius.md,
            background: brand.gradient,
            border: 'none',
          }}
        >
          创建简历
        </Button>
      )}
    </div>
  );
}
