/**
 * 分享对话框
 * ------------------------------------------------------------------
 * 生成公开只读链接（/share/:token），HR 无需登录即可查看，
 * 简历始终实时反映最新内容。
 */
import { useEffect, useState } from 'react';
import { Button, Modal, Switch, Tooltip } from 'antd';
import {
  CheckOutlined,
  CopyOutlined,
  EyeOutlined,
  GlobalOutlined,
  LinkOutlined,
  LockOutlined,
} from '@ant-design/icons';

import { resumeApi } from '../../services/api';
import { message } from '../../utils/antdStatic';
import type { ResumeDetail } from '../../types/resume';
import { brand, neutral, radius, semantic, transition } from '../../styles/tokens';

interface Props {
  open: boolean;
  resume: ResumeDetail | null;
  onClose: () => void;
  onChanged: (patch: { shareEnabled: boolean; shareToken?: string }) => void;
}

export default function ShareDialog({ open, resume, onClose, onChanged }: Props) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setEnabled(!!resume?.shareEnabled);
    setToken(resume?.shareToken);
    setCopied(false);
  }, [open, resume?.shareEnabled, resume?.shareToken]);

  const link = token ? `${window.location.origin}/share/${token}` : '';

  const toggle = async (next: boolean) => {
    if (!resume) return;
    setLoading(true);
    try {
      if (next) {
        const res = await resumeApi.enableShare(resume.id);
        setToken(res.shareToken);
        setEnabled(true);
        onChanged({ shareEnabled: true, shareToken: res.shareToken });
        message.success('分享链接已开启');
      } else {
        await resumeApi.disableShare(resume.id);
        setEnabled(false);
        onChanged({ shareEnabled: false });
        message.success('分享链接已关闭');
      }
    } catch {
      message.error('操作失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      message.success('链接已复制到剪贴板');
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // 降级：选中文本提示用户手动复制
      message.warning('浏览器拒绝了剪贴板访问，请手动选中链接复制');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GlobalOutlined style={{ color: brand.primary }} />
          分享简历
        </span>
      }
      width={500}
      footer={null}
    >
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            background: enabled ? brand.primarySoft : neutral[25],
            border: `1px solid ${enabled ? brand.primaryBorder : neutral[150]}`,
            borderRadius: radius.lg,
            marginBottom: 16,
            transition: transition.fast,
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: radius.md,
              background: enabled ? brand.primary : neutral[200],
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              flexShrink: 0,
              transition: transition.fast,
            }}
          >
            {enabled ? <GlobalOutlined /> : <LockOutlined />}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: neutral[800], marginBottom: 2 }}>
              {enabled ? '链接分享已开启' : '简历当前仅自己可见'}
            </div>
            <div style={{ fontSize: 11.5, color: neutral[500], lineHeight: 1.7 }}>
              {enabled
                ? `访问次数 ${resume?.viewCount ?? 0} 次，内容实时更新`
                : '开启后会生成一个只读链接，任何人可访问'}
            </div>
          </div>
          <Switch checked={enabled} loading={loading} onChange={toggle} />
        </div>

        {enabled && (
          <>
            <div style={{ fontSize: 12.5, color: neutral[600], marginBottom: 7 }}>分享链接</div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                padding: '8px 10px',
                border: `1px solid ${neutral[200]}`,
                borderRadius: radius.md,
                background: neutral[25],
                marginBottom: 12,
              }}
            >
              <LinkOutlined style={{ color: neutral[400], fontSize: 12, flexShrink: 0 }} />
              <input
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: 12.5,
                  color: neutral[700],
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  minWidth: 0,
                }}
              />
              <Button
                size="small"
                type={copied ? 'default' : 'primary'}
                icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                onClick={copy}
                style={
                  copied
                    ? { color: semantic.success, borderColor: `${semantic.success}66`, fontSize: 12 }
                    : { background: brand.primary, border: 'none', fontSize: 12 }
                }
              >
                {copied ? '已复制' : '复制'}
              </Button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                block
                icon={<EyeOutlined />}
                onClick={() => window.open(link, '_blank', 'noopener')}
                style={{ height: 36, fontSize: 12.5 }}
              >
                预览访客看到的效果
              </Button>
            </div>

            <div
              style={{
                marginTop: 14,
                padding: '10px 13px',
                background: neutral[25],
                border: `1px solid ${neutral[150]}`,
                borderRadius: radius.md,
                fontSize: 11.5,
                color: neutral[500],
                lineHeight: 1.8,
              }}
            >
              <strong style={{ color: neutral[700] }}>使用建议：</strong>
              <br />
              · 链接内容与简历实时同步，改完不需要重新发链接
              <br />
              · 投递外企或大厂时，可把链接放在邮件的签名档
              <br />
              · 若不再投递该岗位，记得回来关闭链接
            </div>
          </>
        )}

        {!enabled && (
          <Tooltip title="开启后即可复制链接">
            <div
              style={{
                padding: '10px 13px',
                background: neutral[25],
                border: `1px solid ${neutral[150]}`,
                borderRadius: radius.md,
                fontSize: 11.5,
                color: neutral[400],
                lineHeight: 1.8,
              }}
            >
              链接使用随机令牌，无法被猜到。关闭后原有链接立即失效。
            </div>
          </Tooltip>
        )}
      </div>
    </Modal>
  );
}
