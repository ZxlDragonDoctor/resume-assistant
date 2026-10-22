/**
 * API 客户端
 * ------------------------------------------------------------------
 * 统一封装：JWT 自动注入、响应解包、401 自动登出、错误提示。
 * 所有接口返回 Promise<T>（已解包 R<T>.data），业务层无需再判 code。
 */
import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { message } from 'antd';
import type {
  AiBatchResponse,
  AiHealth,
  AiTextResponse,
  ApiResponse,
  AtsScoreResponse,
  AuthResponse,
  InterviewQuestionsResponse,
  JdParseResponse,
  LayoutConfig,
  Resume,
  ResumeDetail,
  ResumeSection,
  ResumeStats,
  ResumeVersion,
  SectionType,
  SkillMatchResponse,
  Template,
  TemplateCategory,
  UserProfile,
} from '../types/resume';

const TOKEN_KEY = 'resume_token';
const USER_KEY = 'resume_user';

export const auth = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  getUser: (): UserProfile | null => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserProfile;
    } catch {
      return null;
    }
  },
  setUser: (user: UserProfile) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

// ------------------------------------------------------------------
// Axios 实例
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 后端地址（支持部署到静态托管）
// ------------------------------------------------------------------
/**
 * 开发环境：留空走 Vite 代理（/api → localhost:8080，/export → localhost:8085）。
 * 生产环境：通过 VITE_API_BASE_URL / VITE_EXPORT_BASE_URL 指定真实后端地址。
 *
 * 例如部署到 Vercel 时设置：
 *   VITE_API_BASE_URL=https://your-gateway.example.com/api
 *   VITE_EXPORT_BASE_URL=https://your-export.example.com
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';
const EXPORT_BASE = (import.meta.env.VITE_EXPORT_BASE_URL as string | undefined) || '';

const http: AxiosInstance = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 30000,
});

http.interceptors.request.use((config) => {
  const token = auth.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * export-service 专用实例。
 *
 * 注意：export-service（:8085）是独立的 Node 服务，**不在网关的 /api 路由下**，
 * 因此不能复用 baseURL='/api' 的 http 实例 —— 否则请求会变成 /api/export/direct，
 * 被网关拦下返回 401，永远到不了导出服务。
 * 开发环境走 Vite 代理（'/export' → localhost:8085）；生产环境用 EXPORT_BASE。
 * 该服务无需 JWT，但带上也无害。
 */
const exportHttp: AxiosInstance = axios.create({
  baseURL: EXPORT_BASE,
  timeout: 90000,
});

http.interceptors.response.use(
  (res) => res,
  (err: AxiosError<ApiResponse<unknown>>) => {
    if (axios.isCancel(err) || err.code === 'ERR_CANCELED') return Promise.reject(err);
    const status = err.response?.status;
    const body = err.response?.data;

    if (status === 401) {
      auth.clear();
      // 避免在登录页重复跳转
      if (!window.location.pathname.startsWith('/login')) {
        message.warning('登录状态已过期，请重新登录');
        window.location.href = '/login';
      }
      return Promise.reject(err);
    }

    // 后端统一返回 {code, message}，优先展示业务 message
    const bizMessage = body?.message;
    if (bizMessage) {
      message.error(bizMessage);
    } else if (err.code === 'ECONNABORTED') {
      message.error('请求超时，请稍后重试');
    } else if (!err.response) {
      message.error('暂时无法连接服务，请稍后重试');
    } else {
      message.error('请求失败，请稍后重试');
    }
    return Promise.reject(err);
  }
);

/** 解包 R<T>，返回 data */
async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await promise;
  if (!res.data || res.data.code !== 200) {
    const errorMessage = res.data?.message || '服务返回异常，请稍后重试';
    if (res.data?.code === 401) {
      auth.clear();
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    }
    message.error(errorMessage);
    throw new Error(errorMessage);
  }
  return res.data.data;
}

// ==================================================================
// 认证
// ==================================================================

export const authApi = {
  login: (email: string, password: string) =>
    unwrap<AuthResponse>(http.post('/auth/login', { email, password })),

  register: (email: string, password: string, name: string) =>
    unwrap<AuthResponse>(http.post('/auth/register', { email, password, name })),

  me: () => unwrap<UserProfile>(http.get('/auth/me')),

  updateProfile: (data: Partial<UserProfile>) =>
    unwrap<UserProfile>(http.patch('/auth/me', data)),

  changePassword: (oldPassword: string, newPassword: string) =>
    unwrap<void>(http.post('/auth/change-password', { oldPassword, newPassword })),
};

// ==================================================================
// 简历
// ==================================================================

