/**
 * 设计令牌（Design Tokens）
 * ------------------------------------------------------------------
 * 全站唯一的视觉常量来源。任何颜色 / 间距 / 圆角 / 阴影都应从这里取值，
 * 避免组件里散落魔法数字，也让主题切换（后续接暗色模式）只需改这一处。
 */

// ------------------------------------------------------------------
// 品牌色
// ------------------------------------------------------------------
export const brand = {
  primary: '#4F46E5',
  primaryHover: '#6366F1',
  primaryActive: '#4338CA',
  primarySoft: '#EEF2FF',
  primaryBorder: '#C7D2FE',

  secondary: '#7C3AED',
  secondarySoft: '#F5F3FF',

  /** 品牌渐变，用于主按钮、Logo、强调区块 */
  gradient: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
  gradientSoft: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
} as const;

// ------------------------------------------------------------------
// 语义色
// ------------------------------------------------------------------
export const semantic = {
  success: '#10B981',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  info: '#0EA5E9',
  infoSoft: '#F0F9FF',
  /** 荧光笔底色（TipTap highlight mark），不属于语义状态，单独命名避免语义污染 */
  highlight: '#FEF08A',
  /** 更深的语义色，用于在浅色底上保证 4.5:1 对比度（正文级文字） */
  warningStrong: '#B45309',
  dangerStrong: '#B91C1C',
  warningBorder: '#FDE68A',
} as const;

// ------------------------------------------------------------------
// 中性色阶（Slate）
// ------------------------------------------------------------------
export const neutral = {
  0: '#FFFFFF',
  25: '#FCFCFD',
  50: '#F8FAFC',
  100: '#F1F5F9',
  150: '#EAEFF5',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
  950: '#020617',
} as const;

// ------------------------------------------------------------------
// 文字色
// ------------------------------------------------------------------
export const text = {
  primary: neutral[900],
  secondary: neutral[600],
  tertiary: neutral[500],
  placeholder: neutral[400],
  disabled: neutral[300],
  inverse: neutral[0],
} as const;

// ------------------------------------------------------------------
// 间距（4px 基准）
// ------------------------------------------------------------------
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

// ------------------------------------------------------------------
// 圆角
// ------------------------------------------------------------------
export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  pill: 999,
} as const;

// ------------------------------------------------------------------
// 阴影（克制的层级感，避免过重）
// ------------------------------------------------------------------
export const shadow = {
  xs: '0 1px 2px rgba(15, 23, 42, 0.04)',
  sm: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
  md: '0 4px 12px rgba(15, 23, 42, 0.07), 0 2px 4px rgba(15, 23, 42, 0.04)',
  lg: '0 12px 28px rgba(15, 23, 42, 0.09), 0 4px 10px rgba(15, 23, 42, 0.05)',
  xl: '0 24px 48px rgba(15, 23, 42, 0.12), 0 8px 16px rgba(15, 23, 42, 0.06)',
  focus: `0 0 0 3px ${brand.primaryBorder}`,
  /** 简历纸张的投影，单独取值以获得更接近真实的观感 */
  paper: '0 1px 2px rgba(15,23,42,0.06), 0 8px 32px rgba(15,23,42,0.10)',
} as const;

// ------------------------------------------------------------------
// 字号与字重
// ------------------------------------------------------------------
export const fontSize = {
  xs: 11,
  sm: 12,
  base: 13,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  display: 28,
  hero: 44,
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const fontFamily = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Consolas, 'Liberation Mono', monospace",
} as const;

// ------------------------------------------------------------------
// 层级
// ------------------------------------------------------------------
export const zIndex = {
  base: 1,
  dropdown: 100,
  sticky: 200,
  drawer: 300,
  modal: 400,
  toast: 500,
} as const;

// ------------------------------------------------------------------
// 动效
// ------------------------------------------------------------------
export const transition = {
  fast: 'all 0.12s cubic-bezier(0.4, 0, 0.2, 1)',
  base: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  slow: 'all 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

// ------------------------------------------------------------------
// 布局常量
// ------------------------------------------------------------------
export const layout = {
  /** A4 纸张在 96dpi 下的像素宽度 */
  pageWidth: 794,
  pageMinHeight: 1123,
  /** 编辑器三栏宽度 */
  sidebarLeft: 232,
  inspectorWidth: 320,
  navbarHeight: 56,
  editorHeaderHeight: 56,
  contentMaxWidth: 1200,
} as const;

// ------------------------------------------------------------------
// 简历主题色板（模板切换用）
// ------------------------------------------------------------------
export const resumePalette = [
  { name: '靛蓝', value: '#4F46E5' },
  { name: '深蓝', value: '#2563EB' },
  { name: '天青', value: '#0891B2' },
  { name: '松绿', value: '#0D9488' },
  { name: '墨绿', value: '#059669' },
  { name: '橄榄', value: '#65A30D' },
  { name: '琥珀', value: '#D97706' },
  { name: '赤陶', value: '#EA580C' },
  { name: '朱红', value: '#DC2626' },
  { name: '玫红', value: '#E11D48' },
  { name: '洋红', value: '#DB2777' },
  { name: '紫罗兰', value: '#9333EA' },
  { name: '石墨', value: '#334155' },
  { name: '纯黑', value: '#0F172A' },
] as const;

/**
 * 简历正文色板。
 * 与 resumePalette 同属「会被写进简历数据」的字面值，因此必须保留 hex 原值。
 */
export const textPalette = [
  { name: '深灰', value: neutral[700] },
  { name: '近黑', value: neutral[900] },
  { name: '中灰', value: neutral[600] },
  { name: '浅灰', value: neutral[500] },
  { name: '纯黑', value: '#000000' },
] as const;

/** 中文字体选项，供简历排版使用 */
export const fontOptions = [
  { label: '系统默认', value: 'system-ui', stack: fontFamily.sans },
  { label: '思源黑体 / 苹方', value: 'system-ui', stack: fontFamily.sans },
  { label: '微软雅黑', value: 'Microsoft YaHei', stack: "'Microsoft YaHei', 'PingFang SC', sans-serif" },
  { label: '宋体（衬线）', value: 'SimSun', stack: "'SimSun', 'Songti SC', serif" },
  { label: '黑体', value: 'SimHei', stack: "'SimHei', 'Heiti SC', sans-serif" },
  { label: '楷体', value: 'KaiTi', stack: "'KaiTi', 'Kaiti SC', serif" },
  { label: '仿宋', value: 'FangSong', stack: "'FangSong', 'Fangsong SC', serif" },
  { label: 'Georgia（英文衬线）', value: 'Georgia', stack: "Georgia, 'Songti SC', serif" },
  { label: '等宽字体', value: 'monospace', stack: fontFamily.mono },
] as const;

export const theme = {
  brand,
  semantic,
  neutral,
  text,
  space,
  radius,
  shadow,
  fontSize,
  fontWeight,
  fontFamily,
  zIndex,
  transition,
  layout,
};

export default theme;
