import { SECTION_META } from '../../constants/sections';
import { normalizeSectionData, type ResumeDetail, type ResumeSection } from '../../types/resume';

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => `${JSON.stringify(key)}:${stable(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Compare hidden and visible content without treating regenerated IDs as edits. */
export function summarizeVersionChanges(snapshot: ResumeDetail, current: ResumeDetail): string[] {
  const changes: string[] = [];
  if (snapshot.title !== current.title) changes.push('简历名称不同');
  if (snapshot.targetJob !== current.targetJob || snapshot.targetCompany !== current.targetCompany) changes.push('投递目标不同');
  if (snapshot.templateId !== current.templateId) changes.push('简历模板不同');
  const style = (r: ResumeDetail) => [r.fontFamily, r.fontSize, r.lineSpacing, r.themeColor, normalizeSectionData(r.layoutConfig)];
  if (stable(style(snapshot)) !== stable(style(current))) changes.push('字体与排版不同');
  const ordered = (r: ResumeDetail) => [...r.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const before = ordered(snapshot);
  const after = ordered(current);
  const group = (sections: ResumeSection[]) => {
    const groups = new Map<string, unknown[]>();
    for (const s of sections) {
      const values = groups.get(s.sectionType) ?? [];
      values.push({ data: normalizeSectionData(s.data), visible: s.isVisible, layout: s.layout ?? 'auto' });
      groups.set(s.sectionType, values);
    }
    return groups;
  };
  const oldGroups = group(before);
  const newGroups = group(after);
  for (const type of new Set([...oldGroups.keys(), ...newGroups.keys()])) {
    const name = SECTION_META[type as keyof typeof SECTION_META]?.label ?? type;
    if (!oldGroups.has(type)) changes.push(`当前草稿新增：${name}`);
    else if (!newGroups.has(type)) changes.push(`当前草稿移除：${name}`);
    else if (stable(oldGroups.get(type)) !== stable(newGroups.get(type))) changes.push(`${name}内容、样式或可见性不同`);
  }
  if (stable(before.map(s => s.sectionType)) !== stable(after.map(s => s.sectionType))) changes.push('模块顺序或组成不同');
  return changes;
}