export const resumeApi = {
  list: () => unwrap<Resume[]>(http.get('/resumes')),

  stats: () => unwrap<ResumeStats>(http.get('/resumes/stats')),

  detail: (id: string) => unwrap<ResumeDetail>(http.get(`/resumes/${id}`)),

  create: (title: string, templateId?: string) =>
    unwrap<Resume>(http.post('/resumes', { title, templateId })),

  duplicate: (id: string) =>
    unwrap<{ id: string }>(http.post(`/resumes/${id}/duplicate`)),

  remove: (id: string) => unwrap<void>(http.delete(`/resumes/${id}`)),

  update: (id: string, data: Partial<LayoutConfig> & Record<string, unknown>) =>
    unwrap<void>(http.patch(`/resumes/${id}`, data)),

  // ---- 分享 ----
  enableShare: (id: string) =>
    unwrap<{ shareToken: string; shareEnabled: boolean }>(http.post(`/resumes/${id}/share`)),

  disableShare: (id: string) => unwrap<void>(http.delete(`/resumes/${id}/share`)),

  getShared: (token: string) => unwrap<ResumeDetail>(http.get(`/public/resumes/${token}`)),

  // ---- 模块 ----
  addSection: (
    resumeId: string,
    payload: { sectionType: SectionType | string; sortOrder: number; data: string; layout?: string }
  ) => unwrap<ResumeSection>(http.post(`/resumes/${resumeId}/sections`, payload)),

  updateSection: (
    sectionId: string,
    payload: { sectionType: string; sortOrder: number; data: string; isVisible?: boolean; layout?: string }
  ) => unwrap<void>(http.put(`/resumes/sections/${sectionId}`, payload)),

  toggleSection: (sectionId: string) =>
    unwrap<void>(http.patch(`/resumes/sections/${sectionId}/visibility`)),

  deleteSection: (sectionId: string) => unwrap<void>(http.delete(`/resumes/sections/${sectionId}`)),

  reorderSections: (resumeId: string, order: { id: string }[]) =>
    unwrap<void>(http.post(`/resumes/${resumeId}/sections/reorder`, order)),

  // ---- 版本 ----
  versions: (id: string) => unwrap<ResumeVersion[]>(http.get(`/resumes/${id}/versions`)),

  createVersion: (id: string, label: string, description?: string) =>
    unwrap<ResumeVersion>(http.post(`/resumes/${id}/versions`, { label, description })),

  restoreVersion: (id: string, versionId: string) =>
    unwrap<void>(http.post(`/resumes/${id}/versions/${versionId}/restore`)),

  deleteVersion: (id: string, versionId: string) =>
    unwrap<void>(http.delete(`/resumes/${id}/versions/${versionId}`)),
};

// ==================================================================
// 模板
// ==================================================================

export const templateApi = {
  list: (category?: string, keyword?: string) =>
    unwrap<Template[]>(
      http.get('/templates', { params: { category, keyword } })
    ),

  categories: () => unwrap<TemplateCategory[]>(http.get('/templates/categories')),

  detail: (id: string) => unwrap<Template>(http.get(`/templates/${id}`)),

  /** 把当前简历样式保存为自定义模板 */
  create: (payload: {
    name: string;
    description?: string;
    category?: string;
    tags?: string[];
    config: string;
  }) => unwrap<Template>(http.post('/templates', payload)),
};

// ==================================================================
// 文件
// ==================================================================

export const fileApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return unwrap<{ url: string; objectName: string; size: number }>(
      http.post('/files/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    );
  },

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return unwrap<{ url: string }>(
      http.post('/files/avatar', form)
    );
  },
};

// ==================================================================
// AI
// ==================================================================

export const aiApi = {
  health: (signal?: AbortSignal) => unwrap<AiHealth>(http.get('/ai/health', { signal, timeout: 60000 })),

  optimizeBullet: (content: string, jobTitle?: string, signal?: AbortSignal) =>
    unwrap<AiTextResponse>(http.post('/ai/optimize-bullet', { content, job_title: jobTitle || '' }, { signal, timeout: 60000 })),

  optimizeBullets: (bullets: { id: string; content: string }[], jobTitle?: string, signal?: AbortSignal) =>
    unwrap<AiBatchResponse>(http.post('/ai/optimize-bullets', { bullets, job_title: jobTitle || '' }, { signal, timeout: 60000 })),

  generateSummary: (resumeInfo: string, signal?: AbortSignal) =>
    unwrap<AiTextResponse>(http.post('/ai/generate-summary', { resume_info: resumeInfo }, { signal, timeout: 60000 })),

  atsScore: (jobDescription: string, resumeContent: string, signal?: AbortSignal) =>
    unwrap<AtsScoreResponse>(
      http.post('/ai/ats-score', { job_description: jobDescription, resume_content: resumeContent }, { signal, timeout: 60000 })
    ),

  parseJd: (jobDescription: string, signal?: AbortSignal) =>
    unwrap<JdParseResponse>(http.post('/ai/parse-jd', { job_description: jobDescription }, { signal, timeout: 60000 })),

  matchSkills: (resumeContent: string, jobDescription: string, signal?: AbortSignal) =>
    unwrap<SkillMatchResponse>(
      http.post('/ai/match-skills', { resume_content: resumeContent, job_description: jobDescription }, { signal, timeout: 60000 })
    ),

  interviewQuestions: (jobTitle: string, resumeContent: string, signal?: AbortSignal) =>
    unwrap<InterviewQuestionsResponse>(
      http.post('/ai/interview-questions', { job_title: jobTitle, resume_content: resumeContent }, { signal, timeout: 60000 })
    ),
};

// ==================================================================
// 导出
// ==================================================================

export const exportApi = {
  /** 同步导出 PDF 并触发下载 */
  downloadPdf: async (resumeData: unknown, templateConfig?: unknown) => {
    const res = await exportHttp.post('/export/direct', { resumeData, templateConfig }, {
      responseType: 'blob',
      timeout: 90000,
    });
    return res.data as Blob;
  },

  /** 返回 PDF Blob 供内嵌预览（未实现则回退到前端预览） */
  previewPdf: async (resumeData: unknown, templateConfig?: unknown) => {
    const res = await exportHttp.post('/export/preview', { resumeData, templateConfig }, {
      responseType: 'blob',
      timeout: 90000,
    });
    return res.data as Blob;
  },
};

export default http;
