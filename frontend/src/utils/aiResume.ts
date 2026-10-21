import { normalizeSectionData, type ResumeDetail, type ResumeSection, type SectionData } from '../types/resume';
import { SECTION_META } from '../constants/sections';
import { plainText } from './thumbnail';

export interface AiBulletTarget {
  id: string;
  sectionId: string;
  itemIndex: number;
  bulletIndex: number;
  before: string;
  label: string;
}
export interface AiBulletChange extends AiBulletTarget { after: string }

const text = (value: unknown): string => typeof value === 'string' || typeof value === 'number' ? plainText(value) : '';
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const visible = (resume: ResumeDetail | null) => [...(resume?.sections || [])].filter(s => s.isVisible !== false).sort((a, b) => a.sortOrder - b.sortOrder);
const caption = (section: ResumeSection) => text(normalizeSectionData(section.data)._config?.moduleName) || SECTION_META[section.sectionType]?.label || '补充经历';

/** Prefer explicit resume intent, then the occupation actually entered in basic information. */
export function resolveTargetJob(resume: ResumeDetail | null): string {
  if (!resume) return '';
  return text(resume.targetJob) || text(normalizeSectionData(resume.sections.find(s => s.sectionType === 'basic')?.data).jobTitle);
}

function sectionLines(section: ResumeSection): string[] {
  const data = normalizeSectionData(section.data);
  if (section.sectionType === 'basic') {
    // Contact fields do not help analyse a candidate's experience.
    return [text(data.jobTitle)].filter(Boolean);
  }
  const lines = [text(data.content)].filter(Boolean);
  for (const item of Array.isArray(data.items) ? data.items : []) {
    if (typeof item === 'string') { if (text(item)) lines.push(`- ${text(item)}`); continue; }
    if (!record(item)) continue;
    const heading = ['company', 'school', 'name', 'title', 'institution', 'position', 'role', 'department', 'degree', 'major', 'level', 'tech', 'category', 'value']
      .map(key => text(item[key])).filter(Boolean).join(' · ');
    const dates = [text(item.startDate), item.current ? '至今' : text(item.endDate), text(item.date)].filter(Boolean).join(' - ');
    if (heading || dates) lines.push(`- ${heading}${dates ? ` (${dates})` : ''}`);
    for (const line of [...(Array.isArray(item.items) ? item.items : []), ...(Array.isArray(item.bullets) ? item.bullets : [])]) {
      if (text(line)) lines.push(`  - ${text(line)}`);
    }
    if (text(item.description)) lines.push(`  ${text(item.description)}`);
  }
  for (const link of Array.isArray(data.links) ? data.links : []) {
    if (record(link) && text(link.label)) lines.push(`链接：${text(link.label)}`);
  }
  return lines;
}

export function resumeToPlainText(resume: ResumeDetail | null): string {
  return visible(resume).flatMap(section => {
    const lines = sectionLines(section);
    return lines.length ? [`## ${caption(section)}`, ...lines] : [];
  }).join('\n');
}

export function hasResumeContent(resume: ResumeDetail | null): boolean {
  return visible(resume).some(section => section.sectionType !== 'basic' && sectionLines(section).length > 0);
}

export function collectBulletTargets(resume: ResumeDetail | null): AiBulletTarget[] {
  return visible(resume).filter(section => ['experience', 'work', 'projects'].includes(section.sectionType)).flatMap(section => {
    const data = normalizeSectionData(section.data);
    return (Array.isArray(data.items) ? data.items : []).flatMap((item: unknown, itemIndex: number) => {
      if (!record(item) || !Array.isArray(item.bullets)) return [];
      const name = text(item.company) || text(item.name) || `第 ${itemIndex + 1} 段经历`;
      return item.bullets.flatMap((bullet: unknown, bulletIndex: number) => {
        const before = text(bullet);
        return before ? [{ id: `${section.id}:${itemIndex}:${bulletIndex}`, sectionId: section.id, itemIndex, bulletIndex, before, label: `${caption(section)} · ${name}` }] : [];
      });
    });
  });
}

/** Validate the complete selection first, then build one immutable section write. */
export function planBulletChanges(resume: ResumeDetail | null, changes: AiBulletChange[]): { sectionId: string; data: SectionData; beforeData: SectionData }[] {
  if (!resume || !changes.length) throw new Error('请选择需要应用的建议');
  if (new Set(changes.map(change => change.sectionId)).size !== 1) throw new Error('每次只能应用同一个模块的建议');
  const section = resume.sections.find(s => s.id === changes[0].sectionId && s.isVisible !== false);
  if (!section) throw new Error('原模块不存在或建议已过期，请重新优化');
  const targets = new Map(collectBulletTargets(resume).map(target => [target.id, target]));
  const selected = new Set<string>();
  for (const change of changes) {
    if (selected.has(change.id)) throw new Error('建议存在重复选择');
    selected.add(change.id);
    const target = targets.get(change.id);
    if (!target || target.sectionId !== change.sectionId || target.itemIndex !== change.itemIndex || target.bulletIndex !== change.bulletIndex || target.before !== change.before) {
      throw new Error('原文已修改或建议已过期，请重新优化后再应用');
    }
    if (!text(change.after)) throw new Error('优化结果为空，无法应用');
  }
  const beforeData = normalizeSectionData(section.data);
  const next = JSON.parse(JSON.stringify(beforeData)) as SectionData;
  const items = next.items as { bullets: string[] }[];
  for (const change of changes) items[change.itemIndex].bullets[change.bulletIndex] = text(change.after);
  return [{ sectionId: section.id, data: next, beforeData }];
}
