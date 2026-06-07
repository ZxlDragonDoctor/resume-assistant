import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string, name: string) =>
    api.post('/auth/register', { email, password, name }),
};

export const resumeApi = {
  list: () => api.get('/resumes'),
  detail: (id: string) => api.get(`/resumes/${id}`),
  create: (title: string, templateId?: string) =>
    api.post('/resumes', { title, templateId }),
  delete: (id: string) => api.delete(`/resumes/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/resumes/${id}`, data),
  addSection: (resumeId: string, data: {
    sectionType: string;
    sortOrder: number;
    data: string;
  }) => api.post(`/resumes/${resumeId}/sections`, data),
  updateSection: (sectionId: string, data: {
    sectionType: string;
    sortOrder: number;
    data: string;
  }) => api.put(`/resumes/sections/${sectionId}`, data),
  reorderSections: (resumeId: string, order: { id: string }[]) =>
    api.post(`/resumes/${resumeId}/sections/reorder`, order),
};

export const templateApi = {
  list: () => api.get('/templates'),
  detail: (id: string) => api.get(`/templates/${id}`),
};

export const fileApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/files/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const aiApi = {
  optimizeBullet: (content: string, jobTitle?: string) =>
    api.post('/ai/optimize-bullet', { content, job_title: jobTitle }),
  generateSummary: (resumeInfo: string) =>
    api.post('/ai/generate-summary', { resume_info: resumeInfo }),
  atsScore: (jobDescription: string, resumeContent: string) =>
    api.post('/ai/ats-score', {
      job_description: jobDescription,
      resume_content: resumeContent,
    }),
};

export default api;
