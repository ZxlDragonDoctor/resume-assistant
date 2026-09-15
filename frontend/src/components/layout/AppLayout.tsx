/**
 * 应用外壳：导航栏 + 内容区 + 页脚
 * ------------------------------------------------------------------
 * 落地页使用透明导航（融入 Hero 渐变），内页使用实心导航。
 */
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Button, Dropdown, type MenuProps } from 'antd';
import {
  AppstoreOutlined,
  FileTextOutlined,
  LogoutOutlined,
  UserOutlined,
  DownOutlined,
} from '@ant-design/icons';

import Logo from './Logo';
import { useAuthStore } from '../../stores/authStore';
import { brand, layout as layoutTokens, neutral, radius, transition, zIndex } from '../../styles/tokens';

const NAV_ITEMS = [
  { key: '/', label: '首页' },
  { key: '/templates', label: '模板库' },
  { key: '/dashboard', label: '我的简历' },
];

interface Props {
  children: React.ReactNode;
}

export default function AppLayout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);

  // 首页导航在滚动后才加背景，避免遮挡 Hero 渐变
  const isHome = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const userMenu: MenuProps['items'] = [
    {
      key: 'header',
      type: 'group',
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: neutral[800] }}>{user?.name}</div>
          <div style={{ fontSize: 11, color: neutral[400] }}>{user?.email}</div>
        </div>
      ),
    },
    { type: 'divider' },
    {
      key: 'dashboard',
      icon: <FileTextOutlined />,
      label: '我的简历',
      onClick: () => navigate('/dashboard'),
    },
    {
      key: 'templates',
      icon: <AppstoreOutlined />,
      label: '模板库',
      onClick: () => navigate('/templates'),
    },
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '账号设置',
      onClick: () => navigate('/profile'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: () => {
        logout();
        navigate('/');
      },
    },
  ];

  const isActive = (key: string) =>
    key === '/' ? location.pathname === '/' : location.pathname.startsWith(key);

  const solid = !isHome || scrolled;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ---------------- 导航栏 ---------------- */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: zIndex.sticky,
          height: layoutTokens.navbarHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          background: solid ? 'rgba(255,255,255,0.88)' : 'transparent',
          backdropFilter: solid ? 'saturate(180%) blur(14px)' : 'none',
          WebkitBackdropFilter: solid ? 'saturate(180%) blur(14px)' : 'none',
          borderBottom: solid ? `1px solid ${neutral[150]}` : '1px solid transparent',
          transition: transition.base,
        }}
      >
        {/* 左：Logo + 导航 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Logo size={28} />
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: -0.3,
                color: neutral[900],
              }}
            >
              晓龙简历
            </span>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.key);
              return (
                <Link
                  key={item.key}
                  to={item.key}
                  style={{
                    padding: '6px 14px',
                    borderRadius: radius.md,
                    fontSize: 14,
                    fontWeight: active ? 500 : 400,
                    color: active ? brand.primaryActive : neutral[600],
                    background: active ? brand.primarySoft : 'transparent',
                    transition: transition.fast,
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* 右：用户区 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user ? (
            <Dropdown menu={{ items: userMenu }} placement="bottomRight" trigger={['click']}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 10px 4px 4px',
                  borderRadius: radius.pill,
                  cursor: 'pointer',
                  transition: transition.fast,
                  border: `1px solid ${neutral[150]}`,
                  background: '#fff',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = brand.primaryBorder;
                  e.currentTarget.style.background = brand.primarySoft;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = neutral[150];
                  e.currentTarget.style.background = '#fff';
                }}
              >
                <Avatar
                  size={28}
                  src={user.avatarUrl || undefined}
                  style={{ background: brand.gradient, fontSize: 13, fontWeight: 600 }}
                >
                  {user.name?.[0]?.toUpperCase()}
                </Avatar>
                <span style={{ fontSize: 13, color: neutral[700], fontWeight: 500 }}>
                  {user.name}
                </span>
                <DownOutlined style={{ fontSize: 9, color: neutral[400] }} />
              </div>
            </Dropdown>
          ) : (
            <>
              <Button type="text" onClick={() => navigate('/login')} style={{ color: neutral[600] }}>
                登录
              </Button>
              <Button
                type="primary"
                onClick={() => navigate('/login')}
                style={{
                  background: brand.gradient,
                  border: 'none',
                  borderRadius: radius.md,
                  fontWeight: 500,
                  boxShadow: '0 2px 8px rgba(79,70,229,0.24)',
                }}
              >
                免费使用
              </Button>
            </>
          )}
        </div>
      </header>

      {/* ---------------- 内容 ---------------- */}
      <main style={{ flex: 1 }}>{children}</main>

      {/* ---------------- 页脚 ---------------- */}
      <footer
        style={{
          borderTop: `1px solid ${neutral[150]}`,
          background: '#fff',
          padding: '28px 32px',
          marginTop: 'auto',
        }}
      >
        <div
          style={{
            maxWidth: layoutTokens.contentMaxWidth,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Logo size={22} />
            <span style={{ fontSize: 14, fontWeight: 600, color: neutral[700] }}>晓龙简历</span>
            <span style={{ fontSize: 12, color: neutral[400] }}>
              · 让每一份简历都被看见
            </span>
          </div>
          <div style={{ fontSize: 12, color: neutral[400] }}>
            © {new Date().getFullYear()} 晓龙简历 · Spring Cloud + React 全栈实践项目
          </div>
        </div>
      </footer>
    </div>
  );
}
