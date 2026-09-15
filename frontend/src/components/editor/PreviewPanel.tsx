/**
 * 预览面板
 * ------------------------------------------------------------------
 * 编辑器右栏（或独立预览区）的核心：A4 纸张 + 缩放控制 + 页码提示。
 *
 * 缩放策略：
 *   - 「适应高度 / 适应宽度」按容器尺寸自动计算
 *   - 手动档位 50% ~ 150%
 *   - 缩放只影响 transform，不改变纸张真实尺寸，因此导出结果恒定
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tooltip } from 'antd';
import {
  CompressOutlined,
  ExpandOutlined,
  EyeOutlined,
  OneToOneOutlined,
} from '@ant-design/icons';

import ResumePreviewEngine from '../viewer/ResumePreviewEngine';
import type { ResumeDetail, TemplateConfig } from '../../types/resume';
import { layout as layoutTokens, neutral, radius, shadow, transition, brand } from '../../styles/tokens';

interface Props {
  resume: ResumeDetail | null;
  templateConfig?: TemplateConfig;
  /** 是否显示顶部工具栏 */
  toolbar?: boolean;
  /** 初始缩放 */
  initialScale?: number;
  /** 高亮当前正在编辑的模块（滚动定位用） */
  focusSectionId?: string | null;
}

const ZOOM_STEPS = [0.5, 0.65, 0.8, 0.9, 1, 1.1, 1.25, 1.5];

export default function PreviewPanel({
  resume,
  templateConfig,
  toolbar = true,
  initialScale = 0.86,
  focusSectionId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(initialScale);
  const [fit, setFit] = useState<'none' | 'width' | 'height'>('width');
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // 监听容器尺寸，用于「适应」计算
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitScale = useMemo(() => {
    const padX = 48;
    const padY = 48;
    if (!containerSize.w || !containerSize.h) return initialScale;
    const byWidth = (containerSize.w - padX) / layoutTokens.pageWidth;
    const byHeight = (containerSize.h - padY) / layoutTokens.pageMinHeight;
    if (fit === 'width') return Math.min(1.5, Math.max(0.35, byWidth));
    if (fit === 'height') return Math.min(1.5, Math.max(0.35, Math.min(byWidth, byHeight)));
    return scale;
  }, [containerSize, fit, scale, initialScale]);

  const effectiveScale = fit === 'none' ? scale : fitScale;

  const step = useCallback(
    (dir: 1 | -1) => {
      const current = effectiveScale;
      const sorted = dir === 1 ? ZOOM_STEPS : [...ZOOM_STEPS].reverse();
      const next = sorted.find((s) => (dir === 1 ? s > current + 0.001 : s < current - 0.001));
      setFit('none');
      setScale(next ?? current);
    },
    [effectiveScale]
  );

  const scaledWidth = layoutTokens.pageWidth * effectiveScale;
  const scaledHeight = layoutTokens.pageMinHeight * effectiveScale;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      {/* 工具栏 */}
      {toolbar && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '0 12px',
            height: 42,
            borderBottom: `1px solid ${neutral[150]}`,
            background: '#fff',
            flexShrink: 0,
          }}
        >
          <EyeOutlined style={{ fontSize: 12, color: neutral[400], marginRight: 4 }} />
          <span style={{ fontSize: 12, color: neutral[500], fontWeight: 500 }}>实时预览</span>

          <span style={{ flex: 1 }} />

          <Tooltip title="缩小" mouseEnterDelay={0.4}>
            <button onClick={() => step(-1)} style={ctrlBtn}>
              <CompressOutlined style={{ fontSize: 12 }} />
            </button>
          </Tooltip>

          <button
            onClick={() => {
              setFit('none');
              setScale(1);
            }}
            style={{
              ...ctrlBtn,
              width: 52,
              fontSize: 11.5,
              fontVariantNumeric: 'tabular-nums',
              color: fit === 'none' && scale === 1 ? brand.primary : neutral[600],
            }}
            title="恢复 100%"
          >
            {Math.round(effectiveScale * 100)}%
          </button>

          <Tooltip title="放大" mouseEnterDelay={0.4}>
            <button onClick={() => step(1)} style={ctrlBtn}>
              <ExpandOutlined style={{ fontSize: 12 }} />
            </button>
          </Tooltip>

          <span className="toolbar-divider" style={{ margin: '0 5px' }} />

          <Tooltip title="适应宽度" mouseEnterDelay={0.4}>
            <button
              onClick={() => setFit('width')}
              style={{
                ...ctrlBtn,
                ...(fit === 'width' ? activeBtn : null),
                width: 'auto',
                padding: '0 8px',
                fontSize: 11.5,
              }}
            >
              适应宽度
            </button>
          </Tooltip>

          <Tooltip title="整页可见" mouseEnterDelay={0.4}>
            <button
              onClick={() => setFit('height')}
              style={{
                ...ctrlBtn,
                ...(fit === 'height' ? activeBtn : null),
                width: 'auto',
                padding: '0 8px',
                fontSize: 11.5,
              }}
            >
              <OneToOneOutlined style={{ fontSize: 11, marginRight: 3 }} />
              整页
            </button>
          </Tooltip>
        </div>
      )}

      {/* 纸张区 */}
      <div
        ref={containerRef}
        className="thin-scroll"
        style={{
          flex: 1,
          overflow: 'auto',
          background:
            `repeating-linear-gradient(45deg, ${neutral[100]} 0 10px, ${neutral[25]} 10px 20px)`,
          padding: 24,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        {!resume ? (
          <div
            style={{
              margin: 'auto',
              color: neutral[400],
              fontSize: 13,
            }}
          >
            暂无简历数据
          </div>
        ) : (
          <div
            style={{
              width: scaledWidth,
              height: scaledHeight,
              flexShrink: 0,
              position: 'relative',
              transition: 'width 0.18s ease, height 0.18s ease',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: layoutTokens.pageWidth,
                transform: `scale(${effectiveScale})`,
                transformOrigin: 'top left',
                // 注意：transform 不参与布局，因此外层容器显式给出缩放后的尺寸
              }}
            >
              <div style={{ boxShadow: shadow.paper, background: '#fff' }}>
                <ResumePreviewEngine resume={resume} templateConfig={templateConfig} scale={1} />
              </div>

              {/* 聚焦模块指示（可选：用于滚动定位） */}
              {focusSectionId && (
                <div style={{ display: 'none' }} data-focus-section={focusSectionId} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const ctrlBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: neutral[600],
  borderRadius: radius.sm,
  height: 26,
  minWidth: 26,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: transition.fast,
  padding: 0,
};

const activeBtn: React.CSSProperties = {
  background: brand.primarySoft,
  color: brand.primary,
  fontWeight: 500,
};
