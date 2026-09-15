/**
 * 分享页（公开只读）
 * ------------------------------------------------------------------
 * 路由 /share/:token —— 无需登录即可访问。
 * 顶部是一条极简的品牌栏（带「我也要做一个」的转化入口），
 * 中间是居中的 A4 简历，底部提供下载 PDF / 打印。
 *
 * 访客视角要干净：没有编辑器的任何工具，只有一个可阅读、可下载的文档。
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Result, Spin, Tooltip, message } from 'antd';
import {
  DownloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  LoadingOutlined,
  PrinterOutlined,
} from '@ant-design/icons';

import ResumePreviewEngine from '../components/viewer/ResumePreviewEngine';
import { exportApi, resumeApi } from '../services/api';
import {
  normalizeSectionData,
  type ResumeDetail,
  type TemplateConfig,
} from '../types/resume';
import { brand, layout as layoutTokens, neutral, radius, shadow, transition } from '../styles/tokens';

export default function SharedResume() {
  const { token } = useParams<{ token: string }>();
  const [resume, setResume] = useState<ResumeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 访客页只做纯展示，模板配置缺失也能正常渲染
  const templateConfig: TemplateConfig | undefined = useMemo(() => undefined, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    resumeApi
      .getShared(token)
      .then((data) => {
        setResume(data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  /** 自动适配窗口宽度 */
  const [scale, setScale] = useState(0.8);
  useEffect(() => {
    const update = () => {
      const available = Math.min(window.innerWidth - 48, 980);
      setScale(Math.min(1, Math.max(0.36, available / layoutTokens.pageWidth)));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const handleDownload = async () => {
    if (!resume) return;
    setExporting(true);
    try {
      const blob = await exportApi.downloadPdf(resume, templateConfig);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(resume.title || '简历').replace(/[\\/:*?"<>|]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      message.success('PDF 已开始下载');
    } catch {
      message.warning('导出服务未启动，已为你打开打印窗口');
      window.print();
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 14,
          background: neutral[100],
        }}
      >
        <Spin indicator={<LoadingOutlined style={{ fontSize: 28, color: brand.primary }} spin />} />
        <span style={{ fontSize: 13, color: neutral[400] }}>正在加载简历…</span>
      </div>
    );
  }

  if (error || !resume) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: neutral[100],
        }}
      >
        <Result
          status="404"
          title="链接无效或已失效"
          subTitle="这份简历的分享链接可能已被关闭，或者令牌不正确。"
          extra={
            <Link to="/">
              <Button type="primary" style={{ background: brand.gradient, border: 'none' }}>
                去看看「{SITE_NAME}」
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const basic = normalizeSectionData(
    resume.sections.find((s) => s.sectionType === 'basic')?.data
  );
  const displayName = String(basic.name || resume.title || '个人简历');
  const jobTitle = String(basic.jobTitle || resume.targetJob || '');

  return (
    <div style={{ minHeight: '100vh', background: neutral[100] }}>
      {/* ============ 顶栏 ============ */}
      <header
        className="no-print"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          height: 54,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 18px',
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${neutral[150]}`,
        }}
      >
        <Link
          to="/"
          style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: radius.md,
              background: brand.gradient,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
            }}
          >
            <FileTextOutlined />
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: neutral[800],
              letterSpacing: 0.2,
            }}
          >
            {SITE_NAME}
          </span>
        </Link>

        <span
          style={{
            fontSize: 11.5,
            color: neutral[400],
            padding: '2px 8px',
            background: neutral[100],
            borderRadius: radius.pill,
            marginLeft: 2,
          }}
        >
          只读分享
        </span>

        <span style={{ flex: 1 }} />

        <Tooltip title="简历浏览次数" mouseEnterDelay={0.4}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11.5,
              color: neutral[400],
              marginRight: 4,
            }}
          >
            <EyeOutlined style={{ fontSize: 11 }} />
            {resume.viewCount ?? 0}
          </span>
        </Tooltip>

        <button
          onClick={() => window.print()}
          className="no-print"
          style={{
            border: `1px solid ${neutral[200]}`,
            background: '#fff',
            color: neutral[600],
            height: 30,
            borderRadius: radius.md,
            padding: '0 12px',
            fontSize: 12.5,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            transition: transition.fast,
          }}
        >
          <PrinterOutlined style={{ fontSize: 12 }} />
          打印
        </button>

        <button
          onClick={handleDownload}
          disabled={exporting}
          className="no-print"
          style={{
            border: 'none',
            background: brand.gradient,
            color: '#fff',
            height: 30,
            borderRadius: radius.md,
            padding: '0 14px',
            fontSize: 12.5,
            fontWeight: 500,
            cursor: exporting ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          {exporting ? <LoadingOutlined spin style={{ fontSize: 12 }} /> : <DownloadOutlined style={{ fontSize: 12 }} />}
          下载 PDF
        </button>
      </header>

      {/* ============ 标题区 ============ */}
      <div className="no-print" style={{ textAlign: 'center', padding: '34px 24px 20px' }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: neutral[900],
            marginBottom: 8,
            letterSpacing: 0.3,
          }}
        >
          {displayName}
        </h1>
        {jobTitle && (
          <p style={{ fontSize: 14, color: neutral[500], marginBottom: 0 }}>{jobTitle}</p>
        )}
      </div>

      {/* ============ 简历纸 ============ */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 24px 56px' }}>
        <div
          style={{
            width: layoutTokens.pageWidth * scale,
            height: layoutTokens.pageMinHeight * scale,
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: layoutTokens.pageWidth,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <div style={{ boxShadow: shadow.paper, background: '#fff' }}>
              <ResumePreviewEngine resume={resume} templateConfig={templateConfig} />
            </div>
          </div>
        </div>
      </div>

      {/* ============ 底部转化 ============ */}
      <footer
        className="no-print"
        style={{
          borderTop: `1px solid ${neutral[150]}`,
          background: '#fff',
          padding: '40px 24px 48px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: neutral[800],
            marginBottom: 7,
          }}
        >
          这份简历由「{SITE_NAME}」制作
        </div>
        <p style={{ fontSize: 13, color: neutral[500], marginBottom: 20, lineHeight: 1.8 }}>
          在线编辑、AI 优化、一键导出 A4 PDF，还能生成这样的分享链接
        </p>
        <Link to="/">
          <Button
            type="primary"
            size="large"
            style={{
              background: brand.gradient,
              border: 'none',
              height: 42,
              paddingInline: 26,
              fontWeight: 500,
            }}
          >
            免费创建我的简历
          </Button>
        </Link>
      </footer>

      {/* 打印：只保留简历纸 */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .resume-paper { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}

const SITE_NAME = '晓龙简历';
