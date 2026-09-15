/**
 * 简历状态
 * ------------------------------------------------------------------
 * 承担编辑器的核心状态管理：
 *   - 简历列表与统计（Dashboard）
 *   - 当前编辑的简历（含 sections），支持乐观更新
 *   - 模块的增删改、排序、显隐
 *   - 元信息与布局配置的自动保存（带去抖）
 */
import { create } from 'zustand';
import { resumeApi } from '../services/api';
import {
  normalizeSectionData,
  type LayoutConfig,
  type Resume,
  type ResumeDetail,
  type ResumeSection,
  type ResumeStats,
  type ResumeVersion,
  type SectionType,
} from '../types/resume';

/** 新建模块时的默认数据结构 */
export const EMPTY_SECTION_DATA: Record<string, Record<string, unknown>> = {
  basic: { name: '', jobTitle: '', phone: '', email: '', city: '', website: '', links: [], _config: {} },
  summary: { content: '', _config: {} },
  experience: { items: [], _config: {} },
  work: { items: [], _config: {} },
  education: { items: [], _config: {} },
  projects: { items: [], _config: {} },
  skills: { items: [], _config: {} },
  awards: { items: [], _config: {} },
  certificates: { items: [], _config: {} },
  custom: { content: '', _config: {} },
};

/** 创建模块时预置的条目模板（列表型模块） */
export const NEW_ITEM_TEMPLATE: Partial<Record<string, Record<string, unknown> | string>> = {
  experience: { company: '', position: '', startDate: '', endDate: '', bullets: [''] },
  work: { company: '', position: '', startDate: '', endDate: '', bullets: [''] },
  education: { school: '', degree: '', major: '', startDate: '', endDate: '' },
  projects: { name: '', role: '', tech: '', startDate: '', endDate: '', bullets: [''] },
  awards: { title: '', level: '', date: '' },
  certificates: { title: '', date: '' },
  skills: '',
};

interface ResumeState {
  // ---- 列表 ----
  resumes: Resume[];
  stats: ResumeStats | null;
  listLoading: boolean;

  // ---- 详情 ----
  current: ResumeDetail | null;
  detailLoading: boolean;
  /** 是否有未同步到服务端的本地修改 */
  dirty: boolean;
  saving: boolean;
  lastSavedAt: number | null;

  // ---- 版本 ----
  versions: ResumeVersion[];

  // ---- 动作 ----
  fetchList: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchDetail: (id: string) => Promise<void>;
  createResume: (title: string, templateId?: string) => Promise<Resume>;
  duplicateResume: (id: string) => Promise<string>;
  deleteResume: (id: string) => Promise<void>;
  clearCurrent: () => void;

  updateMeta: (patch: Partial<Resume> & { layoutConfig?: string }) => void;
  persistMeta: (patch: Record<string, unknown>) => Promise<void>;
  saveLayout: (layout: LayoutConfig) => Promise<void>;

  addSection: (type: SectionType) => Promise<void>;
  updateSectionData: (sectionId: string, data: Record<string, unknown>) => void;
  persistSection: (sectionId: string) => Promise<void>;
  renameSection: (sectionId: string, name: string) => void;
  toggleSectionVisible: (sectionId: string) => Promise<void>;
  deleteSection: (sectionId: string) => Promise<void>;
  reorderSections: (orderedIds: string[]) => Promise<void>;
  duplicateSection: (sectionId: string) => Promise<void>;

  fetchVersions: (id: string) => Promise<void>;
  createVersion: (label: string, description?: string) => Promise<void>;
  restoreVersion: (versionId: string) => Promise<void>;
  deleteVersion: (versionId: string) => Promise<void>;

  setCurrent: (resume: ResumeDetail | null) => void;
  patchSectionLocal: (sectionId: string, updater: (s: ResumeSection) => ResumeSection) => void;
}

/** section 校验：确保 data 始终是对象 */
function normalizeSections(sections: ResumeSection[]): ResumeSection[] {
  return sections.map((s) => ({ ...s, data: normalizeSectionData(s.data) }));
}

