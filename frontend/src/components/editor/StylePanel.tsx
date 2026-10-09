/**
 * 模块样式面板（右栏 Inspect）
 * ------------------------------------------------------------------
 * 三级样式覆盖中的最后一级：模块级 `data._config`。
 * 面板同时承担两个职责：
 *   1. 模块级排版 —— 标题样式、字号、颜色、行距、对齐、隐藏标题
 *   2. 全局排版   —— 字体、页面边距、模块间距、主题色（写入 resume.layoutConfig）
 *
 * 交互约定：任何改动都「即时写回」，由 Editor 页面统一做防抖落库，
 * 因此面板里不需要「保存」按钮 —— 所见即所得。
 */
import { useState } from 'react';
import { Input, Radio, Tooltip } from 'antd';
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BgColorsOutlined,
  DeleteOutlined,
  FontColorsOutlined,
  FontSizeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

import {
  ColorPicker,
  Field,
  PanelSection,
  SegmentedField,
  SliderField,
} from './EditorControls';
import SectionIcon from '../common/SectionIcon';
import { SECTION_META } from '../../constants/sections';
import type { LayoutConfig, ResumeLayout, ResumeSection, SectionConfig, SectionType } from '../../types/resume';
import { brand, fontOptions, neutral, radius, resumePalette, textPalette, transition } from '../../styles/tokens';
import { DEFAULT_LAYOUT } from '../viewer/ResumePreviewEngine';

// ==================================================================
// 标题样式预览卡
// ==================================================================

const TITLE_STYLES: { key: NonNullable<SectionConfig['titleStyle']>; label: string }[] = [
  { key: 'underline', label: '下划线' },
  { key: 'bar', label: '色条' },
  { key: 'pill', label: '胶囊' },
  { key: 'solid', label: '实底' },
  { key: 'plain', label: '无' },
];

