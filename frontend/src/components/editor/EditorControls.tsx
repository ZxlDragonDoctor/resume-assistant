/**
 * 编辑器内的通用控件
 * ------------------------------------------------------------------
 * 这些控件在「内容编辑」与「样式面板」中被大量复用以保持一致的视觉密度：
 *   - Field       —— 带标签的表单行
 *   - SliderField —— 数值 + 滑杆的组合（字号 / 行距）
 *   - SegmentedField —— 轻量的分段选择
 *   - ColorPicker —— 色板 + 自定义颜色
 *   - PanelSection —— 面板内的分组标题（可折叠）
 *   - EmptyBlock  —— 空状态引导
 *
 * 设计原则：把 antd 组件「降噪」——去掉多余的边框与阴影，
 * 让编辑器看起来像一件工具，而不是一堆表单。
 */
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Input, Popover, Segmented, Slider, Tooltip } from 'antd';
import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';

import { brand, neutral, radius, semantic, transition } from '../../styles/tokens';
import { isLightColor } from '../../utils/thumbnail';

// ==================================================================
// 表单行
// ==================================================================

export function Field({
  label,
  hint,
  required,
  children,
  style,
  compact,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  style?: CSSProperties;
  /** 紧凑模式：标签与控件同行 */
  compact?: boolean;
}) {
  return (
    <div style={{ marginBottom: compact ? 8 : 14, ...style }}>
      {label && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 6,
            fontSize: 12.5,
            color: neutral[600],
            fontWeight: 500,
          }}
        >
          {required && <span style={{ color: semantic.danger }}>*</span>}
          {label}
          {hint && (
            <Tooltip title={hint} mouseEnterDelay={0.3}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 13,
                  height: 13,
                  borderRadius: '50%',
                  border: `1px solid ${neutral[300]}`,
                  color: neutral[400],
                  fontSize: 9,
                  cursor: 'help',
                  flexShrink: 0,
                }}
              >
                ?
              </span>
            </Tooltip>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// ==================================================================
// 滑杆
// ==================================================================

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  hint,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 2,
        }}
      >
        <span style={{ fontSize: 12.5, color: neutral[600], fontWeight: 500 }}>
          {label}
          {hint && (
            <Tooltip title={hint} mouseEnterDelay={0.3}>
              <span style={{ marginLeft: 4, color: neutral[400], fontSize: 11, cursor: 'help' }}>
                ⓘ
              </span>
            </Tooltip>
          )}
        </span>
        <span
          style={{
            fontSize: 11.5,
            color: brand.primary,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            background: brand.primarySoft,
            borderRadius: radius.xs,
            padding: '1px 6px',
            minWidth: 40,
            textAlign: 'center',
          }}
        >
          {value}
          {unit}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        tooltip={{ open: false }}
        style={{ margin: '2px 0' }}
      />
    </div>
  );
}

// ==================================================================
// 分段选择
// ==================================================================

export function SegmentedField({
  label,
  value,
  onChange,
  options,
  block = true,
}: {
  label?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { label: ReactNode; value: string }[];
  block?: boolean;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <div style={{ fontSize: 12.5, color: neutral[600], fontWeight: 500, marginBottom: 6 }}>
          {label}
        </div>
      )}
      <Segmented
        value={value}
        onChange={(v) => onChange(String(v))}
        options={options}
        block={block}
        size="small"
      />
    </div>
  );
}

// ==================================================================
// 颜色选择
// ==================================================================