export const useResumeStore = create<ResumeState>((set, get) => ({
  resumes: [],
  stats: null,
  listLoading: false,

  current: null,
  detailLoading: false,
  dirty: false,
  saving: false,
  lastSavedAt: null,

  versions: [],

  // ---------------------------------------------------------------
  // 列表
  // ---------------------------------------------------------------

  fetchList: async () => {
    set({ listLoading: true });
    try {
      const resumes = await resumeApi.list();
      set({ resumes });
    } finally {
      set({ listLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await resumeApi.stats();
      set({ stats });
    } catch {
      /* 统计失败不阻断页面 */
    }
  },

  // ---------------------------------------------------------------
  // 详情
  // ---------------------------------------------------------------

  fetchDetail: async (id) => {
    set({ detailLoading: true });
    try {
      const detail = await resumeApi.detail(id);
      set({
        current: { ...detail, sections: normalizeSections(detail.sections || []) },
        dirty: false,
      });
    } finally {
      set({ detailLoading: false });
    }
  },

  createResume: async (title, templateId) => {
    const resume = await resumeApi.create(title, templateId);
    await get().fetchList();
    return resume;
  },

  duplicateResume: async (id) => {
    const { id: newId } = await resumeApi.duplicate(id);
    await get().fetchList();
    return newId;
  },

  deleteResume: async (id) => {
    await resumeApi.remove(id);
    await get().fetchList();
  },

  clearCurrent: () => set({ current: null, dirty: false, versions: [] }),

  // ---------------------------------------------------------------
  // 元信息 / 布局
  // ---------------------------------------------------------------

  updateMeta: (patch) => {
    const current = get().current;
    if (!current) return;
    set({ current: { ...current, ...patch } as ResumeDetail, dirty: true });
  },

  persistMeta: async (patch) => {
    const current = get().current;
    if (!current) return;
    set({ saving: true });
    try {
      await resumeApi.update(current.id, patch);
      set({ dirty: false, lastSavedAt: Date.now() });
    } finally {
      set({ saving: false });
    }
  },

  saveLayout: async (layout) => {
    const current = get().current;
    if (!current) return;
    const json = JSON.stringify(layout);
    // 先本地更新，保证预览即时响应
    set({ current: { ...current, layoutConfig: json }, dirty: true, saving: true });
    try {
      await resumeApi.update(current.id, { layoutConfig: json });
      set({ dirty: false, lastSavedAt: Date.now() });
    } finally {
      set({ saving: false });
    }
  },

  // ---------------------------------------------------------------
  // 模块
  // ---------------------------------------------------------------

  addSection: async (type) => {
    const current = get().current;
    if (!current) return;
    const maxOrder = current.sections.reduce((max, s) => Math.max(max, s.sortOrder), -1);
    const payload = EMPTY_SECTION_DATA[type] ?? { content: '', _config: {} };

    set({ saving: true });
    try {
      await resumeApi.addSection(current.id, {
        sectionType: type,
        sortOrder: maxOrder + 1,
        data: JSON.stringify(payload),
      });
      const detail = await resumeApi.detail(current.id);
      set({
        current: { ...detail, sections: normalizeSections(detail.sections || []) },
        lastSavedAt: Date.now(),
      });
    } finally {
      set({ saving: false });
    }
  },

  updateSectionData: (sectionId, data) => {
    const current = get().current;
    if (!current) return;
    const sections = current.sections.map((s) =>
      s.id === sectionId ? { ...s, data: { ...data } } : s
    );
    set({ current: { ...current, sections }, dirty: true });
  },

  persistSection: async (sectionId) => {
    const current = get().current;
    if (!current) return;
    const section = current.sections.find((s) => s.id === sectionId);
    if (!section) return;

    set({ saving: true });
    try {
      await resumeApi.updateSection(sectionId, {
        sectionType: section.sectionType,
        sortOrder: section.sortOrder,
        isVisible: section.isVisible,
        layout: section.layout,
        data: JSON.stringify(section.data),
      });
      set({ dirty: false, lastSavedAt: Date.now() });
    } finally {
      set({ saving: false });
    }
  },

  renameSection: (sectionId, name) => {
    const current = get().current;
    if (!current) return;
    const sections = current.sections.map((s) => {
      if (s.id !== sectionId) return s;
      const data = normalizeSectionData(s.data);
      return { ...s, data: { ...data, _config: { ...(data._config || {}), moduleName: name } } };
    });
    set({ current: { ...current, sections }, dirty: true });
  },

  toggleSectionVisible: async (sectionId) => {
    const current = get().current;
    if (!current) return;
    const sections = current.sections.map((s) =>
      s.id === sectionId ? { ...s, isVisible: !s.isVisible } : s
    );
    set({ current: { ...current, sections } });
    await resumeApi.toggleSection(sectionId);
  },

  deleteSection: async (sectionId) => {
    const current = get().current;
    if (!current) return;
    // 乐观更新：先移除，再落库
    const sections = current.sections.filter((s) => s.id !== sectionId);
    set({ current: { ...current, sections } });
    await resumeApi.deleteSection(sectionId);
  },

  reorderSections: async (orderedIds) => {
    const current = get().current;
    if (!current) return;
    const map = new Map(current.sections.map((s) => [s.id, s]));
    const reordered = orderedIds
      .map((id, index) => {
        const s = map.get(id);
        return s ? { ...s, sortOrder: index } : null;
      })
      .filter(Boolean) as ResumeSection[];

    set({ current: { ...current, sections: reordered } });
    await resumeApi.reorderSections(current.id, orderedIds.map((id) => ({ id })));
  },

  duplicateSection: async (sectionId) => {
    const current = get().current;
    if (!current) return;
    const src = current.sections.find((s) => s.id === sectionId);
    if (!src) return;
    const maxOrder = current.sections.reduce((max, s) => Math.max(max, s.sortOrder), -1);

    // 深拷贝 data，并为自定义模块改名以示区分
    const cloned = JSON.parse(JSON.stringify(src.data)) as Record<string, unknown>;
    const cfg = (cloned._config || {}) as Record<string, unknown>;
    if (cfg.moduleName) cfg.moduleName = `${cfg.moduleName} 副本`;
    cloned._config = cfg;

    set({ saving: true });
    try {
      await resumeApi.addSection(current.id, {
        sectionType: src.sectionType,
        sortOrder: maxOrder + 1,
        layout: src.layout,
        data: JSON.stringify(cloned),
      });
      const detail = await resumeApi.detail(current.id);
      set({ current: { ...detail, sections: normalizeSections(detail.sections || []) } });
    } finally {
      set({ saving: false });
    }
  },

  // ---------------------------------------------------------------
  // 版本
  // ---------------------------------------------------------------

  fetchVersions: async (id) => {
    try {
      const versions = await resumeApi.versions(id);
      set({ versions });
    } catch {
      set({ versions: [] });
    }
  },

  createVersion: async (label, description) => {
    const current = get().current;
    if (!current) return;
    const version = await resumeApi.createVersion(current.id, label, description);
    set({ versions: [version, ...get().versions] });
  },

  restoreVersion: async (versionId) => {
    const current = get().current;
    if (!current) return;
    await resumeApi.restoreVersion(current.id, versionId);
    await get().fetchDetail(current.id);
    await get().fetchVersions(current.id);
  },

  deleteVersion: async (versionId) => {
    const current = get().current;
    if (!current) return;
    await resumeApi.deleteVersion(current.id, versionId);
    set({ versions: get().versions.filter((v) => v.id !== versionId) });
  },

  // ---------------------------------------------------------------
  // 通用
  // ---------------------------------------------------------------

  setCurrent: (resume) => set({ current: resume }),

  patchSectionLocal: (sectionId, updater) => {
    const current = get().current;
    if (!current) return;
    const sections = current.sections.map((s) => (s.id === sectionId ? updater(s) : s));
    set({ current: { ...current, sections }, dirty: true });
  },
}));