function TitleStylePicker({
  value,
  color,
  onChange,
}: {
  value: NonNullable<SectionConfig['titleStyle']>;
  color: string;
  onChange: (v: NonNullable<SectionConfig['titleStyle']>) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
      {TITLE_STYLES.map((s) => {
        const active = value === s.key;
        const preview: React.CSSProperties = (() => {
          switch (s.key) {
            case 'bar':
              return { borderLeft: `3px solid ${color}`, paddingLeft: 6 };
            case 'pill':
              return { background: `${color}1A`, borderRadius: 99, padding: '1px 8px' };
            case 'solid':
              return { background: color, color: '#fff', borderRadius: 3, padding: '1px 8px' };
            case 'plain':
              return {};
            default:
              return { borderBottom: `1.5px solid ${color}`, paddingBottom: 1 };
          }
        })();

        return (
          <button
            key={s.key}
            onClick={() => onChange(s.key)}
            style={{
              flex: '1 1 52px',
              minWidth: 52,
              padding: '7px 4px 6px',
              border: `1px solid ${active ? color : neutral[200]}`,
              borderRadius: radius.md,
              background: active ? `${color}0D` : '#fff',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
              transition: transition.fast,
            }}
          >
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color,
                lineHeight: 1.4,
                ...preview,
              }}
            >
              模块
            </span>
            <span style={{ fontSize: 10, color: active ? color : neutral[400] }}>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ==================================================================
// 模块样式面板
// ==================================================================

interface SectionStyleProps {
  sectionType: SectionType;
  config: SectionConfig;
  themeColor: string;
  baseFontSize: number;
  baseLineSpacing: number;
  globalHeaderStyle: NonNullable<SectionConfig['titleStyle']>;
  onChange: (patch: Partial<SectionConfig>) => void;
  onReset: () => void;
}

export function SectionStylePanel({
  sectionType,
  config,
  themeColor,
  baseFontSize,
  baseLineSpacing,
  globalHeaderStyle,
  onChange,
  onReset,
}: SectionStyleProps) {
  const meta = SECTION_META[sectionType];
  const isBasic = sectionType === 'basic';

  const titleColor = config.titleColor || themeColor;
  const titleStyle = config.titleStyle || globalHeaderStyle;
  const cfgCount = Object.keys(config).filter((k) => k !== 'moduleName').length;

  return (
    <div>
      <PanelSection
        title="模块名称"
        subtitle={`默认为「${meta?.label}」。改名后预览与导出会同步生效。`}
      >
        <Input
          value={config.moduleName ?? ''}
          onChange={(e) => onChange({ moduleName: e.target.value })}
          placeholder={meta?.label}
          size="small"
          allowClear
        />
      </PanelSection>

      {!isBasic && (
        <PanelSection title="标题样式">
          <TitleStylePicker
            value={titleStyle}
            color={titleColor}
            onChange={(v) => onChange({ titleStyle: v })}
          />

          <Field label="标题显示" compact>
            <Radio.Group
              value={config.hideTitle ? 'hide' : 'show'}
              onChange={(e) => onChange({ hideTitle: e.target.value === 'hide' })}
              size="small"
            >
              <Radio.Button value="show">显示</Radio.Button>
              <Radio.Button value="hide">隐藏</Radio.Button>
            </Radio.Group>
          </Field>
        </PanelSection>
      )}

      <PanelSection title="字号与行距">
        <SliderField
          label={isBasic ? '姓名字号' : '标题字号'}
          value={config.titleFontSize ?? (baseFontSize + (isBasic ? 8 : 2))}
          min={10}
          max={isBasic ? 34 : 26}
          unit="px"
          onChange={(v) => onChange({ titleFontSize: v })}
        />
        <SliderField
          label="正文字号"
          value={config.contentFontSize ?? baseFontSize}
          min={9}
          max={20}
          unit="px"
          onChange={(v) => onChange({ contentFontSize: v })}
        />
        {!isBasic && (
          <SliderField
            label="内容行距"
            value={config.lineSpacing ?? baseLineSpacing}
            min={1}
            max={2.4}
            step={0.05}
            onChange={(v) => onChange({ lineSpacing: v })}
          />
        )}
      </PanelSection>

      <PanelSection title="颜色">
        <ColorPicker
          label="主题色 / 标题色"
          value={config.titleColor}
          palette={resumePalette}
          onChange={(v) => onChange({ titleColor: v })}
          allowClear
        />
        <ColorPicker
          label="正文颜色"
          value={config.textColor}
          palette={textPalette}
          onChange={(v) => onChange({ textColor: v })}
          allowClear
        />
      </PanelSection>

      {!isBasic && (
        <PanelSection title="对齐方式">
          <div style={{ display: 'flex', gap: 6 }}>
            {(
              [
                { key: 'left', icon: <AlignLeftOutlined /> },
                { key: 'center', icon: <AlignCenterOutlined /> },
                { key: 'right', icon: <AlignRightOutlined /> },
              ] as const
            ).map((a) => {
              const active = (config.textAlign || 'left') === a.key;
              return (
                <button
                  key={a.key}
                  onClick={() => onChange({ textAlign: a.key })}
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    border: `1px solid ${active ? themeColor : neutral[200]}`,
                    background: active ? `${themeColor}0D` : '#fff',
                    color: active ? themeColor : neutral[500],
                    borderRadius: radius.md,
                    cursor: 'pointer',
                    fontSize: 14,
                    transition: transition.fast,
                  }}
                >
                  {a.icon}
                </button>
              );
            })}
          </div>
        </PanelSection>
      )}

      <div style={{ padding: 14 }}>
        <button
          onClick={onReset}
          disabled={cfgCount === 0}
          style={{
            width: '100%',
            padding: '7px 0',
            border: `1px solid ${neutral[200]}`,
            background: '#fff',
            color: cfgCount === 0 ? neutral[300] : neutral[600],
            borderRadius: radius.md,
            fontSize: 12.5,
            cursor: cfgCount === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          <ReloadOutlined style={{ fontSize: 11 }} />
          重置该模块样式{cfgCount > 0 ? `（${cfgCount} 项已自定义）` : ''}
        </button>
      </div>
    </div>
  );
}

// ==================================================================
// 全局样式面板
// ==================================================================

const LAYOUT_OPTIONS: { value: ResumeLayout; label: string; desc: string }[] = [
  { value: 'single-column', label: '单栏', desc: '信息自上而下，最适合 ATS 解析' },
  { value: 'two-column', label: '双栏', desc: '正文分两列，信息密度更高' },
  { value: 'sidebar', label: '侧边栏', desc: '左侧窄栏放技能/联系方式' },
];

export function GlobalStylePanel({
  layout,
  themeColor,
  onChange,
  onThemeColor,
}: {
  layout: Required<LayoutConfig>;
  themeColor: string;
  onChange: (patch: Partial<LayoutConfig>) => void;
  onThemeColor: (color: string) => void;
}) {
  const [showMargins, setShowMargins] = useState(false);

  return (
    <div>
      <PanelSection
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <BgColorsOutlined /> 整体主题色
          </span>
        }
        subtitle="影响所有未单独设置颜色的模块标题。"
      >
        <ColorPicker
          value={themeColor}
          palette={resumePalette}
          onChange={(v) => v && onThemeColor(v)}
        />
      </PanelSection>

      <PanelSection
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FontSizeOutlined /> 全局排版
          </span>
        }
      >
        <Field label="正文字体" compact>
          <select
            value={layout.globalFontFamily}
            onChange={(e) => onChange({ globalFontFamily: e.target.value })}
            style={{
              width: '100%',
              padding: '6px 9px',
              border: `1px solid ${neutral[200]}`,
              borderRadius: radius.md,
              fontSize: 12.5,
              color: neutral[700],
              background: '#fff',
              outline: 'none',
            }}
          >
            {fontOptions.map((f, i) => (
              <option key={`${f.value}-${i}`} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>

        <SliderField
          label="正文字号"
          value={layout.globalFontSize}
          min={10}
          max={18}
          unit="px"
          onChange={(v) => onChange({ globalFontSize: v })}
        />
        <SliderField
          label="行距"
          value={layout.globalLineSpacing}
          min={1.1}
          max={2.4}
          step={0.05}
          onChange={(v) => onChange({ globalLineSpacing: v })}
        />
        <SliderField
          label="模块间距"
          value={layout.moduleMargin}
          min={8}
          max={44}
          unit="px"
          onChange={(v) => onChange({ moduleMargin: v })}
        />

        <div style={{ marginTop: -4 }}>
          <SegmentedField
            label="默认标题样式"
            value={layout.headerStyle}
            onChange={(v) => onChange({ headerStyle: v as LayoutConfig['headerStyle'] })}
            options={TITLE_STYLES.map((s) => ({ label: s.label, value: s.key }))}
          />
        </div>
      </PanelSection>

      <PanelSection
        title="版式"
        subtitle="模板会给定一个推荐版式，你也可以在这里覆盖。"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {LAYOUT_OPTIONS.map((o) => {
            const active = (layout.layout || 'single-column') === o.value;
            return (
              <button
                key={o.value}
                onClick={() => onChange({ layout: o.value })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 11px',
                  border: `1px solid ${active ? themeColor : neutral[200]}`,
                  background: active ? `${themeColor}0A` : '#fff',
                  borderRadius: radius.md,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: transition.fast,
                }}
              >
                <LayoutGlyph type={o.value} color={active ? themeColor : neutral[300]} />
                <span style={{ flex: 1 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: active ? themeColor : neutral[700],
                    }}
                  >
                    {o.label}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: neutral[400], marginTop: 1 }}>
                    {o.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PanelSection>

      <PanelSection
        title="页面边距"
        defaultOpen={false}
        extra={
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange({
                pageTopMargin: DEFAULT_LAYOUT.pageTopMargin,
                pageBottomMargin: DEFAULT_LAYOUT.pageBottomMargin,
                pageLeftMargin: DEFAULT_LAYOUT.pageLeftMargin,
                pageRightMargin: DEFAULT_LAYOUT.pageRightMargin,
              });
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: neutral[400],
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <ReloadOutlined style={{ fontSize: 10 }} /> 重置
          </button>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <SliderField
            label="上边距"
            value={layout.pageTopMargin}
            min={16}
            max={80}
            unit="px"
            onChange={(v) => onChange({ pageTopMargin: v })}
          />
          <SliderField
            label="下边距"
            value={layout.pageBottomMargin}
            min={16}
            max={80}
            unit="px"
            onChange={(v) => onChange({ pageBottomMargin: v })}
          />
          <SliderField
            label="左边距"
            value={layout.pageLeftMargin}
            min={20}
            max={90}
            unit="px"
            onChange={(v) => onChange({ pageLeftMargin: v })}
          />
          <SliderField
            label="右边距"
            value={layout.pageRightMargin}
            min={20}
            max={90}
            unit="px"
            onChange={(v) => onChange({ pageRightMargin: v })}
          />
        </div>

        <Tooltip
          title={showMargins ? '隐藏安全区指示' : '在预览中显示页面边距参考线'}
          mouseEnterDelay={0.4}
        >
          <button
            onClick={() => setShowMargins((v) => !v)}
            style={{
              border: `1px solid ${neutral[200]}`,
              background: showMargins ? neutral[100] : '#fff',
              color: neutral[600],
              borderRadius: radius.md,
              padding: '5px 10px',
              fontSize: 11.5,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {showMargins ? '隐藏边距参考线' : '显示边距参考线'}
          </button>
        </Tooltip>
      </PanelSection>
    </div>
  );
}

export function SectionPlacementPanel({
  section,
  mode,
  onChange,
}: {
  section: ResumeSection;
  mode: ResumeLayout;
  onChange: (placement: 'auto' | 'left' | 'right') => void;
}) {
  const current = section.layout === 'left' || section.layout === 'right' ? section.layout : 'auto';
  const options = mode === 'sidebar'
    ? [
        { value: 'auto', label: '自动' },
        { value: 'left', label: '侧边栏' },
        { value: 'right', label: '主内容区' },
      ] as const
    : [
        { value: 'auto', label: '自动平衡' },
        { value: 'left', label: '左栏' },
        { value: 'right', label: '右栏' },
      ] as const;

  return (
    <PanelSection title="模块栏位" subtitle="自动会按内容量平衡栏高；也可固定到指定栏位。">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {options.map((option) => {
          const active = current === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              style={{
                padding: '7px 4px',
                border: `1px solid ${active ? brand.primary : neutral[200]}`,
                borderRadius: radius.md,
                background: active ? `${brand.primary}0A` : '#fff',
                color: active ? brand.primary : neutral[600],
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </PanelSection>
  );
}

/** 版式示意图 */
function LayoutGlyph({ type, color }: { type: ResumeLayout; color: string }) {
  const base = {
    width: 30,
    height: 22,
    border: `1px solid ${color}`,
    borderRadius: 3,
    display: 'flex',
    gap: 2,
    padding: 2,
    flexShrink: 0,
  } as const;

  if (type === 'two-column') {
    return (
      <span style={base}>
        <span style={{ flex: 1, background: `${color}30`, borderRadius: 1 }} />
        <span style={{ flex: 1, background: `${color}30`, borderRadius: 1 }} />
      </span>
    );
  }
  if (type === 'sidebar') {
    return (
      <span style={base}>
        <span style={{ width: 8, background: `${color}55`, borderRadius: 1 }} />
        <span style={{ flex: 1, background: `${color}20`, borderRadius: 1 }} />
      </span>
    );
  }
  return (
    <span style={{ ...base, flexDirection: 'column' }}>
      <span style={{ height: 4, background: `${color}55`, borderRadius: 1 }} />
      <span style={{ flex: 1, background: `${color}20`, borderRadius: 1 }} />
    </span>
  );
}

export default SectionStylePanel;
