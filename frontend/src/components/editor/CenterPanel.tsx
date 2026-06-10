import { useState, useRef, useEffect } from 'react';
import { Input, Button, Typography, message, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { resumeApi } from '../../services/api';
import { useResumeStore } from '../../stores/resumeStore';
import SectionContentEditor from './SectionContentEditor';

const { Text } = Typography;

const MODULE_LABELS: Record<string, string> = {
  basic: '基本信息', summary: '个人总结', experience: '实习经历',
  education: '教育经历', projects: '项目经历', skills: '专业技能',
  awards: '荣誉奖项和证书', certificates: '证书',
  custom: '自定义模块',
};

interface Props { sectionId: string | null; onRefresh: () => void; }

export default function CenterPanel({ sectionId, onRefresh }: Props) {
  const currentResume = useResumeStore((s) => s.currentResume);
  const setCurrentResume = useResumeStore((s) => s.setCurrentResume);
  const section = currentResume?.sections.find(s => s.id === sectionId) || null;

  const [moduleName, setModuleName] = useState('');
  const [editingName, setEditingName] = useState(false);

  // Per-module config: split titleColor and textColor
  const defaultConfig = { titleFontSize: 16, contentFontSize: 14, fontSize: 14, titleColor: '#1e293b', textColor: '#334155', lineSpacing: 1.6, markdownMode: true, textAlign: 'left' };
  const [config, setConfig] = useState(defaultConfig);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (section) {
      try {
        const data = typeof section.data === 'string' ? JSON.parse(section.data) : section.data || {};
        const cfg = data._config || {};
        setModuleName(cfg.moduleName || MODULE_LABELS[section.sectionType] || section.sectionType);
        // Backward compat: if old themeColor exists, split into titleColor + textColor
        const merged = { ...defaultConfig, ...cfg,
          titleFontSize: cfg.titleFontSize || (cfg.fontSize ? cfg.fontSize + 2 : defaultConfig.titleFontSize),
          contentFontSize: cfg.contentFontSize || cfg.fontSize || defaultConfig.contentFontSize,
          titleColor: cfg.titleColor || cfg.themeColor || defaultConfig.titleColor,
          textColor: cfg.textColor || cfg.themeColor || defaultConfig.textColor,
        };
        setConfig(merged);
      } catch {}
    }
  }, [section?.id]);

  if (!section) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ccc' }}>
        请在左侧选择一个模块
      </div>
    );
  }

  const updateSectionData = (newData: any) => {
    if (!currentResume || !section) return;
    const sections = currentResume.sections.map(s => {
      if (s.id === section.id) {
        return { ...s, data: (typeof newData === 'string' ? newData : JSON.stringify(newData)) as any };
      }
      return s;
    });
    setCurrentResume({ ...currentResume, sections });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await resumeApi.updateSection(section.id, {
          sectionType: section.sectionType,
          sortOrder: section.sortOrder,
          data: JSON.stringify(newData),
        });
      } catch { message.error('保存失败'); }
    }, 500);
  };

  const updateConfig = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    try {
      const data = typeof section.data === 'string' ? JSON.parse(section.data) : section.data || {};
      updateSectionData({ ...data, _config: newConfig });
    } catch {}
  };

  const handleDelete = async () => {
    try {
      await resumeApi.deleteSection(section.id);
      onRefresh();
      message.success('已删除');
    } catch { message.error('删除失败'); }
  };

  let parsedData: any = {};
  try {
    parsedData = typeof section.data === 'string' ? JSON.parse(section.data) : section.data || {};
  } catch {}
  const { _config, ...contentData } = parsedData;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Module header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #e8e8e8', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          {editingName ? (
            <Input value={moduleName} onChange={(e) => setModuleName(e.target.value)}
              onBlur={() => { setEditingName(false); updateConfig('moduleName', moduleName); }} onPressEnter={() => setEditingName(false)}
              style={{ width: 200, fontSize: 16, fontWeight: 600 }} autoFocus />
          ) : (
            <Text strong style={{ fontSize: 16, cursor: 'pointer', color: '#0f172a' }}
              onClick={() => setEditingName(true)}>
              {moduleName} ✏️
            </Text>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <Popconfirm title="删除此模块？" onConfirm={handleDelete}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </div>
        </div>

        {/* Per-module config bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>标题字号</Text>
            <select value={config.titleFontSize}
              onChange={(e) => updateConfig('titleFontSize', parseInt(e.target.value))}
              style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #d9d9d9', fontSize: 12, outline: 'none' }}>
              {[14, 15, 16, 17, 18, 19, 20].map(v => (<option key={v} value={v}>{v}px</option>))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>正文字号</Text>
            <select value={config.contentFontSize}
              onChange={(e) => updateConfig('contentFontSize', parseInt(e.target.value))}
              style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #d9d9d9', fontSize: 12, outline: 'none' }}>
              {[12, 13, 14, 15, 16, 17, 18].map(v => (<option key={v} value={v}>{v}px</option>))}
            </select>
          </div>

          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={(e) => { const d = e.currentTarget.querySelector('.c-picker'); if (d) (d as HTMLElement).style.display = 'flex'; }}
            onMouseLeave={(e) => { const d = e.currentTarget.querySelector('.c-picker'); if (d) (d as HTMLElement).style.display = 'none'; }}>
            <Text style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>标题色</Text>
            <div style={{ width: 24, height: 20, borderRadius: 4, background: config.titleColor, border: '1px solid #d9d9d9', cursor: 'pointer' }} />
            <div className="c-picker" style={{
              display: 'none', position: 'absolute', top: '100%', left: 0, zIndex: 100,
              background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8,
              padding: 8, width: 224, flexWrap: 'wrap', gap: 4,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            }}>
              {['#1e293b','#334155','#475569','#64748b','#0f172a','#2563eb','#3b82f6','#06b6d4',
                '#059669','#10b981','#84cc16','#eab308','#f59e0b','#f97316','#ef4444','#dc2626',
                '#e11d48','#ec4899','#a855f7','#8b5cf6','#6366f1','#000000','#ffffff','transparent'].map(c => (
                <div key={c} onClick={() => updateConfig('titleColor', c === 'transparent' ? '#1e293b' : c)}
                  style={{ width: 24, height: 24, borderRadius: 4, background: c, cursor: 'pointer',
                    border: c === '#ffffff' || c === 'transparent' ? '1px solid #d9d9d9' : 'none',
                    outline: config.titleColor === c ? '2px solid #2563eb' : 'none',
                    outlineOffset: config.titleColor === c ? 1 : 0,
                  }} />
              ))}
              <div style={{ width: '100%', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>RGB</span>
                <input type="color" value={config.titleColor}
                  onChange={(e) => updateConfig('titleColor', e.target.value)}
                  style={{ width: 32, height: 24, padding: 0, border: '1px solid #d9d9d9', borderRadius: 4, cursor: 'pointer' }} />
              </div>
            </div>
          </div>

          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={(e) => { const d = e.currentTarget.querySelector('.c-picker2'); if (d) (d as HTMLElement).style.display = 'flex'; }}
            onMouseLeave={(e) => { const d = e.currentTarget.querySelector('.c-picker2'); if (d) (d as HTMLElement).style.display = 'none'; }}>
            <Text style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>字体色</Text>
            <div style={{ width: 24, height: 20, borderRadius: 4, background: config.textColor, border: '1px solid #d9d9d9', cursor: 'pointer' }} />
            <div className="c-picker2" style={{
              display: 'none', position: 'absolute', top: '100%', left: 0, zIndex: 100,
              background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8,
              padding: 8, width: 224, flexWrap: 'wrap', gap: 4,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            }}>
              {['#1e293b','#334155','#475569','#64748b','#0f172a','#2563eb','#3b82f6','#06b6d4',
                '#059669','#10b981','#84cc16','#eab308','#f59e0b','#f97316','#ef4444','#dc2626',
                '#e11d48','#ec4899','#a855f7','#8b5cf6','#6366f1','#000000','#ffffff','transparent'].map(c => (
                <div key={c} onClick={() => updateConfig('textColor', c === 'transparent' ? '#334155' : c)}
                  style={{ width: 24, height: 24, borderRadius: 4, background: c, cursor: 'pointer',
                    border: c === '#ffffff' || c === 'transparent' ? '1px solid #d9d9d9' : 'none',
                    outline: config.textColor === c ? '2px solid #2563eb' : 'none',
                    outlineOffset: config.textColor === c ? 1 : 0,
                  }} />
              ))}
              <div style={{ width: '100%', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>RGB</span>
                <input type="color" value={config.textColor}
                  onChange={(e) => updateConfig('textColor', e.target.value)}
                  style={{ width: 32, height: 24, padding: 0, border: '1px solid #d9d9d9', borderRadius: 4, cursor: 'pointer' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>行间距</Text>
            <select value={config.lineSpacing}
              onChange={(e) => updateConfig('lineSpacing', parseFloat(e.target.value))}
              style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #d9d9d9', fontSize: 12, outline: 'none' }}>
              {[1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2].map(v => (<option key={v} value={v}>{v}</option>))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>对齐</Text>
            <select value={config.textAlign || 'left'}
              onChange={(e) => updateConfig('textAlign', e.target.value)}
              style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #d9d9d9', fontSize: 12, outline: 'none' }}>
              <option value="left">居左</option>
              <option value="center">居中</option>
              <option value="right">居右</option>
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: '#64748b' }}>
            <input type="checkbox" checked={config.markdownMode}
              onChange={(e) => updateConfig('markdownMode', e.target.checked)} />
            Markdown
          </label>
        </div>
      </div>

      {/* Content editor */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <SectionContentEditor
          sectionType={section.sectionType}
          data={contentData}
          markdownMode={config.markdownMode}
          onChange={(newContentData) => {
            updateSectionData({ ...parsedData, ...newContentData, _config: { ...config } });
          }}
        />
      </div>
    </div>
  );
}
