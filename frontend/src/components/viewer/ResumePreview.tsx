import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ResumeDetail } from '../../types/resume';

interface Props { resume: ResumeDetail; }

const SECTION_LABELS: Record<string, string> = {
  summary: '个人总结', experience: '实习经历', education: '教育经历',
  projects: '项目经历', skills: '专业技能', awards: '荣誉奖项和证书',
  certificates: '证书',
  custom: '自定义模块', basic: '基本信息',
};

function parseData(data: any): any {
  if (typeof data === 'string') { try { return JSON.parse(data); } catch { return {}; } }
  return data || {};
}

const FONT_MAP: Record<string, string> = {
  'system-ui': 'system-ui, -apple-system, sans-serif',
  'serif': 'Georgia, "Times New Roman", serif',
};

function parseLayout(layoutConfig: string | undefined) {
  if (!layoutConfig) return {};
  try { return JSON.parse(layoutConfig); } catch { return {}; }
}

function isHtml(str: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(str);
}

function MarkdownContent({ content, fontSize, lineSpacing, textColor }: {
  content: string; fontSize: number; lineSpacing: number; textColor?: string;
}) {
  if (!content) return null;
  const color = textColor || '#334155';
  if (isHtml(content)) {
    return <div style={{ fontSize: fontSize - 1, lineHeight: lineSpacing, color }} dangerouslySetInnerHTML={{ __html: content }} />;
  }
  return (
    <div className="resume-markdown" style={{ fontSize: fontSize - 1, lineHeight: lineSpacing, color }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      <style>{`
        .resume-markdown h1,.resume-markdown h2,.resume-markdown h3,.resume-markdown h4,.resume-markdown h5,.resume-markdown h6{
          margin:8px 0 4px;font-weight:600;color:#0f172a;
        }
        .resume-markdown h1{font-size:${fontSize + 4}px}
        .resume-markdown h2{font-size:${fontSize + 2}px}
        .resume-markdown h3{font-size:${fontSize}px}
        .resume-markdown p{margin:3px 0}
        .resume-markdown ul,.resume-markdown ol{padding-left:18px;margin:3px 0}
        .resume-markdown li{margin:1px 0}
        .resume-markdown code{background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:${fontSize - 2}px;color:#e11d48}
        .resume-markdown pre{background:#f8fafc;padding:8px 12px;border-radius:4px;overflow-x:auto;border:1px solid #e2e8f0;margin:6px 0}
        .resume-markdown pre code{background:none;padding:0;color:#334155}
        .resume-markdown blockquote{border-left:3px solid #2563eb;padding-left:10px;color:#64748b;margin:6px 0}
        .resume-markdown strong{font-weight:600;color:#0f172a}
        .resume-markdown a{color:#2563eb;text-decoration:none}
        .resume-markdown hr{border:none;border-top:1px solid #e2e8f0;margin:8px 0}
      `}</style>
    </div>
  );
}

export default function ResumePreview({ resume }: Props) {
  const layout = parseLayout(resume.layoutConfig);
  const globalTitleColor = layout.globalTitleColor || resume.themeColor || '#1e293b';
  const globalTextColor = '#334155';
  const layFont = layout.globalFontFamily || resume.fontFamily || 'system-ui';
  const globalFontFamily = FONT_MAP[layFont] || layFont;
  const globalContentFontSize = layout.globalFontSize || resume.fontSize || 14;
  const globalLineSpacing = layout.globalLineSpacing || resume.lineSpacing || 1.6;
  const pageTop = layout.pageTopMargin ?? 40;
  const pageLeft = layout.pageLeftMargin ?? 35;
  const pageRight = layout.pageRightMargin ?? 35;
  const moduleMargin = layout.moduleMargin ?? 22;
  const titleBottom = layout.titleBottomMargin ?? 12;
  const titleTop = layout.titleTopPadding ?? 4;

  const visibleSections = resume.sections.filter(s => s.isVisible !== false);
  const basicSection = visibleSections.find(s => s.sectionType === 'basic');

  const renderSection = (section: typeof visibleSections[0]) => {
    const data = parseData(section.data);
    const sc = data._config || {};
    const contentFs = sc.contentFontSize || sc.fontSize || globalContentFontSize;
    const titleFs = sc.titleFontSize || (sc.fontSize ? sc.fontSize + 2 : globalContentFontSize + 2);
    const lineSpacing = sc.lineSpacing || globalLineSpacing;
    const textColor = sc.textColor || globalTextColor;
    const titleColor = sc.titleColor || sc.themeColor || globalTitleColor;

    switch (section.sectionType) {
      case 'basic':
        return (
          <div style={{ textAlign: sc.textAlign || 'center', marginBottom: 20, color: textColor }}>
            {data.name && <div style={{ fontSize: titleFs + 10, fontWeight: 700, margin: 0, marginBottom: 6, color: titleColor }}>{data.name}</div>}
            <div style={{ display: 'flex', justifyContent: sc.textAlign === 'left' ? 'flex-start' : 'center', gap: 16, flexWrap: 'wrap', fontSize: contentFs - 1, opacity: 0.7 }}>
              {data.phone && <span>📞 {data.phone}</span>}
              {data.email && <span>✉️ {data.email}</span>}
            </div>
          </div>
        );

      case 'summary':
        return <MarkdownContent content={data.content || ''} fontSize={contentFs} lineSpacing={lineSpacing} textColor={textColor} />;

      case 'experience': {
        const items = data.items || [];
        if (items.length === 0) return <span style={{ color: '#ccc', fontSize: contentFs }}>暂无</span>;
        return items.map((item: any, idx: number) => (
          <div key={idx} style={{ marginBottom: 16, fontSize: contentFs, lineHeight: lineSpacing, color: textColor }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <span style={{ fontWeight: 600, color: titleColor, fontSize: titleFs }}>{item.company || '公司名称'}</span>
                {item.position && <span style={{ marginLeft: 8, fontSize: contentFs - 1, opacity: 0.7 }}>{item.position}</span>}
              </div>
              <span style={{ fontSize: contentFs - 2, opacity: 0.5 }}>{item.startDate || ''}{item.startDate && item.endDate ? ' - ' : ''}{item.endDate || ''}</span>
            </div>
            {(item.bullets || []).length > 0 && item.bullets.map((b: string, bi: number) => (
              <div key={bi} style={{ marginBottom: 2 }}>
                <MarkdownContent content={b} fontSize={contentFs} lineSpacing={lineSpacing} textColor={textColor} />
              </div>
            ))}
          </div>
        ));
      }

      case 'education': {
        const items = data.items || [];
        if (items.length === 0) return <span style={{ color: '#ccc', fontSize: contentFs }}>暂无</span>;
        return items.map((item: any, idx: number) => (
          <div key={idx} style={{ marginBottom: 12, fontSize: contentFs, lineHeight: lineSpacing, color: textColor }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <span style={{ fontWeight: 600, color: titleColor, fontSize: titleFs }}>{item.school || '学校名称'}</span>
                {item.degree && <span style={{ marginLeft: 8, fontSize: contentFs - 1, opacity: 0.7 }}>
                  {item.degree}{item.major ? ` · ${item.major}` : ''}
                </span>}
              </div>
              <span style={{ fontSize: contentFs - 2, opacity: 0.5 }}>{item.startDate || ''}{item.startDate && item.endDate ? ' - ' : ''}{item.endDate || ''}</span>
            </div>
          </div>
        ));
      }

      case 'skills': {
        const items = data.items || [];
        if (items.length === 0) return <span style={{ color: '#ccc', fontSize: contentFs }}>暂无</span>;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {items.map((skill: string, idx: number) => (
              <span key={idx} style={{ background: '#f1f5f9', color: textColor, padding: '2px 12px', borderRadius: 4, fontSize: contentFs - 1 }}>
                {skill || '技能名称'}
              </span>
            ))}
          </div>
        );
      }

      case 'projects': {
        const items = data.items || [];
        if (items.length === 0) return <span style={{ color: '#ccc', fontSize: contentFs }}>暂无</span>;
        return items.map((item: any, idx: number) => (
          <div key={idx} style={{ marginBottom: 16, fontSize: contentFs, lineHeight: lineSpacing, color: textColor }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <span style={{ fontWeight: 600, color: titleColor, fontSize: titleFs }}>{item.name || '项目名称'}</span>
                {item.role && <span style={{ marginLeft: 8, fontSize: contentFs - 1, opacity: 0.7 }}>{item.role}</span>}
              </div>
              <span style={{ fontSize: contentFs - 2, opacity: 0.5 }}>{item.startDate || ''}{item.startDate && item.endDate ? ' - ' : ''}{item.endDate || ''}</span>
            </div>
            {item.tech && <div style={{ fontSize: contentFs - 2, color: titleColor, marginTop: 2, fontWeight: 500 }}>技术栈：{item.tech}</div>}
            {(item.bullets || []).length > 0 && item.bullets.map((b: string, bi: number) => (
              <div key={bi} style={{ marginBottom: 2 }}>
                <MarkdownContent content={b} fontSize={contentFs} lineSpacing={lineSpacing} textColor={textColor} />
              </div>
            ))}
          </div>
        ));
      }

      case 'awards':
      case 'certificates': {
        const items = data.items || [];
        if (items.length === 0) return <span style={{ color: '#ccc', fontSize: contentFs }}>暂无</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: contentFs, lineHeight: lineSpacing, color: textColor }}>
            {items.map((item: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: contentFs - 1 }}>
                <span style={{ fontWeight: 500, color: titleColor }}>{item.title || '奖项名称'}</span>
                {item.level && <span style={{ color: titleColor, fontSize: contentFs - 2, opacity: 0.7 }}>{item.level}</span>}
                {item.date && <span style={{ fontSize: contentFs - 2, opacity: 0.5, marginLeft: 'auto' }}>{item.date}</span>}
              </div>
            ))}
          </div>
        );
      }

            case 'custom':
        return <MarkdownContent content={data.content || ''} fontSize={contentFs} lineSpacing={lineSpacing} textColor={textColor} />;

      default:
        return <div style={{ color: '#ccc', fontSize: contentFs }}>未知章节类型</div>;
    }
  };

  return (
    <div style={{ width: 794, background: '#fff', padding: `${pageTop}px ${pageRight}px ${pageTop}px ${pageLeft}px`, fontFamily: globalFontFamily, fontSize: globalContentFontSize, lineHeight: globalLineSpacing, color: '#334155', minHeight: 1100, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      {!basicSection && (
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: globalTitleColor, margin: 0, marginBottom: 4 }}>{resume.title || '我的简历'}</h1>
          {resume.targetJob && <div style={{ fontSize: globalContentFontSize - 1, color: '#64748b' }}>目标岗位：{resume.targetJob}{resume.targetCompany ? ` · ${resume.targetCompany}` : ''}</div>}
        </div>
      )}

      {visibleSections.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#ccc', padding: 60, fontSize: globalContentFontSize + 2 }}>在左侧添加简历模块开始编辑</div>
      ) : (
        visibleSections.map((section) => {
          if (section.sectionType === 'basic') return <div key={section.id}>{renderSection(section)}</div>;
          const data = parseData(section.data);
          const sc = data._config || {};
          const secTitleColor = sc.titleColor || sc.themeColor || globalTitleColor;
          const secTitleFs = sc.titleFontSize || (sc.fontSize ? sc.fontSize + 2 : globalContentFontSize + 2);
          const secContentFs = sc.contentFontSize || sc.fontSize || globalContentFontSize;
          return (
            <div key={section.id} style={{ marginBottom: moduleMargin, fontSize: secContentFs, lineHeight: sc.lineSpacing || globalLineSpacing }}>
              <div style={{ fontSize: secTitleFs, fontWeight: 600, color: secTitleColor, borderBottom: `2px solid ${secTitleColor}`, paddingTop: titleTop, paddingBottom: 4, marginBottom: titleBottom }}>
                {sc.moduleName || SECTION_LABELS[section.sectionType] || section.sectionType}
              </div>
              {renderSection(section)}
            </div>
          );
        })
      )}
    </div>
  );
}