export function ColorPicker({
  label,
  value,
  onChange,
  palette,
  allowClear,
}: {
  label?: ReactNode;
  value?: string;
  onChange: (v: string | undefined) => void;
  palette: readonly { name: string; value: string }[];
  allowClear?: boolean;
}) {
  const [custom, setCustom] = useState(value || brand.primary);
  const [open, setOpen] = useState(false);
  const active = (value || '').toUpperCase();

  const content = (
    <div style={{ width: 208, padding: 2 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
        {palette.map((c) => (
          <Tooltip key={c.value} title={c.name} mouseEnterDelay={0.3}>
            <div
              className={`color-swatch${active === c.value.toUpperCase() ? ' is-selected' : ''}`}
              style={{ background: c.value, position: 'relative' }}
              onClick={() => {
                onChange(c.value);
                setOpen(false);
              }}
            >
              {active === c.value.toUpperCase() && (
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isLightColor(c.value) ? neutral[900] : neutral[0],
                    fontSize: 11,
                  }}
                >
                  ✓
                </span>
              )}
            </div>
          </Tooltip>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingTop: 8,
          borderTop: `1px solid ${neutral[150]}`,
        }}
      >
        <input
          type="color"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          style={{
            width: 26,
            height: 26,
            border: `1px solid ${neutral[200]}`,
            borderRadius: radius.sm,
            cursor: 'pointer',
            padding: 2,
            background: '#fff',
          }}
        />
        <Input
          size="small"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          style={{ flex: 1, fontSize: 12 }}
        />
        <button
          onClick={() => {
            onChange(custom);
            setOpen(false);
          }}
          style={{
            border: 'none',
            background: brand.primary,
            color: '#fff',
            borderRadius: radius.sm,
            padding: '4px 9px',
            fontSize: 11.5,
            cursor: 'pointer',
          }}
        >
          确定
        </button>
      </div>

      {allowClear && (
        <button
          onClick={() => {
            onChange(undefined);
            setOpen(false);
          }}
          style={{
            marginTop: 8,
            width: '100%',
            border: `1px solid ${neutral[200]}`,
            background: '#fff',
            color: neutral[500],
            borderRadius: radius.sm,
            padding: '4px 0',
            fontSize: 11.5,
            cursor: 'pointer',
          }}
        >
          恢复默认
        </button>
      )}
    </div>
  );

  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <div style={{ fontSize: 12.5, color: neutral[600], fontWeight: 500, marginBottom: 6 }}>
          {label}
        </div>
      )}
      <Popover
        content={content}
        trigger="click"
        open={open}
        onOpenChange={setOpen}
        placement="bottomLeft"
      >
        <button
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 8px',
            border: `1px solid ${neutral[200]}`,
            borderRadius: radius.md,
            background: '#fff',
            cursor: 'pointer',
            transition: transition.fast,
          }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: radius.xs,
              background: value || `repeating-conic-gradient(${neutral[200]} 0% 25%, #fff 0% 50%) 50% / 8px 8px`,
              border: `1px solid ${neutral[200]}`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 12,
              color: value ? neutral[700] : neutral[400],
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              flex: 1,
              textAlign: 'left',
            }}
          >
            {value || '跟随主题色'}
          </span>
          <CaretDownOutlined style={{ fontSize: 10, color: neutral[400] }} />
        </button>
      </Popover>
    </div>
  );
}

// ==================================================================
// 分组（可折叠）
// ==================================================================

export function PanelSection({
  title,
  subtitle,
  children,
  defaultOpen = true,
  extra,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderBottom: `1px solid ${neutral[150]}` }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '11px 14px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{ color: neutral[400], fontSize: 10, display: 'flex' }}>
          {open ? <CaretDownOutlined /> : <CaretRightOutlined />}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: neutral[700], flex: 1 }}>
          {title}
        </span>
        {extra && <span onClick={(e) => e.stopPropagation()}>{extra}</span>}
      </div>

      {open && (
        <div style={{ padding: '2px 14px 14px' }}>
          {subtitle && (
            <div
              style={{
                fontSize: 11.5,
                color: neutral[400],
                lineHeight: 1.6,
                marginBottom: 10,
              }}
            >
              {subtitle}
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

// ==================================================================
// 空状态
// ==================================================================

export function EmptyBlock({
  icon = '✍️',
  title,
  description,
  action,
  compact,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: compact ? '28px 16px' : '52px 24px',
        color: neutral[500],
      }}
    >
      <div style={{ fontSize: compact ? 26 : 34, marginBottom: 10, opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: neutral[700], marginBottom: 6 }}>
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: 12.5,
            color: neutral[400],
            lineHeight: 1.75,
            maxWidth: 380,
            margin: '0 auto',
          }}
        >
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

// ==================================================================
// 小工具
// ==================================================================

/** 输入框统一无边框化，避免 12 个输入框组成「表格观感」 */
export const bareInputStyle: CSSProperties = {
  border: 'none',
  borderBottom: `1px solid ${neutral[150]}`,
  borderRadius: 0,
  padding: '4px 0',
  background: 'transparent',
  fontSize: 13.5,
};

/** 统计一段文本的字数（去掉 HTML / Markdown 标记） */
export function useTextLength(text: unknown): number {
  return useMemo(() => {
    const raw = String(text ?? '');
    const plain = raw
      .replace(/<[^>]+>/g, '')
      .replace(/[#*>`_~[\]()!-]/g, '')
      .replace(/\s+/g, '');
    return plain.length;
  }, [text]);
}
