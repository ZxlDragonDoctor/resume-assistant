import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Dropdown, message } from 'antd';
import {
  UserOutlined, LogoutOutlined, FileTextOutlined, DashboardOutlined,
} from '@ant-design/icons';

const NAV_ITEMS = [
  { key: '/dashboard', label: '我的简历' },
  { key: '/templates', label: '简历模板' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');

  const handleNavClick = (path: string) => {
    if (!token && path !== '/login') {
      navigate('/login', { state: { from: path } });
      return;
    }
    navigate(path);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    message.success('已退出');
    navigate('/');
  };

  const userMenu = {
    items: [
      { key: 'dashboard', icon: <DashboardOutlined />, label: '我的简历', onClick: () => navigate('/dashboard') },
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout, danger: true },
    ],
  };

  return (
    <nav style={{
      height: 56, background: 'rgba(255,255,255,0.9)', borderBottom: '1px solid #f0f0f0',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', position: 'sticky', top: 0, zIndex: 100,
      backdropFilter: 'blur(12px)',
    }}>
      {/* Left: Logo + Nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <div
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          <img src="/logo.png" alt="晓龙简历" style={{ height: 32, width: 'auto' }} />
          <span style={{ fontSize: 22, fontWeight: 700, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            晓龙简历
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {NAV_ITEMS.map(item => (
            <div
              key={item.key}
              onClick={() => handleNavClick(item.key)}
              style={{
                padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14,
                color: location.pathname.startsWith(item.key) ? '#2563eb' : '#475569',
                background: location.pathname.startsWith(item.key) ? '#eef2ff' : 'transparent',
                fontWeight: location.pathname.startsWith(item.key) ? 500 : 400,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { if (!location.pathname.startsWith(item.key)) e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={(e) => { if (!location.pathname.startsWith(item.key)) e.currentTarget.style.background = 'transparent'; }}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Right: User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {token ? (
          <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 14, fontWeight: 600,
              boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
            }}>
            </div>
          </Dropdown>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="text" onClick={() => navigate('/login')} style={{ color: '#475569' }}>登录</Button>
            <Button type="primary" onClick={() => navigate('/login')}
              style={{ borderRadius: 8, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', border: 'none' }}>
              注册
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}
