/**
 * 模块元数据
 * ------------------------------------------------------------------
 * 所有模块的类型、名称、图标、提示文案集中在此，
 * 供左侧模块栏、添加菜单、空状态引导等处复用。
 */
import type { SectionType } from '../types/resume';

export interface SectionMeta {
  type: SectionType;
  label: string;
  icon: string;
  /** 一句话说明该模块写什么，用于空状态引导 */
  hint: string;
  /** 是否为列表型模块（可添加多条记录） */
  listLike: boolean;
  /** 是否建议在新建简历时预置 */
  recommended: boolean;
}

export const SECTION_META: Record<SectionType, SectionMeta> = {
  basic: {
    type: 'basic',
    label: '基本信息',
    icon: 'user',
    hint: '姓名、求职意向与联系方式，HR 第一眼看到的内容',
    listLike: false,
    recommended: true,
  },
  summary: {
    type: 'summary',
    label: '个人总结',
    icon: 'quote',
    hint: '3-4 句话概括你的核心竞争力与求职意向',
    listLike: false,
    recommended: true,
  },
  experience: {
    type: 'experience',
    label: '实习经历',
    icon: 'briefcase',
    hint: '用 STAR 法则描述每段实习的职责与成果',
    listLike: true,
    recommended: true,
  },
  work: {
    type: 'work',
    label: '工作经历',
    icon: 'briefcase',
    hint: '正式工作的职责、项目与业绩',
    listLike: true,
    recommended: false,
  },
  projects: {
    type: 'projects',
    label: '项目经历',
    icon: 'code',
    hint: '技术岗最看重的一块，写明背景、方案与量化结果',
    listLike: true,
    recommended: true,
  },
  education: {
    type: 'education',
    label: '教育经历',
    icon: 'school',
    hint: '学校、专业、学历与在读时间，可补充主修课程',
    listLike: true,
    recommended: true,
  },
  skills: {
    type: 'skills',
    label: '专业技能',
    icon: 'tool',
    hint: '按语言/框架/中间件分组列出，与岗位要求对齐',
    listLike: false,
    recommended: true,
  },
  awards: {
    type: 'awards',
    label: '荣誉奖项',
    icon: 'trophy',
    hint: '奖学金、竞赛获奖、荣誉称号及获得时间',
    listLike: true,
    recommended: true,
  },
  certificates: {
    type: 'certificates',
    label: '证书',
    icon: 'certificate',
    hint: '语言证书、职业资格、技术认证',
    listLike: true,
    recommended: false,
  },
  custom: {
    type: 'custom',
    label: '自定义模块',
    icon: 'file',
    hint: '用 Markdown 自由书写任意内容，如作品集、出版物',
    listLike: false,
    recommended: false,
  },
};

export const SECTION_LIST = Object.values(SECTION_META);

/** 添加模块面板中的分组展示顺序 */
export const SECTION_GROUPS: { title: string; types: SectionType[] }[] = [
  { title: '常用', types: ['summary', 'experience', 'projects', 'education', 'skills'] },
  { title: '补充', types: ['work', 'awards', 'certificates', 'custom'] },
];

/** 新建简历时的预置模块顺序 */
export const DEFAULT_SECTION_ORDER: SectionType[] = [
  'basic',
  'summary',
  'experience',
  'projects',
  'education',
  'skills',
  'awards',
];

export function sectionLabel(type: string): string {
  return SECTION_META[type as SectionType]?.label ?? type;
}
