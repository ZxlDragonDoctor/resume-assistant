import { useState } from 'react';
import { Tabs } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
}

export default function MarkdownEditor({ value, onChange, placeholder, minRows = 6, maxRows = 20 }: Props) {
  const [tab, setTab] = useState('edit');

  return (
    <div style={{ border: '1px solid #e8e8e8', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #e8e8e8', background: '#fafafa' }}>
        <div
          onClick={() => setTab('edit')}
          style={{
            padding: '4px 16px', cursor: 'pointer', fontSize: 12,
            color: tab === 'edit' ? '#2563eb' : '#666',
            borderBottom: tab === 'edit' ? '2px solid #2563eb' : '2px solid transparent',
          }}
        >
          编辑
        </div>
        <div
          onClick={() => setTab('preview')}
          style={{
            padding: '4px 16px', cursor: 'pointer', fontSize: 12,
            color: tab === 'preview' ? '#2563eb' : '#666',
            borderBottom: tab === 'preview' ? '2px solid #2563eb' : '2px solid transparent',
          }}
        >
          预览
        </div>
        <div style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: 11, color: '#999' }}>
          支持 Markdown
        </div>
      </div>

      {tab === 'edit' ? (
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
            padding: '8px 12px',
            fontSize: 13,
            fontFamily: "'SF Mono', Monaco, 'Cascadia Code', monospace",
            lineHeight: 1.7,
            resize: 'vertical',
            color: '#334155',
          }}
        />
      ) : (
        <div style={{
          padding: '8px 12px',
          minHeight: minRows * 22,
          fontSize: 13,
          lineHeight: 1.7,
          color: '#475569',
          overflow: 'auto',
        }}>
          {value ? (
            <div className="markdown-preview">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {value}
              </ReactMarkdown>
            </div>
          ) : (
            <span style={{ color: '#ccc' }}>暂无内容</span>
          )}
        </div>
      )}

      <style>{`
        .markdown-preview h1 { font-size: 18px; margin: 12px 0 6px; font-weight: 600; color: #0f172a; }
        .markdown-preview h2 { font-size: 16px; margin: 10px 0 5px; font-weight: 600; color: #0f172a; }
        .markdown-preview h3 { font-size: 14px; margin: 8px 0 4px; font-weight: 600; color: #0f172a; }
        .markdown-preview p { margin: 4px 0; }
        .markdown-preview ul, .markdown-preview ol { padding-left: 20px; margin: 4px 0; }
        .markdown-preview li { margin: 2px 0; }
        .markdown-preview code { background: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-size: 12px; color: #e11d48; }
        .markdown-preview pre { background: #f8fafc; padding: 10px 14px; border-radius: 6px; overflow-x: auto; border: 1px solid #e2e8f0; margin: 8px 0; }
        .markdown-preview pre code { background: none; padding: 0; color: #334155; }
        .markdown-preview blockquote { border-left: 3px solid #2563eb; padding-left: 12px; color: #64748b; margin: 8px 0; }
        .markdown-preview table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12px; }
        .markdown-preview th, .markdown-preview td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
        .markdown-preview th { background: #f8fafc; font-weight: 600; }
        .markdown-preview strong { font-weight: 600; color: #0f172a; }
        .markdown-preview a { color: #2563eb; text-decoration: none; }
        .markdown-preview a:hover { text-decoration: underline; }
        .markdown-preview hr { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }
      `}</style>
    </div>
  );
}
