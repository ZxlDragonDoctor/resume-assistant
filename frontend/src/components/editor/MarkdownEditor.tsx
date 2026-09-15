import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { brand, fontFamily, fontSize, neutral, radius, text } from '../../styles/tokens';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
}

/**
 * Markdown 双栏切换编辑器（编辑 / 预览）。
 * 所有视觉常量来自设计令牌，不出现魔法色值。
 */
export default function MarkdownEditor({ value, onChange, placeholder, minRows = 6, maxRows = 20 }: Props) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const isEdit = tab === 'edit';

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: `${4}px 16px`,
    cursor: 'pointer',
    fontSize: fontSize.sm,
    fontWeight: active ? 600 : 400,
    color: active ? brand.primary : text.tertiary,
    borderBottom: `2px solid ${active ? brand.primary : 'transparent'}`,
    transition: 'color 0.15s ease, border-color 0.15s ease',
  });

  return (
    <div style={{ border: `1px solid ${neutral[200]}`, borderRadius: radius.sm, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${neutral[200]}`, background: neutral[50] }}>
        <div onClick={() => setTab('edit')} style={tabStyle(isEdit)}>编辑</div>
        <div onClick={() => setTab('preview')} style={tabStyle(!isEdit)}>预览</div>
        <div style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: fontSize.xs, color: text.placeholder }}>
          支持 Markdown
        </div>
      </div>

      {isEdit ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || '支持 Markdown 格式...'}
          style={{
            width: '100%',
            minHeight: minRows * 22,
            maxHeight: maxRows * 22,
            border: 'none',
            outline: 'none',
            padding: '10px 12px',
            fontSize: fontSize.md,
            fontFamily: fontFamily.mono,
            lineHeight: 1.7,
            resize: 'vertical',
            color: text.secondary,
            background: neutral[0],
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <div style={{
          padding: '10px 12px',
          minHeight: minRows * 22,
          fontSize: fontSize.md,
          lineHeight: 1.7,
          color: text.secondary,
          background: neutral[0],
          overflow: 'auto',
        }}>
          {value ? (
            <div className="markdown-preview">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            </div>
          ) : (
            <span style={{ color: text.placeholder }}>暂无内容</span>
          )}
        </div>
      )}

      <style>{`
        .markdown-preview h1 { font-size: 18px; margin: 12px 0 6px; font-weight: 600; color: ${text.primary}; }
        .markdown-preview h2 { font-size: 16px; margin: 10px 0 5px; font-weight: 600; color: ${text.primary}; }
        .markdown-preview h3 { font-size: 14px; margin: 8px 0 4px; font-weight: 600; color: ${text.primary}; }
        .markdown-preview p { margin: 4px 0; }
        .markdown-preview ul, .markdown-preview ol { padding-left: 20px; margin: 4px 0; }
        .markdown-preview li { margin: 2px 0; }
        .markdown-preview strong { font-weight: 600; color: ${text.primary}; }
        .markdown-preview a { color: ${brand.primary}; text-decoration: none; }
        .markdown-preview a:hover { text-decoration: underline; }
        .markdown-preview code {
          background: ${neutral[100]}; padding: 1px 5px; border-radius: ${radius.xs}px;
          font-size: 12px; font-family: ${fontFamily.mono}; color: ${brand.secondary};
        }
        .markdown-preview pre {
          background: ${neutral[50]}; padding: 10px 14px; border-radius: ${radius.sm}px;
          overflow-x: auto; border: 1px solid ${neutral[200]}; margin: 8px 0;
        }
        .markdown-preview pre code { background: none; padding: 0; color: ${text.secondary}; }
        .markdown-preview blockquote {
          border-left: 3px solid ${brand.primaryBorder}; padding-left: 12px;
          color: ${text.tertiary}; margin: 8px 0;
        }
        .markdown-preview table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12px; }
        .markdown-preview th, .markdown-preview td { border: 1px solid ${neutral[200]}; padding: 6px 10px; text-align: left; }
        .markdown-preview th { background: ${neutral[50]}; font-weight: 600; }
        .markdown-preview hr { border: none; border-top: 1px solid ${neutral[200]}; margin: 12px 0; }
      `}</style>
    </div>
  );
}
