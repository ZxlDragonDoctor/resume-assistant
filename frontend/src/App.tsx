/**
 * 应用路由与全局状态初始化
 * ------------------------------------------------------------------
 * 登录态在启动时通过 /auth/me 校验一次：
 *  - 未登录 → 直接放行到公开页面
 *  - 已登录 → 拉取最新资料，避免使用过期的 localStorage 缓存
 *
 * 路由级懒加载：编辑器（TipTap + dnd-kit + 预览引擎）体积最大，
 * 拆成独立 chunk 后首屏只加载首页所需的代码。
 */
import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Spin } from 'antd';

import AppLayout from './components/layout/AppLayout';
import AuthGuard from './components/common/AuthGuard';
import Home from './pages/Home';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Editor = lazy(() => import('./pages/Editor'));
const Templates = lazy(() => import('./pages/Templates'));
const Profile = lazy(() => import('./pages/Profile'));
const SharedResume = lazy(() => import('./pages/SharedResume'));

import { useAuthStore } from './stores/authStore';
import { useAntdStaticBridge } from './utils/antdStatic';

/** 编辑器与分享页是全屏工作台，不使用常规导航外壳 */
const FULLSCREEN_ROUTES = ['/editor/', '/share/'];

function RouteFallback({ fullscreen }: { fullscreen?: boolean }) {
  return (
    <div
      style={{
        height: fullscreen ? '100vh' : 'calc(100vh - 56px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <Spin />
      <span style={{ color: '#94A3B8', fontSize: 12.5 }}>加载中…</span>
    </div>
  );
}

export default function App() {
  const { init, initialized } = useAuthStore();
  const location = useLocation();

  // 把 antd 的 context 感知实例注入桥接层，
  // 使 message / Modal 等「静态」调用也能读取定制主题。
  useAntdStaticBridge();

  useEffect(() => {
    init();
  }, [init]);

  if (!initialized) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <Spin size="large" />
        <span style={{ color: '#94A3B8', fontSize: 13 }}>正在准备工作台…</span>
      </div>
    );
  }

  const isFullscreen = FULLSCREEN_ROUTES.some((p) => location.pathname.startsWith(p));

  const routes = (
    <Suspense fallback={<RouteFallback fullscreen={isFullscreen} />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/share/:token" element={<SharedResume />} />
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          }
        />
        <Route
          path="/profile"
          element={
            <AuthGuard>
              <Profile />
            </AuthGuard>
          }
        />
        <Route
          path="/editor/:id"
          element={
            <AuthGuard>
              <Editor />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );

  if (isFullscreen) {
    return routes;
  }

  return <AppLayout>{routes}</AppLayout>;
}
