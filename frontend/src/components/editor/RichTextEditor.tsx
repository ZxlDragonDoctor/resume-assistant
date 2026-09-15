import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useState } from 'react';
import { brand, fontFamily, fontSize, neutral, radius, semantic, text } from '../../styles/tokens';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const Btn = ({ onClick, active, children, title, style }: {
  onClick: () => void; active?: boolean; children: React.ReactNode; title?: string; style?: React.CSSProperties;
}) => {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onClick} title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '3px 8px',
        border: `1px solid ${active ? brand.primaryBorder : 'transparent'}`,
        borderRadius: radius.xs,
        cursor: 'pointer',
        background: active ? brand.primarySoft : hover ? neutral[100] : 'transparent',
        color: active ? brand.primary : text.secondary,
        fontSize: fontSize.base,
        fontWeight: active ? 600 : 400,
        lineHeight: 1,
        transition: 'background 0.15s ease, color 0.15s ease',
        ...style,
      }}
    >
      {children}
    </button>
  );
};

const Sep = () => (
  <span style={{ width: 1, height: 20, background: neutral[200], margin: '0 4px', display: 'inline-block' }} />
);

/**
 * TipTap 富文本编辑器。用于描述类字段（工作职责、项目亮点等）。
 * 视觉常量全部取自设计令牌。
 */
export default function RichTextEditor({ value, onChange, placeholder, minHeight = 200 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight,
      Placeholder.configure({ placeholder: placeholder || '开始编辑...' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false);
    }
  }, [value]);

  if (!editor) return null;

  return (
    <div style={{ border: `1px solid ${neutral[200]}`, borderRadius: radius.md, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2,
        padding: '6px 8px', borderBottom: `1px solid ${neutral[200]}`, background: neutral[50],
      }}>
        <select
          value={editor.isActive('heading', { level: 1 }) ? 'h1' :
                 editor.isActive('heading', { level: 2 }) ? 'h2' :
                 editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'p') editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: parseInt(v[1]) as 1|2|3 }).run();
          }}
          style={{
            padding: '3px 6px', borderRadius: radius.xs, border: `1px solid ${neutral[200]}`,
            fontSize: fontSize.sm, color: text.secondary, background: neutral[0],
            outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="p">正文</option>
          <option value="h1">标题 1</option>
          <option value="h2">标题 2</option>
          <option value="h3">标题 3</option>
        </select>

        <Sep />

        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="粗体"><b>B</b></Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="斜体"><i>I</i></Btn>
        <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="下划线"><u>U</u></Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="删除线"><s>S</s></Btn>
        <Btn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="荧光笔">🖍</Btn>

        <Sep />

        <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="左对齐">⬪</Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="居中">⬫</Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="右对齐">⬬</Btn>

        <Sep />

        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="无序列表">•</Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="有序列表">1.</Btn>
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="引用">❝</Btn>
        <Btn onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="代码块">{'</>'}</Btn>

        <Sep />

        <Btn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="清除格式">✕</Btn>
      </div>

      <EditorContent
        editor={editor}
        style={{ padding: '10px 12px', minHeight, fontSize: fontSize.md, lineHeight: 1.8, color: text.secondary, background: neutral[0] }}
      />

      <style>{`
        .ProseMirror { outline: none; min-height: ${minHeight}px; }
        .ProseMirror p { margin: 4px 0; }
        .ProseMirror h1 { font-size: 22px; margin: 10px 0 6px; font-weight: 600; color: ${text.primary}; }
        .ProseMirror h2 { font-size: 18px; margin: 8px 0 4px; font-weight: 600; color: ${text.primary}; }
        .ProseMirror h3 { font-size: 16px; margin: 6px 0 4px; font-weight: 600; color: ${text.primary}; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 20px; margin: 4px 0; }
        .ProseMirror li { margin: 2px 0; }
        .ProseMirror pre {
          background: ${neutral[50]}; padding: 8px 12px; border-radius: ${radius.sm}px;
          border: 1px solid ${neutral[200]}; margin: 8px 0; overflow-x: auto;
        }
        .ProseMirror code {
          background: ${neutral[100]}; padding: 1px 4px; border-radius: ${radius.xs}px;
          font-size: 13px; font-family: ${fontFamily.mono}; color: ${brand.secondary};
        }
        .ProseMirror pre code { background: none; padding: 0; }
        .ProseMirror blockquote {
          border-left: 3px solid ${brand.primaryBorder}; padding-left: 12px;
          color: ${text.tertiary}; margin: 8px 0;
        }
        .ProseMirror mark { background: ${semantic.highlight}; padding: 0 2px; border-radius: 2px; }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: ${text.placeholder}; content: attr(data-placeholder);
          float: left; height: 0; pointer-events: none;
        }
      `}</style>
    </div>
  );
}
