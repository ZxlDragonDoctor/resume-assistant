import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Collapse, Input, Button, Switch, Space, Typography, Tooltip } from 'antd';
import { DeleteOutlined, MenuOutlined, PlusOutlined, BulbOutlined } from '@ant-design/icons';
import type { ResumeSection } from '../../types/resume';

const { Text, Title } = Typography;
const { TextArea } = Input;

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
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginBottom: 8,
  };

  const data = parseData(section);

  const renderContent = () => {
    switch (section.sectionType) {
      case 'summary':
        return (
          <TextArea
            rows={4}
            value={(data as any).content || ''}
            onChange={(e) => onChange({ ...data, content: e.target.value })}
            placeholder="撰写个人总结..."
            style={{ marginTop: 8 }}
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
                      onChange({ ...data, items: newItems });
                    }} size="small" />
                  <Input placeholder="职位" value={item.position || ''}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx] = { ...newItems[idx], position: e.target.value };
                      onChange({ ...data, items: newItems });
                    }} size="small" />
                  <Space>
                    <Input placeholder="开始日期" value={item.startDate || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], startDate: e.target.value };
                        onChange({ ...data, items: newItems });
                      }} size="small" style={{ width: 110 }} />
                    <Input placeholder="结束日期" value={item.endDate || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], endDate: e.target.value };
                        onChange({ ...data, items: newItems });
                      }} size="small" style={{ width: 110 }} />
                  </Space>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>工作要点</Text>
                    {(item.bullets || ['']).map((bullet: string, bi: number) => (
                      <Space key={bi} style={{ width: '100%', marginTop: 4 }}>
                        <Input
                          placeholder="描述工作内容"
                          value={bullet}
                          onChange={(e) => {
                            const newBullets = [...(item.bullets || [])];
                            newBullets[bi] = e.target.value;
                            const newItems = [...items];
                            newItems[idx] = { ...newItems[idx], bullets: newBullets };
                            onChange({ ...data, items: newItems });
                          }}
                          size="small"
                        />
                        <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => {
                          const newBullets = (item.bullets || []).filter((_: any, i: number) => i !== bi);
                          const newItems = [...items];
                          newItems[idx] = { ...newItems[idx], bullets: newBullets };
                          onChange({ ...data, items: newItems });
                        }} />
                      </Space>
                    ))}
                    <Button type="link" size="small" icon={<PlusOutlined />}
                      onClick={() => {
                        const newBullets = [...(item.bullets || []), ''];
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], bullets: newBullets };
                        onChange({ ...data, items: newItems });
                      }}>
                      添加要点
                    </Button>
                  </div>
                </Space>
              </div>
            ))}
            <Button type="dashed" block size="small" icon={<PlusOutlined />}
              onClick={() => onChange({ ...data, items: [...items, { company: '', position: '', startDate: '', endDate: '', current: false, bullets: [''] }] })}>
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
                      onChange({ ...data, items: newItems });
                    }} size="small" />
                  <Space>
                    <Input placeholder="学位" value={item.degree || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], degree: e.target.value };
                        onChange({ ...data, items: newItems });
                      }} size="small" style={{ width: 120 }} />
                    <Input placeholder="专业" value={item.major || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], major: e.target.value };
                        onChange({ ...data, items: newItems });
                      }} size="small" style={{ width: 120 }} />
                  </Space>
                  <Space>
                    <Input placeholder="开始" value={item.startDate || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], startDate: e.target.value };
                        onChange({ ...data, items: newItems });
                      }} size="small" style={{ width: 100 }} />
                    <Input placeholder="结束" value={item.endDate || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], endDate: e.target.value };
                        onChange({ ...data, items: newItems });
                      }} size="small" style={{ width: 100 }} />
                  </Space>
                </Space>
              </div>
            ))}
            <Button type="dashed" block size="small" icon={<PlusOutlined />}
              onClick={() => onChange({ ...data, items: [...items, { school: '', degree: '', major: '', startDate: '', endDate: '' }] })}>
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
                    onChange({ ...data, items: newItems });
                  }}
                  suffix={
                    <DeleteOutlined style={{ fontSize: 10, cursor: 'pointer', color: '#999' }}
                      onClick={() => onChange({ ...data, items: items.filter((_: any, i: number) => i !== idx) })} />
                  } />
              ))}
            </Space>
            <Button type="dashed" block size="small" icon={<PlusOutlined />}
              onClick={() => onChange({ ...data, items: [...items, ''] })}>
              添加技能
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
