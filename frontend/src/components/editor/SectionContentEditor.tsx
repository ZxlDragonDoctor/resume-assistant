import { Input, Button, Space, Typography, DatePicker } from 'antd';
import { PlusOutlined, DeleteOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import MarkdownEditor from './MarkdownEditor';
import RichTextEditor from './RichTextEditor';

const { Text } = Typography;

interface Props {
  sectionType: string;
  data: any;
  markdownMode: boolean;
  onChange: (data: any) => void;
}

export default function SectionContentEditor({ sectionType, data, markdownMode, onChange }: Props) {
  // 基本信息
  if (sectionType === 'basic') {
    return (
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <div>
          <Text style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#475569' }}>姓名</Text>
          <Input value={data.name || ''} onChange={(e) => onChange({ ...data, name: e.target.value })}
            placeholder="你的姓名" size="middle" />
        </div>
        <div>
          <Text style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#475569' }}>电话</Text>
          <Input value={data.phone || ''} onChange={(e) => onChange({ ...data, phone: e.target.value })}
            placeholder="手机号码" size="middle" />
        </div>
        <div>
          <Text style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#475569' }}>邮箱</Text>
          <Input value={data.email || ''} onChange={(e) => onChange({ ...data, email: e.target.value })}
            placeholder="电子邮箱" size="middle" />
        </div>
      </Space>
    );
  }

  // 个人总结
  if (sectionType === 'summary') {
    if (markdownMode) {
      return (
        <MarkdownEditor
          value={data.content || ''}
          onChange={(val) => onChange({ ...data, content: val })}
          placeholder="撰写个人总结，支持 Markdown 格式..."
          minRows={8}
          maxRows={30}
        />
      );
    }
    return (
      <RichTextEditor
        value={data.content || ''}
        onChange={(val) => onChange({ ...data, content: val })}
        placeholder="撰写个人总结..."
        minHeight={200}
      />
    );
  }

  // 教育经历
  if (sectionType === 'education') {
    const items = data.items || [];
    return (
      <div>
        {items.map((item: any, idx: number) => (
          <div key={idx} style={{ marginBottom: 16, padding: 12, background: '#f9f9f9', borderRadius: 8, border: '1px solid #e8e8e8' }}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Input placeholder="学校名称" value={item.school || ''}
                onChange={(e) => {
                  const newItems = [...items]; newItems[idx] = { ...newItems[idx], school: e.target.value };
                  onChange({ ...data, items: newItems });
                }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Input placeholder="学位（本科/硕士/博士）" value={item.degree || ''}
                  onChange={(e) => {
                    const newItems = [...items]; newItems[idx] = { ...newItems[idx], degree: e.target.value };
                    onChange({ ...data, items: newItems });
                  }} style={{ flex: 1 }} />
                <Input placeholder="专业" value={item.major || ''}
                  onChange={(e) => {
                    const newItems = [...items]; newItems[idx] = { ...newItems[idx], major: e.target.value };
                    onChange({ ...data, items: newItems });
                  }} style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <DatePicker picker="month" placeholder="开始年月"
                  value={item.startDate ? dayjs(item.startDate) : null}
                  onChange={(_, dateStr) => {
                    const val = Array.isArray(dateStr) ? dateStr[0] : dateStr || '';
                    const newItems = [...items]; newItems[idx] = { ...newItems[idx], startDate: val };
                    onChange({ ...data, items: newItems });
                  }} style={{ width: 130 }} />
                <span style={{ color: '#999' }}>至</span>
                <DatePicker picker="month" placeholder="结束年月"
                  value={item.endDate ? dayjs(item.endDate) : null}
                  onChange={(_, dateStr) => {
                    const val = Array.isArray(dateStr) ? dateStr[0] : dateStr || '';
                    const newItems = [...items]; newItems[idx] = { ...newItems[idx], endDate: val };
                    onChange({ ...data, items: newItems });
                  }} style={{ width: 130 }} />
                <Button type="text" size="small" danger icon={<DeleteOutlined />}
                  onClick={() => onChange({ ...data, items: items.filter((_: any, i: number) => i !== idx) })} />
              </div>
            </Space>
          </div>
        ))}
        <Button type="dashed" block icon={<PlusOutlined />}
          onClick={() => onChange({ ...data, items: [...items, { school: '', degree: '', major: '', startDate: '', endDate: '' }] })}>
          添加教育经历
        </Button>
      </div>
    );
  }

  // 荣誉奖项和证书
  if (sectionType === 'awards' || sectionType === 'certificates') {
    const items = data.items || [];
    return (
      <div>
        {items.map((item: any, idx: number) => (
          <div key={idx} style={{ marginBottom: 12, padding: 12, background: '#f9f9f9', borderRadius: 8, border: '1px solid #e8e8e8' }}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Input placeholder="奖项/证书名称" value={item.title || ''}
                onChange={(e) => {
                  const newItems = [...items]; newItems[idx] = { ...newItems[idx], title: e.target.value };
                  onChange({ ...data, items: newItems });
                }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Input placeholder="级别（如：国家级）" value={item.level || ''}
                  onChange={(e) => {
                    const newItems = [...items]; newItems[idx] = { ...newItems[idx], level: e.target.value };
                    onChange({ ...data, items: newItems });
                  }} style={{ flex: 1 }} />
                <DatePicker picker="month" placeholder="获得时间"
                  value={item.date ? dayjs(item.date) : null}
                  onChange={(_, dateStr) => {
                    const val = Array.isArray(dateStr) ? dateStr[0] : dateStr || '';
                    const newItems = [...items]; newItems[idx] = { ...newItems[idx], date: val };
                    onChange({ ...data, items: newItems });
                  }} style={{ width: 130 }} />
                <Button type="text" size="small" danger icon={<DeleteOutlined />}
                  onClick={() => onChange({ ...data, items: items.filter((_: any, i: number) => i !== idx) })} />
              </div>
            </Space>
          </div>
        ))}
        <Button type="dashed" block icon={<PlusOutlined />}
          onClick={() => onChange({ ...data, items: [...items, { title: '', level: '', date: '' }] })}>
          添加{sectionType === 'awards' ? '获奖' : '证书'}
        </Button>
      </div>
    );
  }

  // 专业技能
  if (sectionType === 'skills') {
    const items = data.items || [];
    return (
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {items.map((skill: string, idx: number) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f9', borderRadius: 6, padding: '2px 4px 2px 10px', border: '1px solid #e2e8f0' }}>
              <Input value={skill} size="small" style={{ width: 90, border: 'none', background: 'transparent' }}
                placeholder="技能" variant="borderless"
                onChange={(e) => {
                  const newItems = [...items]; newItems[idx] = e.target.value;
                  onChange({ ...data, items: newItems });
                }} />
              <DeleteOutlined style={{ fontSize: 11, color: '#999', cursor: 'pointer', padding: 4 }}
                onClick={() => onChange({ ...data, items: items.filter((_: any, i: number) => i !== idx) })} />
            </div>
          ))}
        </div>
        <Button type="dashed" block icon={<PlusOutlined />}
          onClick={() => onChange({ ...data, items: [...items, ''] })}>
          添加技能
        </Button>
      </div>
    );
  }

  // 实习/工作经历
  if (sectionType === 'experience') {
    const items = data.items || [];
    return (
      <div>
        {items.map((item: any, idx: number) => (
          <div key={idx} style={{ marginBottom: 16, padding: 12, background: '#f9f9f9', borderRadius: 8, border: '1px solid #e8e8e8' }}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input placeholder="公司名称" value={item.company || ''}
                  onChange={(e) => {
                    const newItems = [...items]; newItems[idx] = { ...newItems[idx], company: e.target.value };
                    onChange({ ...data, items: newItems });
                  }} style={{ flex: 1 }} />
                <Input placeholder="职位" value={item.position || ''}
                  onChange={(e) => {
                    const newItems = [...items]; newItems[idx] = { ...newItems[idx], position: e.target.value };
                    onChange({ ...data, items: newItems });
                  }} style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <DatePicker picker="month" placeholder="开始时间"
                  value={item.startDate ? dayjs(item.startDate) : null}
                  onChange={(_, dateStr) => {
                    const val = Array.isArray(dateStr) ? dateStr[0] : dateStr || '';
                    const newItems = [...items]; newItems[idx] = { ...newItems[idx], startDate: val };
                    onChange({ ...data, items: newItems });
                  }} style={{ width: 120 }} />
                <span style={{ color: '#999' }}>至</span>
                <DatePicker picker="month" placeholder="结束时间"
                  value={item.endDate ? dayjs(item.endDate) : null}
                  onChange={(_, dateStr) => {
                    const val = Array.isArray(dateStr) ? dateStr[0] : dateStr || '';
                    const newItems = [...items]; newItems[idx] = { ...newItems[idx], endDate: val };
                    onChange({ ...data, items: newItems });
                  }} style={{ width: 120 }} />
                <Button type="text" size="small" danger icon={<DeleteOutlined />}
                  onClick={() => onChange({ ...data, items: items.filter((_: any, i: number) => i !== idx) })} />
              </div>
              <div>
                <Text style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#64748b' }}>
                  工作要点 {markdownMode ? '（支持 Markdown）' : ''}
                </Text>
                {(item.bullets || ['']).map((bullet: string, bi: number) => (
                  <div key={bi} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      {markdownMode ? (
                        <textarea
                          value={bullet}
                          onChange={(e) => {
                            const newBullets = [...(item.bullets || [])];
                            newBullets[bi] = e.target.value;
                            const newItems = [...items];
                            newItems[idx] = { ...newItems[idx], bullets: newBullets };
                            onChange({ ...data, items: newItems });
                          }}
                          placeholder="支持 Markdown 格式..."
                          style={{
                            width: '100%', minHeight: 40, resize: 'vertical',
                            border: '1px solid #d9d9d9', borderRadius: 4,
                            padding: '4px 8px', fontSize: 13, lineHeight: 1.6,
                            fontFamily: "'SF Mono', monospace", outline: 'none',
                          }}
                        />
                      ) : (
                        <textarea
                          placeholder="描述工作内容"
                          value={bullet}
                          onChange={(e) => {
                            const newBullets = [...(item.bullets || [])];
                            newBullets[bi] = e.target.value;
                            const newItems = [...items];
                            newItems[idx] = { ...newItems[idx], bullets: newBullets };
                            onChange({ ...data, items: newItems });
                          }}
                          style={{
                            width: '100%', minHeight: 44, resize: 'vertical',
                            border: '1px solid #d9d9d9', borderRadius: 4,
                            padding: '4px 8px', fontSize: 13, lineHeight: 1.6,
                            fontFamily: 'inherit', outline: 'none', color: '#334155',
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                          onBlur={(e) => e.target.style.borderColor = '#d9d9d9'}
                        />
                      )}
                    </div>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />}
                      onClick={() => {
                        const newBullets = (item.bullets || []).filter((_: any, i: number) => i !== bi);
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], bullets: newBullets };
                        onChange({ ...data, items: newItems });
                      }} />
                  </div>
                ))}
                <Button type="link" size="small" icon={<PlusOutlined />}
                  onClick={() => {
                    const newBullets = [...(item.bullets || []), ''];
                    const newItems = [...items];
                    newItems[idx] = { ...newItems[idx], bullets: newBullets };
                    onChange({ ...data, items: newItems });
                  }}>
                  添加工作要点
                </Button>
              </div>
            </Space>
          </div>
        ))}
        <Button type="dashed" block icon={<PlusOutlined />}
          onClick={() => onChange({ ...data, items: [...items, { company: '', position: '', startDate: '', endDate: '', bullets: [''] }] })}>
          添加实习经历
        </Button>
      </div>
    );
  }

  // 项目经历
  if (sectionType === 'projects') {
    const items = data.items || [];
    return (
      <div>
        {items.map((item: any, idx: number) => (
          <div key={idx} style={{ marginBottom: 16, padding: 12, background: '#f9f9f9', borderRadius: 8, border: '1px solid #e8e8e8' }}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Input placeholder="项目名称" value={item.name || ''}
                onChange={(e) => {
                  const newItems = [...items]; newItems[idx] = { ...newItems[idx], name: e.target.value };
                  onChange({ ...data, items: newItems });
                }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Input placeholder="你的角色" value={item.role || ''}
                  onChange={(e) => {
                    const newItems = [...items]; newItems[idx] = { ...newItems[idx], role: e.target.value };
                    onChange({ ...data, items: newItems });
                  }} style={{ flex: 1 }} />
                <Input placeholder="技术栈" value={item.tech || ''}
                  onChange={(e) => {
                    const newItems = [...items]; newItems[idx] = { ...newItems[idx], tech: e.target.value };
                    onChange({ ...data, items: newItems });
                  }} style={{ flex: 2 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <DatePicker picker="month" placeholder="开始时间"
                  value={item.startDate ? dayjs(item.startDate) : null}
                  onChange={(_, dateStr) => {
                    const val = Array.isArray(dateStr) ? dateStr[0] : dateStr || '';
                    const newItems = [...items]; newItems[idx] = { ...newItems[idx], startDate: val };
                    onChange({ ...data, items: newItems });
                  }} style={{ width: 120 }} />
                <span style={{ color: '#999' }}>至</span>
                <DatePicker picker="month" placeholder="结束时间"
                  value={item.endDate ? dayjs(item.endDate) : null}
                  onChange={(_, dateStr) => {
                    const val = Array.isArray(dateStr) ? dateStr[0] : dateStr || '';
                    const newItems = [...items]; newItems[idx] = { ...newItems[idx], endDate: val };
                    onChange({ ...data, items: newItems });
                  }} style={{ width: 120 }} />
                <Button type="text" size="small" danger icon={<DeleteOutlined />}
                  onClick={() => onChange({ ...data, items: items.filter((_: any, i: number) => i !== idx) })} />
              </div>
              <div>
                <Text style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#64748b' }}>
                  项目描述 {markdownMode ? '（支持 Markdown）' : ''}
                </Text>
                {(item.bullets || ['']).map((bullet: string, bi: number) => (
                  <div key={bi} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      {markdownMode ? (
                        <textarea
                          value={bullet}
                          onChange={(e) => {
                            const newBullets = [...(item.bullets || [])];
                            newBullets[bi] = e.target.value;
                            const newItems = [...items];
                            newItems[idx] = { ...newItems[idx], bullets: newBullets };
                            onChange({ ...data, items: newItems });
                          }}
                          placeholder="支持 Markdown 格式..."
                          style={{
                            width: '100%', minHeight: 40, resize: 'vertical',
                            border: '1px solid #d9d9d9', borderRadius: 4,
                            padding: '4px 8px', fontSize: 13, lineHeight: 1.6,
                            fontFamily: "'SF Mono', monospace", outline: 'none',
                          }}
                        />
                      ) : (
                        <textarea
                          placeholder="描述项目内容"
                          value={bullet}
                          onChange={(e) => {
                            const newBullets = [...(item.bullets || [])];
                            newBullets[bi] = e.target.value;
                            const newItems = [...items];
                            newItems[idx] = { ...newItems[idx], bullets: newBullets };
                            onChange({ ...data, items: newItems });
                          }}
                          style={{
                            width: '100%', minHeight: 44, resize: 'vertical',
                            border: '1px solid #d9d9d9', borderRadius: 4,
                            padding: '4px 8px', fontSize: 13, lineHeight: 1.6,
                            fontFamily: 'inherit', outline: 'none', color: '#334155',
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                          onBlur={(e) => e.target.style.borderColor = '#d9d9d9'}
                        />
                      )}
                    </div>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />}
                      onClick={() => {
                        const newBullets = (item.bullets || []).filter((_: any, i: number) => i !== bi);
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], bullets: newBullets };
                        onChange({ ...data, items: newItems });
                      }} />
                  </div>
                ))}
                <Button type="link" size="small" icon={<PlusOutlined />}
                  onClick={() => {
                    const newBullets = [...(item.bullets || []), ''];
                    const newItems = [...items];
                    newItems[idx] = { ...newItems[idx], bullets: newBullets };
                    onChange({ ...data, items: newItems });
                  }}>
                  添加描述
                </Button>
              </div>
              <Button type="text" size="small" danger icon={<DeleteOutlined />}
                onClick={() => onChange({ ...data, items: items.filter((_: any, i: number) => i !== idx) })}>
                删除此项目
              </Button>
            </Space>
          </div>
        ))}
        <Button type="dashed" block icon={<PlusOutlined />}
          onClick={() => onChange({ ...data, items: [...items, { name: '', role: '', tech: '', startDate: '', endDate: '', bullets: [''] }] })}>
          添加项目经历
        </Button>
      </div>
    );
  }

    // 自定义模块
  if (sectionType === 'custom') {
    if (markdownMode) {
      return (
        <MarkdownEditor
          value={data.content || ''}
          onChange={(val) => onChange({ ...data, content: val })}
          placeholder="输入自定义内容，支持 Markdown 格式..."
          minRows={8}
          maxRows={30}
        />
      );
    }
    return (
      <RichTextEditor
        value={data.content || ''}
        onChange={(val) => onChange({ ...data, content: val })}
        placeholder="输入自定义内容..."
        minHeight={200}
      />
    );
  }

  return <Text type="secondary">暂不支持编辑此模块类型</Text>;
}
