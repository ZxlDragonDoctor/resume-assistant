/**
 * 领域模型类型定义
 * ------------------------------------------------------------------
 * 与后端 ResumeDetailResponse / Resume 等结构保持一致。
 * 所有 `data` 字段在传输中可能是 JSON 字符串或已解析对象，
 * 因此统一用 `SectionData` 承接，并提供 normalizeSectionData 做归一化。
 */

// ==================================================================
// 通用
// ==================================================================

/** 后端统一响应包装 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// ==================================================================
// 用户与认证
// ==================================================================

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  phone?: string;
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  expiresIn: number;
}

// ==================================================================
// 简历
// ==================================================================

export type ResumeStatus = 'draft' | 'complete';

export interface Resume {
  id: string;
  userId: string;
  title: string;
  templateId: string | null;
  targetJob?: string;
  targetCompany?: string;
  fontFamily: string;
  fontSize: number;
  themeColor: string;
  lineSpacing: number;
  layoutConfig: string;
  shareEnabled: boolean;
  shareToken?: string;
  viewCount: number;
  status: ResumeStatus;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeDetail extends Omit<Resume, 'userId' | 'isPublic'> {
  sections: ResumeSection[];
}

export interface ResumeSection {
  id: string;
  sectionType: SectionType;
  sortOrder: number;
  isVisible: boolean;
  /** 手动栏位：auto 按内容高度平衡；left/right 固定分栏 */
  layout?: 'auto' | 'left' | 'right' | string;
  data: SectionData;
}

// ==================================================================
// 模块
// ==================================================================

export type SectionType =
  | 'basic'
  | 'summary'
  | 'experience'
  | 'work'
  | 'education'
  | 'projects'
  | 'skills'
  | 'awards'
  | 'certificates'
  | 'custom';

/** 模块级样式配置，存于 data._config，实现「同一模块独立排版」 */
export interface SectionConfig {
  moduleName?: string;
  titleFontSize?: number;
  contentFontSize?: number;
  titleColor?: string;
  textColor?: string;
  lineSpacing?: number;
  textAlign?: 'left' | 'center' | 'right';
  markdownMode?: boolean;
  /** 标题样式：下划线 / 左侧色条 / 胶囊 / 实底 / 无装饰 */
  titleStyle?: 'underline' | 'bar' | 'pill' | 'solid' | 'plain';
  /** 是否显示模块标题 */
  hideTitle?: boolean;
}

/** 通用条目：经历 / 教育 / 项目共用 */
export interface ResumeItem {
  title?: string;
  subtitle?: string;
  company?: string;
  school?: string;
  name?: string;
  institution?: string;
  position?: string;
  degree?: string;
  major?: string;
  role?: string;
  department?: string;
  tech?: string;
  level?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  bullets?: string[];
  description?: string;
  link?: string;
}

/** 技能条目：既支持纯字符串标签，也支持分组对象 */
export interface SkillGroup {
  name?: string;
  category?: string;
  level?: number | string;
  items?: string[];
  value?: string;
}

export interface BasicInfo {
  name?: string;
  jobTitle?: string;
  phone?: string;
  email?: string;
  city?: string;
  website?: string;
  links?: { label: string; url: string }[];
}

export type SectionData = Record<string, unknown> & {
  _config?: SectionConfig;
};

// ==================================================================
// 布局配置（存于 resume.layoutConfig）
// ==================================================================

export interface LayoutConfig {
  /** 全局正文字号 */
  globalFontSize?: number;
  /** 全局行距 */
  globalLineSpacing?: number;
  /** 全局字体 */
  globalFontFamily?: string;
  /** 页面边距 */
  pageTopMargin?: number;
  pageBottomMargin?: number;
  pageLeftMargin?: number;
  pageRightMargin?: number;
  /** 模块间距 */
  moduleMargin?: number;
  /** 模块标题上下间距 */
  titleTopPadding?: number;
  titleBottomMargin?: number;
  /** 标题样式 */
  headerStyle?: 'underline' | 'bar' | 'pill' | 'solid' | 'plain';
  /** 版式：单栏 / 双栏 / 侧边栏 */
  layout?: ResumeLayout;
  /** 主题色覆盖 */
  themeColor?: string;
}

