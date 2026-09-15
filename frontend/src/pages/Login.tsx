/**
 * 登录 / 注册
 * ------------------------------------------------------------------
 * 单页切换登录与注册，左侧品牌展示区 + 右侧表单，
 * 在窄屏下自动收敛为单列。
 */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as AntApp, Button, Form, Input } from 'antd';
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';

import Logo from '../components/layout/Logo';
import { useAuthStore } from '../stores/authStore';
import { brand, neutral, radius, shadow } from '../styles/tokens';

type Mode = 'login' | 'register';

const HIGHLIGHTS = [
  '模块化排版，每个模块独立控制样式',
  'AI 润色 + ATS 匹配度评分',
  'A4 PDF 导出，所见即所得',
  '分享链接与版本快照',
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = AntApp.useApp();
  const { login, register, loading } = useAuthStore();

  const [mode, setMode] = useState<Mode>('login');
  const [form] = Form.useForm();

  // 登录成功后回到来源页；默认进工作台
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const handleSubmit = async (values: { email: string; password: string; name?: string }) => {
    try {
      if (mode === 'register') {
        await register(values.email, values.password, values.name!);
        message.success('账号创建成功，欢迎使用');
      } else {
        await login(values.email, values.password);
        message.success('登录成功');
      }
      navigate(redirectTo, { replace: true });
    } catch {
      // 拦截器已统一提示错误，这里无需重复
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    form.resetFields();
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 56px)',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        background: '#fff',
      }}
      className="login-split"
    >
      {/* ---------------- 左：品牌区 ---------------- */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '56px 64px',
          background: brand.gradient,
          overflow: 'hidden',
        }}
      >
        {/* 装饰 */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            left: -80,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.09)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -140,
            right: -60,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.07)',
          }}
        />

        <div style={{ position: 'relative', maxWidth: 420 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 34 }}>
            <Logo size={34} monochrome />
            <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: -0.2 }}>
              晓龙简历
            </span>
          </div>

          <h2
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.3,
              letterSpacing: -0.6,
              marginBottom: 14,
            }}
          >
            让简历替你
            <br />
            说清楚你的价值
          </h2>
          <p
            style={{
              fontSize: 14.5,
              color: 'rgba(255,255,255,0.82)',
              lineHeight: 1.75,
              marginBottom: 32,
            }}
          >
            从排版到措辞，再到岗位匹配度分析，一站式完成。
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {HIGHLIGHTS.map((h) => (
              <div
                key={h}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13.5,
                  color: 'rgba(255,255,255,0.92)',
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </span>
                {h}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- 右：表单 ---------------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '56px 32px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 372 }}>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: neutral[900],
              letterSpacing: -0.4,
              marginBottom: 8,
            }}
          >
            {mode === 'login' ? '欢迎回来' : '创建账号'}
          </h1>
          <p style={{ fontSize: 14, color: neutral[500], marginBottom: 30 }}>
            {mode === 'login' ? '登录后继续编辑你的简历' : '注册即可免费使用全部功能'}
          </p>

          <Form form={form} layout="vertical" onFinish={handleSubmit} size="large" requiredMark={false}>
            {mode === 'register' && (
              <Form.Item
                name="name"
                rules={[{ required: true, message: '请输入姓名' }]}
                style={{ marginBottom: 18 }}
              >
                <Input
                  prefix={<UserOutlined style={{ color: neutral[400] }} />}
                  placeholder="你的姓名"
                  style={{ borderRadius: radius.md }}
                />
              </Form.Item>
            )}

            <Form.Item
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '邮箱格式不正确' },
              ]}
              style={{ marginBottom: 18 }}
            >
              <Input
                prefix={<MailOutlined style={{ color: neutral[400] }} />}
                placeholder="邮箱地址"
                autoComplete="email"
                style={{ borderRadius: radius.md }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少 6 位' },
              ]}
              style={{ marginBottom: 24 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: neutral[400] }} />}
                placeholder={mode === 'register' ? '设置密码（至少 6 位）' : '密码'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                style={{ borderRadius: radius.md }}
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              style={{
                height: 44,
                borderRadius: radius.md,
                fontSize: 15,
                fontWeight: 500,
                background: brand.gradient,
                border: 'none',
                boxShadow: '0 4px 14px rgba(79,70,229,0.26)',
              }}
            >
              {mode === 'login' ? '登录' : '注册并开始'}
            </Button>
          </Form>

          <div
            style={{
              marginTop: 22,
              textAlign: 'center',
              fontSize: 13.5,
              color: neutral[500],
            }}
          >
            {mode === 'login' ? '还没有账号？' : '已有账号？'}
            <button
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              style={{
                border: 'none',
                background: 'none',
                color: brand.primary,
                fontWeight: 500,
                cursor: 'pointer',
                padding: '0 4px',
                fontSize: 13.5,
              }}
            >
              {mode === 'login' ? '免费注册' : '去登录'}
            </button>
          </div>

          {mode === 'login' && (
            <div
              style={{
                marginTop: 28,
                padding: '12px 14px',
                borderRadius: radius.md,
                background: neutral[50],
                border: `1px solid ${neutral[150]}`,
                fontSize: 12,
                color: neutral[500],
                lineHeight: 1.7,
              }}
            >
              <strong style={{ color: neutral[700] }}>本地体验：</strong>
              请先在导航栏注册一个账号，数据保存在你本机部署的 PostgreSQL 中。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
