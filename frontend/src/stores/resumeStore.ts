/**
 * 简历状态
 * ------------------------------------------------------------------
 * 承担编辑器的核心状态管理：
 *   - 简历列表与统计（Dashboard）
 *   - 当前编辑的简历（含 sections），支持乐观更新
 *   - 模块的增删改、排序、显隐
 *   - 所有编辑保留为草稿，显式保存时整份原子提交
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
  resumes: Resume[];
  stats: ResumeStats | null;
  listLoading: boolean;
  current: ResumeDetail | null;
  saved: ResumeDetail | null;
  detailLoading: boolean;
  dirty: boolean;
  saving: boolean;
  lastSavedAt: number | null;
  past: ResumeDetail[];
  future: ResumeDetail[];
  historyGroup: string | null;
  historyAt: number;
  versions: ResumeVersion[];
  versionsLoading: boolean;
  versionsError: string | null;
  fetchList: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchDetail: (id: string) => Promise<void>;
  createResume: (title: string, templateId?: string) => Promise<Resume>;
  duplicateResume: (id: string) => Promise<string>;
  deleteResume: (id: string) => Promise<void>;
  clearCurrent: () => void;
  updateMeta: (patch: Partial<Resume> & { layoutConfig?: string }) => void;
  saveLayout: (layout: LayoutConfig) => Promise<void>;
  saveCurrent: (label?: string, description?: string) => Promise<void>;
  undo: () => void;
  redo: () => void;
  discardChanges: () => void;
  addSection: (type: SectionType) => Promise<ResumeSection | undefined>;
  updateSectionData: (id: string, data: Record<string, unknown>) => void;
  applyAiSection: (id: string, data: Record<string, unknown>, expectedData: Record<string, unknown>, makeVisible?: boolean) => Promise<void>;
  renameSection: (id: string, name: string) => void;
  toggleSectionVisible: (id: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  reorderSections: (ids: string[]) => Promise<void>;
  duplicateSection: (id: string) => Promise<void>;
  fetchVersions: (id: string) => Promise<void>;
  createVersion: (label: string, description?: string) => Promise<void>;
  restoreVersion: (id: string) => Promise<void>;
  deleteVersion: (id: string) => Promise<void>;
  setCurrent: (resume: ResumeDetail | null) => void;
  patchSectionLocal: (id: string, updater: (s: ResumeSection) => ResumeSection) => void;
  syncPublishedState: () => Promise<void>;
}

function normalize(detail: ResumeDetail): ResumeDetail {
  return { ...detail, sections: (detail.sections || []).map(s => ({ ...s, data: normalizeSectionData(s.data) })) };
}
/** Keep sharing, timestamps, counters and transport-only fields out of content history. */
function contentOf(resume: ResumeDetail) {
  const { title, templateId, targetJob, targetCompany, fontFamily, fontSize, themeColor, lineSpacing, layoutConfig } = resume;
  return { title, templateId, targetJob, targetCompany, fontFamily, fontSize, themeColor, lineSpacing, layoutConfig,
    sections: resume.sections.map(({ id, sectionType, sortOrder, isVisible, layout, data }) => ({ id, sectionType, sortOrder, isVisible, layout, data })) };
}
function sameContent(a: ResumeDetail | null, b: ResumeDetail | null) {
  const stable = (value: ResumeDetail | null) => JSON.stringify(value && contentOf(value), (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
  return stable(a) === stable(b);
}

export const useResumeStore = create<ResumeState>((set, get) => {
  let loadSequence = 0;
  const edit = (next: ResumeDetail, group: string | null = null) => {
    const state = get();
    if (!state.current || sameContent(next, state.current)) return;
    const grouped = group && group === state.historyGroup && Date.now() - state.historyAt < 600;
    set({ current: next, dirty: !sameContent(next, state.saved),
      past: grouped ? state.past : [...state.past.slice(-99), structuredClone(state.current)],
      future: [], historyGroup: group, historyAt: Date.now() });
  };
  const patchSection = (id: string, updater: (s: ResumeSection) => ResumeSection, group: string | null = null) => {
    const current = get().current;
    if (current) edit({ ...current, sections: current.sections.map(s => s.id === id ? updater(s) : s) }, group);
  };
  return {
    resumes: [], stats: null, listLoading: false, current: null, saved: null, detailLoading: false,
    dirty: false, saving: false, lastSavedAt: null, past: [], future: [], historyGroup: null, historyAt: 0,
    versions: [], versionsLoading: false, versionsError: null,
    fetchList: async () => { set({ listLoading: true }); try { set({ resumes: await resumeApi.list() }); } finally { set({ listLoading: false }); } },
    fetchStats: async () => { try { set({ stats: await resumeApi.stats() }); } catch { /* list remains usable */ } },
    fetchDetail: async (id) => {
      const sequence = ++loadSequence;
      set({ current: null, saved: null, detailLoading: true, dirty: false, saving: false, past: [], future: [], lastSavedAt: null, historyGroup: null });
      try { const detail = normalize(await resumeApi.detail(id)); if (sequence === loadSequence) set({ current: detail, saved: structuredClone(detail) }); }
      finally { if (sequence === loadSequence) set({ detailLoading: false }); }
    },
    createResume: async (title, templateId) => { const result = await resumeApi.create(title, templateId); await get().fetchList(); return result; },
    duplicateResume: async (id) => { const result = await resumeApi.duplicate(id); await get().fetchList(); return result.id; },
    deleteResume: async (id) => { await resumeApi.remove(id); await get().fetchList(); },
    clearCurrent: () => { ++loadSequence; set({ current: null, saved: null, dirty: false, saving: false, versions: [], past: [], future: [], historyGroup: null, versionsError: null, lastSavedAt: null }); },
    updateMeta: (patch) => { const current = get().current; if (current) edit({ ...current, ...patch }, 'meta'); },
    saveLayout: async (layout) => { const current = get().current; if (current) edit({ ...current, layoutConfig: JSON.stringify(layout) }, 'layout'); },
    saveCurrent: async (label, description) => {
      const { current, saved, saving, dirty } = get();
      if (!current || !saved) return;
      if (saving) throw new Error('正在保存，请稍候');
      if (!dirty && !label) return;
      const snapshot = structuredClone(current);
      const sequence = loadSequence;
      set({ saving: true, historyGroup: null });
      try {
        const result = normalize(await resumeApi.saveContent(current.id, { ...contentOf(snapshot), expectedUpdatedAt: saved.updatedAt, label, description }));
        const latest = get().current;
        if (sequence !== loadSequence || latest?.id !== current.id) return;
        const next = sameContent(latest, snapshot) ? result : { ...latest, updatedAt: result.updatedAt };
        set({ current: next, saved: structuredClone(result), dirty: !sameContent(next, result), lastSavedAt: Date.now() });
        await get().fetchVersions(current.id);
      } finally { if (sequence === loadSequence && get().current?.id === current.id) set({ saving: false }); }
    },
    undo: () => {
      const s = get(), previous = s.past[s.past.length - 1]; if (!s.current || !previous) return;
      const next = { ...structuredClone(previous), updatedAt: s.saved?.updatedAt || previous.updatedAt, shareEnabled: s.current.shareEnabled, shareToken: s.current.shareToken };
      set({ current: next, past: s.past.slice(0, -1), future: [...s.future, structuredClone(s.current)], dirty: !sameContent(next, s.saved), historyGroup: null });
    },
    redo: () => {
      const s = get(), following = s.future[s.future.length - 1]; if (!s.current || !following) return;
      const next = { ...structuredClone(following), updatedAt: s.saved?.updatedAt || following.updatedAt, shareEnabled: s.current.shareEnabled, shareToken: s.current.shareToken };
      set({ current: next, past: [...s.past, structuredClone(s.current)], future: s.future.slice(0, -1), dirty: !sameContent(next, s.saved), historyGroup: null });
    },
    discardChanges: () => { const saved = get().saved; if (saved) set({ current: structuredClone(saved), dirty: false, past: [], future: [], historyGroup: null }); },
    addSection: async (type) => {
      const current = get().current; if (!current) return;
      const section: ResumeSection = { id: crypto.randomUUID(), sectionType: type, sortOrder: Math.max(-1, ...current.sections.map(s => s.sortOrder)) + 1, isVisible: true, layout: 'auto', data: structuredClone(EMPTY_SECTION_DATA[type] || EMPTY_SECTION_DATA.custom) };
      edit({ ...current, sections: [...current.sections, section] }); return section;
    },
    updateSectionData: (id, data) => patchSection(id, s => ({ ...s, data: structuredClone(data) }), `section:${id}`),
    applyAiSection: async (id, data, expectedData, makeVisible = false) => {
      const section = get().current?.sections.find(s => s.id === id);
      if (!section) throw new Error('原模块不存在，请重新打开简历');
      if (JSON.stringify(section.data) !== JSON.stringify(expectedData)) throw new Error('原文已修改，请重新生成建议');
      patchSection(id, s => ({ ...s, data: structuredClone(data), isVisible: makeVisible ? true : s.isVisible }));
    },
    renameSection: (id, name) => patchSection(id, s => ({ ...s, data: { ...s.data, _config: { ...(s.data._config || {}), moduleName: name } } })),
    toggleSectionVisible: async (id) => patchSection(id, s => ({ ...s, isVisible: !s.isVisible })),
    deleteSection: async (id) => { const current = get().current; if (current) edit({ ...current, sections: current.sections.filter(s => s.id !== id) }); },
    reorderSections: async (ids) => {
      const current = get().current; if (!current) return;
      if (ids.length !== current.sections.length || new Set(ids).size !== ids.length || ids.some(id => !current.sections.some(s => s.id === id))) throw new Error('模块顺序已变化，请重试');
      edit({ ...current, sections: ids.map((id, sortOrder) => ({ ...current.sections.find(s => s.id === id)!, sortOrder })) });
    },
    duplicateSection: async (id) => {
      const current = get().current, section = current?.sections.find(s => s.id === id); if (!current || !section) return;
      const data = structuredClone(section.data); if (data._config?.moduleName) data._config.moduleName += ' 副本';
      edit({ ...current, sections: [...current.sections, { ...section, id: crypto.randomUUID(), sortOrder: Math.max(...current.sections.map(s => s.sortOrder)) + 1, data }] });
    },
    fetchVersions: async (id) => {
      const sequence = loadSequence; set({ versionsLoading: true, versionsError: null });
      try { const versions = await resumeApi.versions(id); if (sequence === loadSequence) set({ versions }); }
      catch { if (sequence === loadSequence) set({ versionsError: '版本记录加载失败，请重试' }); }
      finally { if (sequence === loadSequence) set({ versionsLoading: false }); }
    },
    createVersion: async (label, description) => get().saveCurrent(label, description),
    restoreVersion: async (id) => {
      const current = get().current; if (!current) return;
      const detail = await resumeApi.versionDetail(current.id, id);
      const latest = get().current; if (!latest || latest.id !== current.id) throw new Error('简历已切换，请重新选择版本');
      if (!sameContent(latest, current)) throw new Error('编辑内容已变化，请重新确认恢复');
      const snapshot = normalize(detail.snapshot);
      edit({ ...latest, ...contentOf(snapshot), id: latest.id, updatedAt: latest.updatedAt } as ResumeDetail);
    },
    deleteVersion: async (id) => { const current = get().current; if (!current) return; await resumeApi.deleteVersion(current.id, id); if (get().current?.id === current.id) set({ versions: get().versions.filter(v => v.id !== id) }); },
    setCurrent: (current) => set({ current }),
    patchSectionLocal: (id, updater) => patchSection(id, updater),
    syncPublishedState: async () => {
      const current = get().current; if (!current) return;
      const server = normalize(await resumeApi.detail(current.id));
      const latest = get().current, saved = get().saved;
      if (!latest || latest.id !== current.id || !saved) return;
      const share = { shareEnabled: server.shareEnabled, shareToken: server.shareToken };
      if (sameContent(server, saved)) set({ current: { ...latest, ...share, updatedAt: server.updatedAt }, saved: { ...saved, ...share, updatedAt: server.updatedAt } });
    },
  };
});