export type ResumeLayout = 'single-column' | 'two-column' | 'sidebar';

// ==================================================================
// 模板
// ==================================================================

export interface TemplateConfig extends LayoutConfig {
  systemKey?: string;
  fonts?: string[];
  primaryColor?: string;
  accentColor?: string;
  headerStyle?: 'underline' | 'bar' | 'pill' | 'solid' | 'plain';
  sections?: SectionType[];
}

/** 模板库与新建简历共同使用的完整、可编辑范文。 */
export interface TemplateSample {
  version: 1;
  profile: {
    key: string;
    jobTitle: string;
    experienceLevel: string;
    highlights: string[];
    suggestedPages: number;
  };
  sections: {
    sectionType: SectionType;
    sortOrder: number;
    layout: 'auto' | 'left' | 'right' | 'single-column';
    data: SectionData;
  }[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  tags?: string[];
  thumbnailUrl?: string;
  previewConfig?: string | TemplateSample | null;
  isPremium: boolean;
  isActive: boolean;
  sortOrder: number;
  /** config 可能是 JSON 字符串或对象 */
  config: string | TemplateConfig;
}

export interface TemplateCategory {
  key: string;
  label: string;
  count: number;
}

// ==================================================================
// AI 能力
// ==================================================================

export interface AtsScores {
  keywords: number;
  skills: number;
  experience: number;
  education: number;
  overall: number;
}

export interface AiResultMeta {
  notice?: string;
  fallbackReason?: string;
}

export interface AtsScoreResponse extends AiResultMeta {
  scores: AtsScores;
  suggestions: string[];
  matchedSkills?: string[];
  missingSkills?: string[];
  engine?: AiEngine;
}

export interface AiTextResponse extends AiResultMeta {
  result: string;
  engine: AiEngine;
  suggestions?: string[];
}

export interface AiBatchItem {
  id: string;
  before: string;
  after: string;
  engine: AiEngine;
  suggestions?: string[];
}

export interface AiBatchResponse extends AiResultMeta {
  items: AiBatchItem[];
  engine: AiEngine;
}

export interface JdParseResponse extends AiResultMeta {
  skills: string[];
  years: string | null;
  education: string | null;
  responsibilities: string[];
  requirements: string[];
  engine: AiEngine;
}

export interface SkillMatchResponse extends AiResultMeta {
  matched: string[];
  missing: string[];
  extra: string[];
  matchRate: number;
  engine: AiEngine;
}

export interface InterviewQuestionsResponse extends AiResultMeta {
  questions: string[];
  engine: AiEngine;
}

export interface AiHealth {
  status: string;
  llmEnabled: boolean;
  engine: AiEngine;
  modelStatus?: 'unconfigured' | 'configured' | 'available' | 'unavailable';
}

/** 当前 AI 使用的引擎：大模型 or 本地规则 */
export type AiEngine = 'llm' | 'rule' | 'none';

// ==================================================================
// 版本与统计
// ==================================================================

export interface ResumeVersion {
  id: string;
  versionNum: number;
  label: string;
  description?: string;
  createdAt: string;
}

export interface ResumeStats {
  totalResumes: number;
  completedResumes: number;
  draftResumes: number;
  sharedResumes: number;
  totalViews: number;
  lastEditedAt?: string;
  completeness: number;
}

// ==================================================================
// 工具函数
// ==================================================================

/** 把可能是字符串的 data 归一化成对象 */
export function normalizeSectionData(data: unknown): SectionData {
  if (!data) return {};
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof data === 'object') return data as SectionData;
  return {};
}

/** 归一化模板 config */
export function normalizeTemplateConfig(config: string | TemplateConfig | undefined): TemplateConfig {
  if (!config) return {};
  if (typeof config === 'string') {
    try {
      const parsed = JSON.parse(config);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof config === 'object' && !Array.isArray(config) ? config : {};
}

/** 从 data 中拆出 _config 与业务字段 */
export function splitSectionData(data: SectionData): {
  config: SectionConfig;
  content: SectionData;
} {
  const { _config, ...content } = data;
  return { config: (_config || {}) as SectionConfig, content };
}
