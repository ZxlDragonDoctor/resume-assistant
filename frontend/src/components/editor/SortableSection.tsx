import { useState, useEffect, useRef, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Collapse, Input, Button, Switch, Space, Typography, Tooltip } from 'antd';
import { DeleteOutlined, MenuOutlined, PlusOutlined, BulbOutlined } from '@ant-design/icons';
import type { ResumeSection } from '../../types/resume';
import MarkdownEditor from './MarkdownEditor';

const { Text, Title } = Typography;

const SECTION_LABELS: Record<string, string> = {
  summary: '个人总结',
  experience: '工作经历',
  education: '教育背景',
  projects: '项目经历',
  skills: '专业技能',
};

interface Props {
  section: ResumeSection;
  onDelete: () => void;
  onChange: (data: any) => void;
}

function parseData(section: ResumeSection): any {
  if (typeof section.data === 'string') {
    try { return JSON.parse(section.data); } catch { return {}; }
  }
  return section.data || {};
}

export default function SortableSection({ section, onDelete, onChange }: Props) {
  const [localData, setLocalData] = useState<any>(() => parseData(section));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from props when section changes externally
  useEffect(() => {
    setLocalData(parseData(section));
  }, [section.id, section.data]);

  // Debounced save: call onChange after 500ms of inactivity
  const scheduleSave = useCallback((data: any) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(data);
    }, 500);
  }, [onChange]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const updateData = (newData: any) => {
    setLocalData(newData);
    scheduleSave(newData);
  };

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginBottom: 8,
  };

  const data = localData;

  const renderContent = () => {
    switch (section.sectionType) {
      case 'summary':
        return (
          <MarkdownEditor
            value={(data as any).content || ''}
            onChange={(val) => updateData({ ...data, content: val })}
            placeholder="撰写个人总结，支持 Markdown 格式..."
            minRows={4}
            maxRows={12}
          />
        );

      case 'experience': {
        const items = (data as any).items || [];
        return (
          <div>
            {items.map((item: any, idx: number) => (
              <div key={idx} style={{ marginBottom: 12, padding: 8, background: '#f9f9f9', borderRadius: 6 }}>
                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                  <Input placeholder="公司名称" value={item.company || ''}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx] = { ...newItems[idx], company: e.target.value };
                      updateData({ ...data, items: newItems });
                    }} size="small" />
                  <Input placeholder="职位" value={item.position || ''}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx] = { ...newItems[idx], position: e.target.value };
                      updateData({ ...data, items: newItems });
                    }} size="small" />
                  <Space>
                    <Input placeholder="开始日期" value={item.startDate || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], startDate: e.target.value };
                        updateData({ ...data, items: newItems });
                      }} size="small" style={{ width: 110 }} />
                    <Input placeholder="结束日期" value={item.endDate || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], endDate: e.target.value };
                        updateData({ ...data, items: newItems });
                      }} size="small" style={{ width: 110 }} />
                  </Space>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>工作要点（支持 Markdown）</Text>
                    {(item.bullets || ['']).map((bullet: string, bi: number) => (
                      <Space key={bi} style={{ width: '100%', marginTop: 4 }}>
                        <div style={{ flex: 1 }}>
                          <textarea
                            placeholder="描述工作内容，支持 Markdown 格式..."
                            value={bullet}
                            onChange={(e) => {
                              const newBullets = [...(item.bullets || [])];
                              newBullets[bi] = e.target.value;
                              const newItems = [...items];
                              newItems[idx] = { ...newItems[idx], bullets: newBullets };
                              updateData({ ...data, items: newItems });
                            }}
                            style={{
                              width: '100%', minHeight: 44, resize: 'vertical',
                              border: '1px solid #d9d9d9', borderRadius: 4,
                              padding: '4px 8px', fontSize: 13, lineHeight: 1.6,
                              fontFamily: "'SF Mono', Monaco, monospace",
                              outline: 'none', color: '#334155',
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                            onBlur={(e) => e.target.style.borderColor = '#d9d9d9'}
                          />
                        </div>
                        <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => {
                          const newBullets = (item.bullets || []).filter((_: any, i: number) => i !== bi);
                          const newItems = [...items];
                          newItems[idx] = { ...newItems[idx], bullets: newBullets };
                          updateData({ ...data, items: newItems });
                        }} />
                      </Space>
                    ))}
                    <Button type="link" size="small" icon={<PlusOutlined />}
                      onClick={() => {
                        const newBullets = [...(item.bullets || []), ''];
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], bullets: newBullets };
                        updateData({ ...data, items: newItems });
                      }}>
                      添加要点
                    </Button>
                  </div>
                </Space>
              </div>
            ))}
            <Button type="dashed" block size="small" icon={<PlusOutlined />}
              onClick={() => updateData({ ...data, items: [...items, { company: '', position: '', startDate: '', endDate: '', current: false, bullets: [''] }] })}>
              添加工作经历
            </Button>
          </div>
        );
      }

      case 'education': {
        const items = (data as any).items || [];
        return (
          <div>
            {items.map((item: any, idx: number) => (
              <div key={idx} style={{ marginBottom: 8, padding: 8, background: '#f9f9f9', borderRadius: 6 }}>
                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                  <Input placeholder="学校名称" value={item.school || ''}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx] = { ...newItems[idx], school: e.target.value };
                      updateData({ ...data, items: newItems });
                    }} size="small" />
                  <Space>
                    <Input placeholder="学位" value={item.degree || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], degree: e.target.value };
                        updateData({ ...data, items: newItems });
                      }} size="small" style={{ width: 120 }} />
                    <Input placeholder="专业" value={item.major || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], major: e.target.value };
                        updateData({ ...data, items: newItems });
                      }} size="small" style={{ width: 120 }} />
                  </Space>
                  <Space>
                    <Input placeholder="开始" value={item.startDate || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], startDate: e.target.value };
                        updateData({ ...data, items: newItems });
                      }} size="small" style={{ width: 100 }} />
                    <Input placeholder="结束" value={item.endDate || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], endDate: e.target.value };
                        updateData({ ...data, items: newItems });
                      }} size="small" style={{ width: 100 }} />
                  </Space>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />}
                    onClick={() => updateData({ ...data, items: items.filter((_: any, i: number) => i !== idx) })}>
                    删除
                  </Button>
                </Space>
              </div>
            ))}
            <Button type="dashed" block size="small" icon={<PlusOutlined />}
              onClick={() => updateData({ ...data, items: [...items, { school: '', degree: '', major: '', startDate: '', endDate: '' }] })}>
              添加教育经历
            </Button>
          </div>
        );
      }

      case 'skills': {
        const items = (data as any).items || [];
        return (
          <div>
            <Space wrap style={{ marginBottom: 8 }}>
              {items.map((skill: string, idx: number) => (
                <Input key={idx} value={skill} size="small" style={{ width: 100 }}
                  placeholder="技能名称"
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx] = e.target.value;
                    updateData({ ...data, items: newItems });
                  }}
                  suffix={
                    <DeleteOutlined style={{ fontSize: 10, cursor: 'pointer', color: '#999' }}
                      onClick={() => updateData({ ...data, items: items.filter((_: any, i: number) => i !== idx) })} />
                  } />
              ))}
            </Space>
            <Button type="dashed" block size="small" icon={<PlusOutlined />}
              onClick={() => updateData({ ...data, items: [...items, ''] })}>
              添加技能
            </Button>
          </div>
        );
      }

      case 'projects': {
        const items = (data as any).items || [];
        return (
          <div>
            {items.map((item: any, idx: number) => (
              <div key={idx} style={{ marginBottom: 12, padding: 8, background: '#f9f9f9', borderRadius: 6 }}>
                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                  <Input placeholder="项目名称" value={item.name || ''}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx] = { ...newItems[idx], name: e.target.value };
                      updateData({ ...data, items: newItems });
                    }} size="small" />
                  <Space>
                    <Input placeholder="角色" value={item.role || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], role: e.target.value };
                        updateData({ ...data, items: newItems });
                      }} size="small" style={{ width: 120 }} />
                    <Input placeholder="技术栈" value={item.tech || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], tech: e.target.value };
                        updateData({ ...data, items: newItems });
                      }} size="small" style={{ width: 200 }} />
                  </Space>
                  <Space>
                    <Input placeholder="开始日期" value={item.startDate || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], startDate: e.target.value };
                        updateData({ ...data, items: newItems });
                      }} size="small" style={{ width: 110 }} />
                    <Input placeholder="结束日期" value={item.endDate || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], endDate: e.target.value };
                        updateData({ ...data, items: newItems });
                      }} size="small" style={{ width: 110 }} />
                  </Space>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>项目描述（支持 Markdown）</Text>
                    {(item.bullets || ['']).map((bullet: string, bi: number) => (
                      <Space key={bi} style={{ width: '100%', marginTop: 4 }}>
                        <div style={{ flex: 1 }}>
                          <textarea
                            placeholder="描述项目内容、技术亮点，支持 Markdown..."
                            value={bullet}
                            onChange={(e) => {
                              const newBullets = [...(item.bullets || [])];
                              newBullets[bi] = e.target.value;
                              const newItems = [...items];
                              newItems[idx] = { ...newItems[idx], bullets: newBullets };
                              updateData({ ...data, items: newItems });
                            }}
                            style={{
                              width: '100%', minHeight: 44, resize: 'vertical',
                              border: '1px solid #d9d9d9', borderRadius: 4,
                              padding: '4px 8px', fontSize: 13, lineHeight: 1.6,
                              fontFamily: "'SF Mono', Monaco, monospace",
                              outline: 'none', color: '#334155',
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                            onBlur={(e) => e.target.style.borderColor = '#d9d9d9'}
                          />
                        </div>
                        <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => {
                          const newBullets = (item.bullets || []).filter((_: any, i: number) => i !== bi);
                          const newItems = [...items];
                          newItems[idx] = { ...newItems[idx], bullets: newBullets };
                          updateData({ ...data, items: newItems });
                        }} />
                      </Space>
                    ))}
                    <Button type="link" size="small" icon={<PlusOutlined />}
                      onClick={() => {
                        const newBullets = [...(item.bullets || []), ''];
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], bullets: newBullets };
                        updateData({ ...data, items: newItems });
                      }}>
                      添加描述
                    </Button>
                  </div>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />}
                    onClick={() => updateData({ ...data, items: items.filter((_: any, i: number) => i !== idx) })}>
                    删除此项目
                  </Button>
                </Space>
              </div>
            ))}
            <Button type="dashed" block size="small" icon={<PlusOutlined />}
              onClick={() => updateData({ ...data, items: [...items, { name: '', role: '', tech: '', startDate: '', endDate: '', bullets: [''] }] })}>
              添加项目经历
            </Button>
          </div>
        );
      }

      case 'awards':
      case 'certificates': {
        const items = (data as any).items || [];
        return (
          <div>
            {items.map((item: any, idx: number) => (
              <div key={idx} style={{ marginBottom: 8, padding: 8, background: '#f9f9f9', borderRadius: 6 }}>
                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                  <Input placeholder="奖项/证书名称" value={item.title || ''}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx] = { ...newItems[idx], title: e.target.value };
                      updateData({ ...data, items: newItems });
                    }} size="small" />
                  <Space>
                    <Input placeholder="级别（如：国家级）" value={item.level || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], level: e.target.value };
                        updateData({ ...data, items: newItems });
                      }} size="small" style={{ width: 140 }} />
                    <Input placeholder="日期" value={item.date || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], date: e.target.value };
                        updateData({ ...data, items: newItems });
                      }} size="small" style={{ width: 110 }} />
                  </Space>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />}
                    onClick={() => updateData({ ...data, items: items.filter((_: any, i: number) => i !== idx) })}>
                    删除
                  </Button>
                </Space>
              </div>
            ))}
            <Button type="dashed" block size="small" icon={<PlusOutlined />}
              onClick={() => updateData({ ...data, items: [...items, { title: '', level: '', date: '' }] })}>
              添加{section.sectionType === 'awards' ? '获奖' : '证书'}
            </Button>
          </div>
        );
      }

      default:
        return <Text type="secondary">未知章节类型</Text>;
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{
        background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', padding: '8px 12px',
          background: '#fafafa', borderBottom: '1px solid #e8e8e8',
          cursor: 'move',
        }} {...attributes} {...listeners}>
          <MenuOutlined style={{ fontSize: 14, color: '#999', marginRight: 8 }} />
          <Text strong style={{ flex: 1, fontSize: 13 }}>
            {SECTION_LABELS[section.sectionType] || section.sectionType}
          </Text>
          <Tooltip title="删除">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={onDelete} />
          </Tooltip>
        </div>
        <div style={{ padding: 12 }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
