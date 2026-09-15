/**
 * 导出对话框
 * ------------------------------------------------------------------
 * 走 export-service（Puppeteer 无头 Chrome → A4 PDF），保证
 * 「预览什么样，PDF 就什么样」——预览引擎与导出渲染器共用同一套规则。
 *
 * 提供两种路径：
 *   1. 生成并下载 PDF —— 后台同步渲染后直接下载
 *   2. 打印 / 另存为 PDF —— 浏览器原生打印，兜底方案
 */
import { useState } from 'react';
import { Button, Checkbox, Modal, Segmented, Spin } from 'antd';import {
  CheckCircleFilled,
  DownloadOutlined,
  FilePdfOutlined,
  LoadingOutlined,
  PrinterOutlined,
} from '@ant-design/icons';

import { exportApi } from '../../services/api';
import { message } from '../../utils/antdStatic';
import type { ResumeDetail, TemplateConfig } from '../../types/resume';
import { brand, neutral, radius, semantic } from '../../styles/tokens';

interface Props {
  open: boolean;
  resume: ResumeDetail | null;
  templateConfig?: TemplateConfig;
  onClose: () => void;
}

function safeFileName(name: string): string {
  return (name || '简历').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
}

export default function ExportDialog({ open, resume, templateConfig, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [scope, setScope] = useState<'visible' | 'all'>('visible');

  const buildPayload = () => {
    if (!resume) return null;
    // 「仅导出可见模块」→ 直接过滤；导出服务不关心可见性语义
    const payload =
      scope === 'visible'
        ? resume
        : { ...resume, sections: resume.sections.map((s) => ({ ...s, isVisible: true })) };
    return { resumeData: payload, templateConfig };
  };

  const handleDownload = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setLoading(true);
    setError('');
    setDone(false);
    try {
      const blob = await exportApi.downloadPdf(payload.resumeData, payload.templateConfig);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFileName(resume?.title || '简历')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // 延迟释放，避免部分浏览器下载被中断
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setDone(true);
      message.success('PDF 已开始下载');
    } catch (err) {
      // 区分「服务不可达」与「服务返回了错误」，便于定位问题；
      // 不要再笼统提示"请确认 8085 已启动" —— 服务可能是好的。
      const ax = err as { response?: { status?: number; data?: unknown }; message?: string };
      const status = ax?.response?.status;

      if (!ax?.response) {
        setError(
          '无法连接导出服务。请确认 export-service（端口 8085）已启动。' +
          '若已启动，请检查前端 Vite 代理 /export 是否指向 8085。'
        );
      } else if (status === 401) {
        setError('导出请求被网关拦截（401）。请重新登录后重试。');
      } else if (status === 404) {
        setError('导出接口不存在（404）。请确认 /export 未被网关的 /api 规则抢走。');
      } else if (status === 500) {
        const detail =
          typeof ax.response.data === 'object' && ax.response.data !== null
            ? (ax.response.data as { error?: string }).error
            : undefined;
        setError(
          `导出服务渲染失败${detail ? `：${detail}` : ''}。` +
          '通常是无头 Chrome 未安装或版式渲染异常。'
        );
      } else {
        setError(`导出失败（HTTP ${status}）${ax?.message ? `：${ax.message}` : ''}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    onClose();
    // 打印样式已在 global.css 中声明：只保留 .resume-paper
    setTimeout(() => window.print(), 240);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FilePdfOutlined style={{ color: brand.primary }} />
          导出 PDF
        </span>
      }
      width={468}
      footer={null}
    >
      <div style={{ paddingTop: 4 }}>
        {/* 纸张预览 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: 14,
            background: neutral[25],
            border: `1px solid ${neutral[150]}`,
            borderRadius: radius.lg,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 54,
              height: 74,
              background: '#fff',
              border: `1px solid ${neutral[200]}`,
              borderRadius: radius.sm,
              boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
              padding: 7,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              flexShrink: 0,
            }}
          >
            <div style={{ height: 5, background: brand.primary, borderRadius: 2, opacity: 0.75 }} />
            <div style={{ height: 2.5, background: neutral[150], borderRadius: 2 }} />
            <div style={{ height: 2.5, background: neutral[150], borderRadius: 2, width: '82%' }} />
            <div style={{ height: 2.5, background: neutral[150], borderRadius: 2 }} />
            <div style={{ height: 2.5, background: neutral[150], borderRadius: 2, width: '64%' }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: neutral[800],
                marginBottom: 3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {resume?.title || '未命名简历'}
            </div>
            <div style={{ fontSize: 11.5, color: neutral[400], lineHeight: 1.7 }}>
              A4 尺寸 · {resume?.sections?.length ?? 0} 个模块
              <br />
              与预览效果完全一致，可直接投递
            </div>
          </div>
        </div>

        {/* 导出范围 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, color: neutral[600], marginBottom: 7 }}>导出范围</div>
          <Segmented
            block
            value={scope}
            onChange={(v) => setScope(v as 'visible' | 'all')}
            options={[
              { label: '仅可见模块', value: 'visible' },
              { label: '包含隐藏模块', value: 'all' },
            ]}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <Checkbox defaultChecked disabled style={{ fontSize: 12.5, color: neutral[500] }}>
            保留可点击链接（邮箱 / 主页）
          </Checkbox>
        </div>

        {/* 状态反馈 */}
        {loading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '11px 13px',
              background: brand.primarySoft,
              border: `1px solid ${brand.primaryBorder}`,
              borderRadius: radius.md,
              marginBottom: 14,
              fontSize: 12.5,
              color: brand.primaryActive,
            }}
          >
            <Spin indicator={<LoadingOutlined spin />} size="small" />
            正在渲染 PDF…
          </div>
        )}

        {done && !loading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '11px 13px',
              background: semantic.successSoft,
              border: `1px solid ${semantic.success}30`,
              borderRadius: radius.md,
              marginBottom: 14,
              fontSize: 12.5,
              color: semantic.success,
            }}
          >
            <CheckCircleFilled />
            PDF 已生成并开始下载
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '11px 13px',
              background: semantic.dangerSoft,
              border: `1px solid ${semantic.danger}30`,
              borderRadius: radius.md,
              marginBottom: 14,
              fontSize: 12,
              color: semantic.dangerStrong,
              lineHeight: 1.75,
            }}
          >
            {error}
          </div>
        )}

        {/* 操作 */}
        <div style={{ display: 'flex', gap: 9 }}>
          <Button
            type="primary"
            block
            loading={loading}
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            style={{
              background: loading ? undefined : brand.gradient,
              border: 'none',
              height: 38,
              fontSize: 13,
            }}
          >
            生成并下载 PDF
          </Button>
          <Button
            icon={<PrinterOutlined />}
            onClick={handlePrint}
            style={{ height: 38, fontSize: 13, flexShrink: 0 }}
          >
            打印
          </Button>
        </div>

        <div
          style={{
            marginTop: 12,
            fontSize: 11,
            color: neutral[400],
            lineHeight: 1.75,
            textAlign: 'center',
          }}
        >
          若下载失败，可点「打印」并用浏览器的「另存为 PDF」
        </div>
      </div>
    </Modal>
  );
}
