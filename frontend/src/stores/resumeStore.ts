import { create } from 'zustand';
import { Resume, ResumeDetail } from '../types/resume';
import { resumeApi } from '../services/api';

interface ResumeStore {
  resumes: Resume[];
  currentResume: ResumeDetail | null;
  loading: boolean;
  fetchResumes: () => Promise<void>;
  fetchResume: (id: string) => Promise<void>;
  createResume: (title: string) => Promise<void>;
  deleteResume: (id: string) => Promise<void>;
  deleteSection: (sectionId: string) => Promise<void>;
  updateSectionLocal: (sectionId: string, newData: any) => void;
  updateResume: (id: string, data: Record<string, unknown>) => Promise<void>;
  setCurrentResume: (resume: ResumeDetail | null) => void;
}

export const useResumeStore = create<ResumeStore>((set, get) => ({
  resumes: [],
  currentResume: null,
  loading: false,

  fetchResumes: async () => {
    set({ loading: true });
    try {
      const res: any = await resumeApi.list();
      set({ resumes: res.data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchResume: async (id: string) => {
    set({ loading: true });
    try {
      const res: any = await resumeApi.detail(id);
      set({ currentResume: res.data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createResume: async (title: string) => {
    const res: any = await resumeApi.create(title);
    await get().fetchResumes();
  },

  deleteResume: async (id: string) => {
    await resumeApi.delete(id);
    await get().fetchResumes();
  },

  deleteSection: async (sectionId: string) => {
    await resumeApi.deleteSection(sectionId);
    const current = get().currentResume;
    if (current) {
      await get().fetchResume(current.id);
    }
  },

  updateSectionLocal: (sectionId: string, newData: any) => {
    const current = get().currentResume;
    if (!current) return;
    const dataStr = typeof newData === 'string' ? newData : JSON.stringify(newData);
    const updatedSections = current.sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, data: dataStr as any };
      }
      return s;
    });
    set({ currentResume: { ...current, sections: updatedSections } });
  },

  updateResume: async (id: string, data: Record<string, unknown>) => {
    await resumeApi.update(id, data);
    await get().fetchResume(id);
  },

  setCurrentResume: (resume) => set({ currentResume: resume }),
}));
