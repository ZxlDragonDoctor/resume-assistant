import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Modal, Segmented, Spin, Tag } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import ResumePreviewEngine from '../viewer/ResumePreviewEngine';
import TemplatePreview from './TemplatePreview';
import { normalizeTemplateConfig, type Template } from '../../types/resume';
import { createTemplatePreviewResume, normalizeTemplateSample } from '../../utils/templateSample';
import { neutral } from '../../styles/tokens';
import './templates.css';

interface Props {
  template: Template;
  using: boolean;
  onClose: () => void;
  onUse: (template: Template) => void;
}

export default function TemplateSampleModal({ template, using, onClose, onUse }: Props) {
  const config = useMemo(() => normalizeTemplateConfig(template.config), [template.config]);
  const sample = useMemo(() => normalizeTemplateSample(template.previewConfig), [template.previewConfig]);
  const resume = useMemo(() => createTemplatePreviewResume(template, sample), [template, sample]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<'fit' | 'actual'>('fit');
  const [availableWidth, setAvailableWidth] = useState(794);
  const [documentHeight, setDocumentHeight] = useState(1123);
  const [pageCount, setPageCount] = useState(1);
  const [openReady, setOpenReady] = useState(false);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    const document = documentRef.current;
    if (!container || !document) return;
    const measure = () => {
      const style = getComputedStyle(container);
      setAvailableWidth(Math.max(1, container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)));
      setDocumentHeight(document.offsetHeight);
      setPageCount(document.querySelectorAll('.resume-paper').length || 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(document);
    measure();
    return () => observer.disconnect();
  }, [resume, openReady]);

  const scale = zoom === 'actual' ? 1 : Math.min(1, availableWidth / 794);
  return (
    <Modal
      open
      title={`${template.name}${sample ? ' · 完整范文' : ' · 版式预览'}`}
      onCancel={onClose}
      afterOpenChange={setOpenReady}
      width={1080}
      style={{ top: 24, maxWidth: 'calc(100vw - 24px)', paddingBottom: 24 }}
      className="template-sample-modal"
      footer={<div className="template-sample-footer">
        <span style={{ color: neutral[500], fontSize: 12 }}>使用后可编辑所有内容与排版</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={onClose}>关闭</Button>
          <Button type="primary" icon={<ThunderboltOutlined />} loading={using} onClick={() => onUse(template)}>使用此模板</Button>
        </div>
      </div>}
    >
      <div data-testid="template-sample-preview">
      {sample && <div className="template-sample-profile">
        <div className="template-sample-meta"><strong>{sample.profile.jobTitle}</strong><Tag>{sample.profile.experienceLevel}</Tag><span>建议 {sample.profile.suggestedPages} 页</span></div>
        <ul className="template-sample-highlights">{sample.profile.highlights.map((highlight, index) => <li key={index}>{highlight}</li>)}</ul>
      </div>}
      <Alert
        type="info"
        showIcon
        message={sample ? '示例内容，请替换为真实经历' : '此模板暂未提供可用的完整范文'}
        description={sample ? '人物、机构和数据均为虚构示例。使用此模板会复制这份范文，请按自己的经历修改。' : '下方仅展示版式与配色。新建简历可能使用通用示例，具体内容以创建后的编辑器为准。'}
      />
      {resume ? <>
        <div className="template-sample-toolbar">
          <span aria-live="polite">{openReady ? `完整内容 · ${pageCount} 页` : '正在准备范文…'} <span className="template-sample-zoom-hint">· 可切换 100% 阅读正文</span></span>
          <Segmented aria-label="预览缩放" size="small" value={zoom} onChange={(value) => setZoom(value as 'fit' | 'actual')} options={[{ label: '适应宽度', value: 'fit' }, { label: '100%', value: 'actual' }]} />
        </div>
        <div className="template-sample-scroll" ref={scrollRef} role="region" aria-label="完整简历范文，可滚动阅读所有页面" tabIndex={0} style={{ height: 'min(62vh,740px)' }}>
          {openReady ? <div style={{ width: 794 * scale, height: documentHeight * scale, margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
            <div ref={documentRef} style={{ width: 794, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <ResumePreviewEngine resume={resume} templateConfig={config} />
            </div>
          </div> : <div role="status" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: neutral[500], fontSize: 13 }}><Spin size="small" />正在准备完整范文</div>}
        </div>
      </> : <div className="template-sample-fallback"><TemplatePreview config={config} width={220} /><span>版式示意 · 非完整范文</span></div>}
      </div>
    </Modal>
  );
}
