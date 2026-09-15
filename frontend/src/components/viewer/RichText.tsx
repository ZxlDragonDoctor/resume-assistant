/**
 * 富文本渲染
 * ------------------------------------------------------------------
 * 统一处理三种输入形态，保证「用户怎么填，预览/导出就怎么显示」：
 *   1. HTML  —— 来自 TipTap 富文本编辑器，直接注入
 *   2. Markdown —— 来自 Markdown 编辑器或用户手写，渲染为结构化 HTML
 *   3. 纯文本 —— 转义后保留换行
 *
 * 同时负责把生成的内联样式应用到子元素（标题字号、列表间距等），
 * 使导出 PDF 时无需依赖外部样式表。
 */
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { neutral, radius } from '../../styles/tokens';

interface RichTextProps {
  content: string;
  fontSize?: number;
  lineHeight?: number;
  color?: string;
  /** 行内模式：用于列表项，渲染为 <span> 且不加段落边距 */
  inline?: boolean;
}

/** 是否包含 HTML 标签 */
function isHtml(str: string): boolean {
  return /<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i.test(str);
}

/** 是否看起来像 Markdown（有语法特征才走 Markdown 渲染，避免误判） */
function looksLikeMarkdown(str: string): boolean {
  return /(^|\n)\s{0,3}([-*+]\s|\d+\.\s|#{1,6}\s|>\s|\|)|(\*\*[^*\n]+\*\*)|(`[^`\n]+`)|(\[[^\]]+\]\([^)]+\))/.test(
    str
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function RichText({
  content,
  fontSize = 13,
  lineHeight = 1.65,
  color = neutral[700],
  inline = false,
}: RichTextProps) {
  const html = useMemo(() => {
    const text = content ?? '';
    if (!text.trim()) return '';
    if (isHtml(text)) return text;
    if (looksLikeMarkdown(text)) {
      // 行内模式下不生成块级标签
      if (inline) {
        return text
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code>$1</code>');
      }
      return null; // 交给 ReactMarkdown
    }
    return escapeHtml(text).replace(/\n/g, '<br/>');
  }, [content, inline]);

  const baseStyle: React.CSSProperties = {
    fontSize,
    lineHeight,
    color,
  };

  const cssVars = {
    '--rt-font-size': `${fontSize}px`,
    '--rt-line-height': String(lineHeight),
    '--rt-color': color,
  } as React.CSSProperties;

  // ---------- 行内 ----------
  if (inline) {
    if (isHtml(content)) {
      return <span style={baseStyle} dangerouslySetInnerHTML={{ __html: content }} />;
    }
    if (looksLikeMarkdown(content) && html) {
      return <span style={baseStyle} dangerouslySetInnerHTML={{ __html: html }} />;
    }
    return <span style={baseStyle}>{content}</span>;
  }

  // ---------- HTML 直出 ----------
  if (isHtml(content)) {
    return (
      <div
        className="resume-rich"
        style={{ ...baseStyle, ...cssVars }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // ---------- Markdown ----------
  if (looksLikeMarkdown(content)) {
    return (
      <div className="resume-rich" style={{ ...baseStyle, ...cssVars }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        <style>{`
          .resume-rich h1 { font-size: ${fontSize + 6}px; margin: 10px 0 5px; }
          .resume-rich h2 { font-size: ${fontSize + 4}px; margin: 9px 0 4px; }
          .resume-rich h3 { font-size: ${fontSize + 2}px; margin: 8px 0 4px; }
          .resume-rich h4, .resume-rich h5, .resume-rich h6 { font-size: ${fontSize}px; margin: 6px 0 3px; }
          .resume-rich p { margin: 3px 0; }
          .resume-rich ul, .resume-rich ol { padding-left: 18px; margin: 3px 0; }
          .resume-rich li { margin: 1px 0; }
          .resume-rich li::marker { color: ${color}; }
          .resume-rich code {
            background: ${neutral[100]};
            padding: 1px 4px;
            border-radius: ${radius.xs}px;
            font-size: ${fontSize - 1}px;
          }
          .resume-rich pre {
            background: ${neutral[50]};
            padding: 8px 12px;
            border-radius: ${radius.sm}px;
            border: 1px solid ${neutral[200]};
            margin: 6px 0;
            overflow-x: auto;
          }
          .resume-rich pre code { background: none; padding: 0; }
          .resume-rich blockquote {
            border-left: 3px solid ${color};
            padding-left: 10px;
            margin: 6px 0;
            opacity: 0.82;
          }
          .resume-rich strong { font-weight: 600; }
          .resume-rich a { color: ${color}; text-decoration: none; }
          .resume-rich table { border-collapse: collapse; width: 100%; margin: 6px 0; }
          .resume-rich th, .resume-rich td {
            border: 1px solid ${neutral[200]};
            padding: 4px 8px;
            text-align: left;
          }
          .resume-rich th { background: ${neutral[50]}; font-weight: 600; }
          .resume-rich hr { border: none; border-top: 1px solid ${neutral[200]}; margin: 8px 0; }
        `}</style>
      </div>
    );
  }

  // ---------- 纯文本 ----------
  return (
    <div
      className="resume-rich"
      style={{ ...baseStyle, whiteSpace: 'pre-wrap' }}
    >
      {content}
    </div>
  );
}
