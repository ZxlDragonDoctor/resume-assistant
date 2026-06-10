import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const Btn = ({ onClick, active, children, title, style }: {
  onClick: () => void; active?: boolean; children: React.ReactNode; title?: string; style?: React.CSSProperties;
}) => (
  <button type="button" onClick={onClick} title={title}
    style={{
      padding: '3px 8px', border: '1px solid transparent', borderRadius: 4, cursor: 'pointer',
      background: active ? '#e0e7ff' : 'transparent', color: active ? '#2563eb' : '#475569',
      fontSize: 13, fontWeight: active ? 600 : 400, lineHeight: 1, ...style,
    }}
    onMouseEnter={(e) => { if (!active) (e.target as HTMLElement).style.background = '#f1f5f9'; }}
    onMouseLeave={(e) => { if (!active) (e.target as HTMLElement).style.background = 'transparent'; }}
  >
    {children}
  </button>
);

const Sep = () => <span style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 4px', display: 'inline-block' }} />;

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
    <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2,
        padding: '6px 8px', borderBottom: '1px solid #e8e8e8', background: '#fafafa',
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
          style={{ padding: '2px 4px', borderRadius: 4, border: '1px solid #d9d9d9', fontSize: 12, outline: 'none' }}
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

      <EditorContent editor={editor} style={{ padding: '8px 12px', minHeight, fontSize: 14, lineHeight: 1.8 }} />

      <style>{`
        .ProseMirror { outline: none; min-height: ${minHeight}px; }
        .ProseMirror p { margin: 4px 0; }
        .ProseMirror h1 { font-size: 22px; margin: 10px 0 6px; font-weight: 600; }
        .ProseMirror h2 { font-size: 18px; margin: 8px 0 4px; font-weight: 600; }
        .ProseMirror h3 { font-size: 16px; margin: 6px 0 4px; font-weight: 600; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 20px; margin: 4px 0; }
        .ProseMirror li { margin: 2px 0; }
        .ProseMirror pre { background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin: 8px 0; overflow-x: auto; }
        .ProseMirror code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 13px; color: #e11d48; }
        .ProseMirror blockquote { border-left: 3px solid #2563eb; padding-left: 12px; color: #64748b; margin: 8px 0; }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #adb5bd; content: attr(data-placeholder); float: left; height: 0; pointer-events: none;
        }
      `}</style>
    </div>
  );
}
