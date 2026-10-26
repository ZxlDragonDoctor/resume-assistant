/** Browsing reads snapshots; restoring explicitly loads an unsaved editor draft. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Empty, Input, Modal, Spin, Tag } from 'antd';
import { ClockCircleOutlined, DeleteOutlined, EyeOutlined, HistoryOutlined, PlusOutlined, RollbackOutlined } from '@ant-design/icons';
import { normalizeTemplateConfig, type ResumeDetail, type ResumeVersion, type TemplateConfig } from '../../types/resume';
import { templateApi } from '../../services/api';
import { message, modal } from '../../utils/antdStatic';
import PreviewPanel from './PreviewPanel';
import { summarizeVersionChanges } from './versionHistory';
import './VersionPanel.css';

type VersionDetail = ResumeVersion & { snapshot: ResumeDetail };
interface Props {
  versions: ResumeVersion[];
  current?: ResumeDetail | null;
  loading?: boolean;
  saving?: boolean;
  onCreate: (label: string, description?: string) => Promise<void>;
  onRestore: (versionId: string) => Promise<void>;
  onDelete: (versionId: string) => Promise<void>;
  onLoadVersion: (versionId: string) => Promise<VersionDetail>;
}
function formatTime(iso: string): string {
  const date = new Date(iso.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('zh-CN', { hour12: false });
}

export default function VersionPanel({ versions, current, loading, saving, onCreate, onRestore, onDelete, onLoadVersion }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VersionDetail | null>(null);
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig>();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [templateWarning, setTemplateWarning] = useState(false);
  const [retry, setRetry] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const requestId = useRef(0);
  const loader = useRef(onLoadVersion);
  loader.current = onLoadVersion;
  const createLock = useRef(false);
  const orderedVersions = useMemo(() => [...versions].sort((a, b) => b.versionNum - a.versionNum), [versions]);
  const changes = useMemo(() => detail && current ? summarizeVersionChanges(detail.snapshot, current) : [], [detail, current]);

  useEffect(() => {
    const request = ++requestId.current;
    let cancelled = false;
    const active = () => !cancelled && request === requestId.current;
    setDetail(null);
    setTemplateConfig(undefined);
    setPreviewError('');
    setTemplateWarning(false);
    if (!selectedId) { setPreviewLoading(false); return; }
    setPreviewLoading(true);
    void (async () => {
      try {
        const version = await loader.current(selectedId);
        if (!active()) return;
        if (version.id !== selectedId || !version.snapshot || !Array.isArray(version.snapshot.sections)) throw new Error('版本快照不完整');
        let config: TemplateConfig | undefined;
        if (version.snapshot.templateId) {
          try {
            const template = await templateApi.detail(version.snapshot.templateId);
            config = normalizeTemplateConfig(template.config);
          } catch {
            if (active()) setTemplateWarning(true);
          }
        }
        if (active()) { setTemplateConfig(config); setDetail(version); }
      } catch {
        if (active()) setPreviewError('无法加载此版本的完整简历，请重试。');
      } finally {
        if (active()) setPreviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId, retry]);

  useEffect(() => { setSelectedId(null); ++requestId.current; }, [current?.id]);
  const closePreview = () => { ++requestId.current; setSelectedId(null); setDetail(null); };
  const handleCreate = async () => {
    if (createLock.current || saving) return;
    createLock.current = true;
    setSubmitting(true);
    try {
      await onCreate(label.trim() || `版本 ${Math.max(0, ...versions.map(v => v.versionNum)) + 1}`, description.trim() || undefined);
      message.success('当前简历已保存，并创建了新版本');
      setCreateOpen(false); setLabel(''); setDescription('');
    } catch { message.error('保存版本失败，请重试'); }
    finally { createLock.current = false; setSubmitting(false); }
  };
  const restore = () => {
    if (!detail || restoring || detail.id !== selectedId) return;
    const version = detail;
    modal.confirm({
      title: `恢复「${version.label || `版本 ${version.versionNum}`}」到编辑区？`,
      content: '这会替换编辑区中的当前草稿。恢复后尚未保存，可通过撤销返回，确认内容后再点击保存。',
      okText: '恢复到编辑区', cancelText: '取消',
      onOk: async () => {
        setRestoring(true);
        try {
          await onRestore(version.id); message.success('已恢复到编辑区，尚未保存'); closePreview();
        } catch (error) { message.error('恢复失败，请重试'); throw error; }
        finally { setRestoring(false); }
      },
    });
  };
  const remove = (version: ResumeVersion) => modal.confirm({
    title: `删除「${version.label || `版本 ${version.versionNum}`}」？`,
    content: '删除后无法再查看或恢复此历史版本，当前编辑区内容不受影响。',
    okText: '删除版本', cancelText: '取消', okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await onDelete(version.id);
        if (selectedId === version.id) closePreview();
        message.success('已删除该版本');
      } catch (error) { message.error('删除失败，请重试'); throw error; }
    },
  });
  const timeline = (inModal = false) => (
    <ol className={`version-log${inModal ? ' version-log--modal' : ''}`} aria-label="简历版本记录">
      {orderedVersions.map((version, index) => (
        <li key={version.id} className={`version-log__item${selectedId === version.id ? ' is-selected' : ''}`}>
          <button type="button" className="version-log__select" onClick={() => setSelectedId(version.id)} aria-pressed={selectedId === version.id} aria-label={`查看版本 ${version.versionNum}：${version.label}`}>
            <span className="version-log__heading"><Tag color={index === 0 ? 'blue' : undefined}>v{version.versionNum}</Tag><strong>{version.label || `版本 ${version.versionNum}`}</strong></span>
            {version.description && <span className="version-log__description">{version.description}</span>}
            <time dateTime={version.createdAt}><ClockCircleOutlined /> {formatTime(version.createdAt)}</time>
            {!inModal && <span className="version-log__inspect"><EyeOutlined /> 查看完整简历</span>}
          </button>
          {!inModal && <Button className="version-log__delete" type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`删除版本 ${version.versionNum}`} title="删除版本" onClick={() => remove(version)} />}
        </li>
      ))}
    </ol>
  );
  return (
    <div className="version-panel">
      <div className="version-panel__header"><HistoryOutlined /><strong>版本历史</strong><Button type="primary" size="small" icon={<PlusOutlined />} loading={saving} onClick={() => setCreateOpen(true)}>保存版本</Button></div>
      <p className="version-panel__hint">点击记录查看完整简历。浏览历史不会修改当前草稿。</p>
      <div className="version-panel__list thin-scroll">
        {loading ? <div className="version-panel__status"><Spin /></div> : versions.length ? timeline() : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有版本记录，保存版本后即可在这里回看。" />}
      </div>
      <Modal open={!!selectedId} onCancel={closePreview} title={<span><HistoryOutlined /> 历史版本 · 完整简历预览</span>} width="min(1440px, calc(100vw - 24px))" className="version-inspector" style={{ top: 16 }} footer={<div className="version-inspector__footer"><span>恢复后尚未保存，确认内容后再保存。</span><Button onClick={closePreview}>关闭</Button><Button type="primary" icon={<RollbackOutlined />} disabled={!detail || previewLoading || detail.id !== selectedId || saving} loading={restoring} onClick={restore}>恢复到编辑区</Button></div>}>
        <div className="version-inspector__layout">
          <aside className="version-inspector__timeline thin-scroll"><div className="version-inspector__timeline-title">{versions.length} 条版本记录</div>{timeline(true)}</aside>
          <section className="version-inspector__content" aria-label="历史简历预览" aria-busy={previewLoading}>
            {previewLoading ? <div className="version-panel__status" role="status"><Spin /><p>正在加载完整简历…</p></div> : previewError ? <div className="version-panel__status"><Alert type="error" showIcon message={previewError} action={<Button size="small" onClick={() => setRetry(v => v + 1)}>重试</Button>} /></div> : detail && detail.id === selectedId ? <>
              <div className="version-inspector__metadata">
                <div className="version-inspector__title"><Tag color="blue">v{detail.versionNum}</Tag><h3>{detail.label || `版本 ${detail.versionNum}`}</h3><Tag>只读快照</Tag></div>
                <div className="version-inspector__date">{formatTime(detail.createdAt)} · {detail.snapshot.sections.length} 个模块（{detail.snapshot.sections.filter(s => s.isVisible).length} 个可见）</div>
                {detail.description && <p>{detail.description}</p>}
                <div className="version-inspector__resume-meta">{detail.snapshot.title}{detail.snapshot.targetJob ? ` · ${detail.snapshot.targetJob}` : ''}{detail.snapshot.targetCompany ? ` · ${detail.snapshot.targetCompany}` : ''} · 字号 {detail.snapshot.fontSize} · 行距 {detail.snapshot.lineSpacing}</div>
                {current && <details className="version-inspector__changes"><summary>与当前草稿比较：{changes.length ? `${changes.length} 项差异` : '内容与排版一致'}</summary>{changes.length > 0 && <ul>{changes.map(change => <li key={change}>{change}</li>)}</ul>}</details>}
                {templateWarning && <Alert type="warning" showIcon message="模板配置暂时不可用，当前按此版本保存的内容和排版预览。" action={<Button size="small" onClick={() => setRetry(v => v + 1)}>重试</Button>} />}
              </div>
              <div className="version-inspector__preview"><PreviewPanel key={detail.id} resume={detail.snapshot} templateConfig={templateConfig} /></div>
            </> : null}
          </section>
        </div>
      </Modal>
      <Modal open={createOpen} onCancel={() => { if (!submitting) setCreateOpen(false); }} onOk={handleCreate} title="保存当前简历并创建版本" okText="保存版本" cancelText="取消" confirmLoading={submitting} okButtonProps={{ disabled: saving }} width={440}>
        <p className="version-panel__save-note">将当前编辑区内容保存到简历，并创建一条可回看的历史记录。</p>
        <label className="version-panel__field" htmlFor="resume-version-label">版本名称</label>
        <Input id="resume-version-label" value={label} onChange={e => setLabel(e.target.value)} placeholder={`版本 ${Math.max(0, ...versions.map(v => v.versionNum)) + 1}`} maxLength={40} onPressEnter={handleCreate} />
        <label className="version-panel__field" htmlFor="resume-version-description">备注（可选）</label>
        <Input.TextArea id="resume-version-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="例如：投递产品经理岗位前的定稿" autoSize={{ minRows: 2, maxRows: 4 }} maxLength={120} />
      </Modal>
    </div>
  );
}
