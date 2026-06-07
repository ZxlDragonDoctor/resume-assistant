import type { ResumeDetail } from '../../types/resume';

interface Props {
  resume: ResumeDetail;
}

const SECTION_LABELS: Record<string, string> = {
  summary: '个人总结',
  experience: '工作经历',
  education: '教育背景',
  projects: '项目经历',
  skills: '专业技能',
};

function parseData(data: any): any {
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return {}; }
  }
  return data || {};
}

const FONT_MAP: Record<string, string> = {
  'system-ui': 'system-ui, -apple-system, sans-serif',
  'serif': 'Georgia, "Times New Roman", serif',
};

export default function ResumePreview({ resume }: Props) {
  const themeColor = resume.themeColor || '#2563eb';
  const fontFamily = FONT_MAP[resume.fontFamily] || resume.fontFamily || 'system-ui, sans-serif';
  const fontSize = resume.fontSize || 14;

  const visibleSections = resume.sections.filter(s => s.isVisible !== false);

  const renderSection = (section: typeof visibleSections[0]) => {
    const data = parseData(section.data);

    switch (section.sectionType) {
      case 'summary':
        return (
          <div style={{ fontSize: fontSize - 1, color: '#475569', lineHeight: 1.7 }}>
            {(data as any).content || '请填写个人总结'}
          </div>
        );

      case 'experience': {
        const items = (data as any).items || [];
        if (items.length === 0) return <span style={{ color: '#ccc' }}>暂无工作经历</span>;
        return items.map((item: any, idx: number) => (
          <div key={idx} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{item.company || '公司名称'}</span>
                {item.position && <span style={{ color: '#64748b', marginLeft: 8, fontSize: fontSize - 1 }}>{item.position}</span>}
              </div>
              <span style={{ fontSize: fontSize - 2, color: '#94a3b8' }}>
                {item.startDate || ''}{item.startDate && item.endDate ? ' - ' : ''}{item.endDate || ''}
              </span>
            </div>
            {(item.bullets || []).length > 0 && (
              <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                {(item.bullets || []).map((b: string, bi: number) => (
                  <li key={bi} style={{ fontSize: fontSize - 1, color: '#475569', marginBottom: 3, lineHeight: 1.6 }}>
                    {b || '请填写工作要点'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ));
      }

      case 'education': {
        const items = (data as any).items || [];
        if (items.length === 0) return <span style={{ color: '#ccc' }}>暂无教育经历</span>;
        return items.map((item: any, idx: number) => (
          <div key={idx} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{item.school || '学校名称'}</span>
                {item.degree && <span style={{ color: '#64748b', marginLeft: 8, fontSize: fontSize - 1 }}>
                  {item.degree}{item.major ? ` · ${item.major}` : ''}
                </span>}
              </div>
              <span style={{ fontSize: fontSize - 2, color: '#94a3b8' }}>
                {item.startDate || ''}{item.startDate && item.endDate ? ' - ' : ''}{item.endDate || ''}
              </span>
            </div>
          </div>
        ));
      }

      case 'skills': {
        const items = (data as any).items || [];
        if (items.length === 0) return <span style={{ color: '#ccc' }}>暂无技能</span>;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {items.map((skill: string, idx: number) => (
              <span key={idx} style={{
                background: '#f1f5f9', color: '#334155', padding: '2px 12px',
                borderRadius: 4, fontSize: fontSize - 1,
              }}>
                {skill || '技能名称'}
              </span>
            ))}
          </div>
        );
      }

      case 'projects': {
        const items = (data as any).items || [];
        if (items.length === 0) return <span style={{ color: '#ccc' }}>暂无项目经历</span>;
        return items.map((item: any, idx: number) => (
          <div key={idx} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{item.name || '项目名称'}</span>
                {item.role && <span style={{ color: '#64748b', marginLeft: 8, fontSize: fontSize - 1 }}>{item.role}</span>}
              </div>
              <span style={{ fontSize: fontSize - 2, color: '#94a3b8' }}>
                {item.startDate || ''}{item.startDate && item.endDate ? ' - ' : ''}{item.endDate || ''}
              </span>
            </div>
            {(item.bullets || []).length > 0 && (
              <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                {(item.bullets || []).map((b: string, bi: number) => (
                  <li key={bi} style={{ fontSize: fontSize - 1, color: '#475569', marginBottom: 3 }}>
                    {b || '请填写项目描述'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ));
      }

      default:
        return <div style={{ color: '#ccc' }}>未知章节类型</div>;
    }
  };

  return (
    <div style={{
      background: '#fff',
      padding: '40px 35px',
      fontFamily,
      fontSize,
      color: '#334155',
      lineHeight: 1.6,
      minHeight: 1100,
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', margin: 0, marginBottom: 4 }}>
          {(resume as any).title || '我的简历'}
        </h1>
        {resume.targetJob && (
          <div style={{ fontSize: fontSize - 1, color: '#64748b' }}>
            目标岗位：{resume.targetJob}
            {resume.targetCompany ? ` · ${resume.targetCompany}` : ''}
          </div>
        )}
      </div>

      {/* Sections */}
      {visibleSections.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#ccc', padding: 60, fontSize: fontSize + 2 }}>
          在左侧添加简历章节开始编辑
        </div>
      ) : (
        visibleSections.map((section) => (
          <div key={section.id} style={{ marginBottom: 22 }}>
            <div style={{
              fontSize: fontSize + 2,
              fontWeight: 600,
              color: '#0f172a',
              borderBottom: `2px solid ${themeColor}`,
              paddingBottom: 4,
              marginBottom: 12,
            }}>
              {SECTION_LABELS[section.sectionType] || section.sectionType}
            </div>
            {renderSection(section)}
          </div>
        ))
      )}
    </div>
  );
}
