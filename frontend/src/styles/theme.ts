/**
 * Ant Design 主题定制
 * ------------------------------------------------------------------
 * 把设计令牌映射到 antd 的 token 系统，让三方组件与自研组件观感统一。
 */
import type { ThemeConfig } from 'antd';
import { brand, neutral, radius, shadow, fontSize, fontFamily } from './tokens';

export const antdTheme: ThemeConfig = {
  token: {
    // 品牌
    colorPrimary: brand.primary,
    colorInfo: brand.primary,
    colorSuccess: '#10B981',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',

    // 文字
    colorTextBase: neutral[800],
    colorText: neutral[800],
    colorTextSecondary: neutral[600],
    colorTextTertiary: neutral[500],
    colorTextQuaternary: neutral[400],

    // 边框与背景
    colorBorder: neutral[200],
    colorBorderSecondary: '#EEF1F6',
    colorBgLayout: '#F7F8FB',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',

    // 圆角
    borderRadius: radius.md,
    borderRadiusLG: radius.lg,
    borderRadiusSM: radius.sm,
    borderRadiusXS: radius.xs,

    // 字号
    fontSize: 14,
    fontSizeSM: fontSize.sm,
    fontSizeLG: fontSize.lg,
    fontSizeXL: fontSize.xl,
    fontFamily: fontFamily.sans,

    // 阴影
    boxShadow: shadow.md,
    boxShadowSecondary: shadow.lg,

    // 控件高度，让表单更舒展
    controlHeight: 36,
    controlHeightLG: 42,
    controlHeightSM: 28,

    // 行高与间距
    lineHeight: 1.6,
    paddingContentHorizontal: 16,
    motionDurationMid: '0.2s',
  },

  components: {
    Button: {
      fontWeight: 500,
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
      paddingInline: 18,
    },
    Card: {
      headerFontSize: 15,
      paddingLG: 20,
    },
    Input: {
      paddingBlock: 6,
      activeShadow: 'none',
    },
    Select: {
      optionSelectedBg: brand.primarySoft,
      optionSelectedFontWeight: 500,
    },
    Menu: {
      itemSelectedBg: brand.primarySoft,
      itemSelectedColor: brand.primaryActive,
      itemBorderRadius: radius.md,
      itemMarginInline: 6,
      itemHeight: 38,
    },
    Tabs: {
      inkBarColor: brand.primary,
      itemSelectedColor: brand.primary,
      itemActiveColor: brand.primary,
      horizontalItemGutter: 24,
    },
    Modal: {
      titleFontSize: 17,
      headerBg: 'transparent',
    },
    Drawer: {
      paddingLG: 20,
    },
    Tooltip: {
      colorBgSpotlight: neutral[800],
      borderRadius: radius.sm,
    },
    Progress: {
      defaultColor: brand.primary,
      remainingColor: neutral[100],
    },
    Tag: {
      borderRadiusSM: radius.xs,
      defaultBg: neutral[100],
      defaultColor: neutral[600],
    },
    Segmented: {
      itemSelectedBg: '#FFFFFF',
      itemSelectedColor: brand.primaryActive,
      trackBg: neutral[100],
    },
    Message: {
      contentPadding: '10px 16px',
    },
    Empty: {
      colorTextDescription: neutral[400],
    },
  },
};

export default antdTheme;
