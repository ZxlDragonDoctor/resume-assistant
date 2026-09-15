/**
 * 认证状态
 * ------------------------------------------------------------------
 * 管理登录态、用户资料，并在应用启动时尝试用 token 拉取最新资料。
 */
import { create } from 'zustand';
import { auth, authApi } from '../services/api';
import type { AuthResponse, UserProfile } from '../types/resume';

interface AuthState {
  user: UserProfile | null;
  /** 首次启动是否已完成 token 校验 */
  initialized: boolean;
  loading: boolean;

  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  setUser: (user: UserProfile) => void;
}

function fromAuthResponse(res: AuthResponse): UserProfile {
  return { id: res.userId, name: res.name, email: res.email, avatarUrl: res.avatarUrl };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: auth.getUser(),
  initialized: false,
  loading: false,

  init: async () => {
    const token = auth.getToken();
    if (!token) {
      set({ initialized: true, user: null });
      return;
    }
    try {
      const user = await authApi.me();
      auth.setUser(user);
      set({ user, initialized: true });
    } catch {
      // token 失效，清理本地状态
      auth.clear();
      set({ user: null, initialized: true });
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await authApi.login(email, password);
      auth.setToken(res.token);
      const user = fromAuthResponse(res);
      auth.setUser(user);
      set({ user, initialized: true });
    } finally {
      set({ loading: false });
    }
  },

  register: async (email, password, name) => {
    set({ loading: true });
    try {
      const res = await authApi.register(email, password, name);
      auth.setToken(res.token);
      const user = fromAuthResponse(res);
      auth.setUser(user);
      set({ user, initialized: true });
    } finally {
      set({ loading: false });
    }
  },

  logout: () => {
    auth.clear();
    set({ user: null });
  },

  updateProfile: async (data) => {
    const user = await authApi.updateProfile(data);
    auth.setUser(user);
    set({ user });
  },

  changePassword: async (oldPassword, newPassword) => {
    await authApi.changePassword(oldPassword, newPassword);
  },

  setUser: (user) => {
    auth.setUser(user);
    set({ user });
  },
}));

export const isLoggedIn = () => Boolean(auth.getToken());
