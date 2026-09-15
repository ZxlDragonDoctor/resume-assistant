/**
 * 账号设置
 * ------------------------------------------------------------------
 * 三块内容：个人资料（姓名 / 手机）、头像、密码修改。
 * 头像走 file-service（MinIO），其他字段走 auth-service。
 */
import { useEffect, useState } from 'react';
import { Avatar, Button, Input, message, Upload } from 'antd';
import {
  CameraOutlined,
  CheckOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from '@ant-design/icons';

import AppLayout from '../components/layout/AppLayout';
import { fileApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { brand, layout as layoutTokens, neutral, radius, semantic, shadow, transition } from '../styles/tokens';

type Tab = 'profile' | 'security';

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const changePassword = useAuthStore((s) => s.changePassword);

  const [tab, setTab] = useState<Tab>('profile');

  // ---- 资料 ----
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // ---- 密码 ----
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
  }, [user?.name, user?.phone]);

  const profileDirty = name !== (user?.name || '') || phone !== (user?.phone || '');

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      message.warning('请填写姓名');
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() });
      message.success('资料已更新');
    } catch {
      message.error('保存失败，请稍后重试');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUploadAvatar = async (file: File) => {
    try {
      const { url } = await fileApi.uploadAvatar(file);
      await updateProfile({ avatarUrl: url });
      message.success('头像已更新');
    } catch {
      message.error('头像上传失败');
    }
  };

  const handleChangePassword = async () => {
    if (newPwd.length < 6) {
      message.warning('新密码至少 6 位');
      return;
    }
    if (newPwd !== confirmPwd) {
      message.warning('两次输入的新密码不一致');
      return;
    }
    setSavingPwd(true);
    try {
      await changePassword(oldPwd, newPwd);
      message.success('密码已修改，请用新密码重新登录');
      setOldPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch {
      /* 拦截器已提示 */
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <AppLayout>
      <div
        style={{
          maxWidth: layoutTokens.contentMaxWidth,
          margin: '0 auto',
          padding: '36px 24px 72px',
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, color: neutral[900], marginBottom: 6 }}>
          账号设置
        </h1>
        <p style={{ fontSize: 13.5, color: neutral[500], marginBottom: 26 }}>
          管理你的个人资料与账号安全
        </p>

        <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* ---- 左侧：头像卡 ---- */}
          <div
            style={{
              width: 268,
              flexShrink: 0,
              background: '#fff',
              border: `1px solid ${neutral[150]}`,
              borderRadius: radius.xl,
              padding: '26px 20px',
              textAlign: 'center',
              boxShadow: shadow.sm,
            }}
          >
            <Upload
              showUploadList={false}
              accept="image/*"
              beforeUpload={(file) => {
                if (file.size > 5 * 1024 * 1024) {
                  message.warning('图片不要超过 5MB');
                  return Upload.LIST_IGNORE;
                }
                handleUploadAvatar(file as File);
                return false;
              }}
            >
              <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
                <Avatar
                  size={88}
                  src={user?.avatarUrl}
                  style={{
                    background: brand.gradient,
                    fontSize: 32,
                    fontWeight: 600,
                    border: `3px solid #fff`,
                    boxShadow: shadow.md,
                  }}
                >
                  {(user?.name || 'U').slice(0, 1).toUpperCase()}
                </Avatar>
                <span
                  style={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#fff',
                    border: `1px solid ${neutral[200]}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: neutral[500],
                    fontSize: 12,
                    boxShadow: shadow.sm,
                  }}
                >
                  <CameraOutlined />
                </span>
              </div>
            </Upload>

            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: neutral[900],
                marginTop: 14,
                marginBottom: 3,
              }}
            >
              {user?.name || '未设置姓名'}
            </div>
            <div style={{ fontSize: 12.5, color: neutral[400], wordBreak: 'break-all' }}>
              {user?.email}
            </div>

            <div
              style={{
                marginTop: 18,
                paddingTop: 18,
                borderTop: `1px solid ${neutral[150]}`,
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 11.5, color: neutral[400], lineHeight: 1.9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MailOutlined style={{ fontSize: 11 }} />
                  {user?.email}
                </div>
                {user?.createdAt && (
                  <div style={{ marginTop: 5 }}>
                    注册于 {new Date(user.createdAt.replace(' ', 'T')).toLocaleDateString('zh-CN')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ---- 右侧：表单 ---- */}
          <div
            style={{
              flex: '1 1 460px',
              minWidth: 320,
              background: '#fff',
              border: `1px solid ${neutral[150]}`,
              borderRadius: radius.xl,
              boxShadow: shadow.sm,
              overflow: 'hidden',
            }}
          >
            {/* 页签 */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${neutral[150]}` }}>
              {(
                [
                  { key: 'profile', label: '个人资料', icon: <UserOutlined /> },
                  { key: 'security', label: '账号安全', icon: <LockOutlined /> },
                ] as const
              ).map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      padding: '15px 0',
                      fontSize: 13.5,
                      fontWeight: active ? 600 : 400,
                      color: active ? brand.primary : neutral[500],
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      borderBottom: `2px solid ${active ? brand.primary : 'transparent'}`,
                      marginBottom: -1,
                      transition: transition.fast,
                    }}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: '26px 28px 32px' }}>
              {tab === 'profile' ? (
                <div key="profile" className="animate-fade" style={{ maxWidth: 420 }}>
                  <Field label="姓名" required>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="请输入姓名"
                      prefix={<UserOutlined style={{ color: neutral[300] }} />}
                      size="large"
                    />
                  </Field>

                  <Field label="邮箱" hint="邮箱是账号唯一标识，暂不支持修改">
                    <Input
                      value={user?.email}
                      disabled
                      prefix={<MailOutlined style={{ color: neutral[300] }} />}
                      size="large"
                    />
                  </Field>

                  <Field label="手机号" hint="用于接收面试提醒（可选）">
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="请输入手机号"
                      prefix={<PhoneOutlined style={{ color: neutral[300] }} />}
                      size="large"
                      maxLength={20}
                    />
                  </Field>

                  <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Button
                      type="primary"
                      size="large"
                      loading={savingProfile}
                      disabled={!profileDirty}
                      onClick={handleSaveProfile}
                      icon={<CheckOutlined />}
                      style={{
                        background: profileDirty ? brand.gradient : undefined,
                        border: 'none',
                        height: 40,
                        paddingInline: 22,
                      }}
                    >
                      保存修改
                    </Button>
                    {profileDirty && (
                      <button
                        onClick={() => {
                          setName(user?.name || '');
                          setPhone(user?.phone || '');
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: neutral[500],
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        放弃修改
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div key="security" className="animate-fade" style={{ maxWidth: 420 }}>
                  <Field label="当前密码" required>
                    <Input.Password
                      value={oldPwd}
                      onChange={(e) => setOldPwd(e.target.value)}
                      placeholder="请输入当前密码"
                      size="large"
                    />
                  </Field>

                  <Field label="新密码" required hint="至少 6 位">
                    <Input.Password
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder="请输入新密码"
                      size="large"
                    />
                  </Field>

                  <Field label="确认新密码" required>
                    <Input.Password
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                      placeholder="请再次输入新密码"
                      size="large"
                      status={confirmPwd && confirmPwd !== newPwd ? 'error' : undefined}
                    />
                  </Field>

                  {confirmPwd && confirmPwd !== newPwd && (
                    <div style={{ fontSize: 12, color: semantic.danger, marginTop: -8, marginBottom: 12 }}>
                      两次输入的密码不一致
                    </div>
                  )}

                  <Button
                    type="primary"
                    size="large"
                    loading={savingPwd}
                    disabled={!oldPwd || !newPwd || !confirmPwd}
                    onClick={handleChangePassword}
                    icon={<LockOutlined />}
                    style={{
                      marginTop: 14,
                      background:
                        oldPwd && newPwd && confirmPwd ? brand.gradient : undefined,
                      border: 'none',
                      height: 40,
                      paddingInline: 22,
                    }}
                  >
                    修改密码
                  </Button>

                  <div
                    style={{
                      marginTop: 20,
                      padding: '11px 13px',
                      background: neutral[25],
                      border: `1px solid ${neutral[150]}`,
                      borderRadius: radius.md,
                      fontSize: 11.5,
                      color: neutral[500],
                      lineHeight: 1.8,
                    }}
                  >
                    修改密码后当前登录状态仍然有效。如果你怀疑账号被盗用，
                    建议同时检查简历的分享链接是否仍然开启。
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ------------------------------------------------------------------

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 7,
          fontSize: 13,
          fontWeight: 500,
          color: neutral[700],
        }}
      >
        {required && <span style={{ color: semantic.danger }}>*</span>}
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ fontSize: 11.5, color: neutral[400], marginTop: 5, lineHeight: 1.7 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
