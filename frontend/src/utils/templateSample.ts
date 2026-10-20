import { normalizeTemplateConfig, type LayoutConfig, type ResumeDetail, type Template, type TemplateSample } from '../types/resume';

const SECTION_TYPES = new Set(['basic', 'summary', 'experience', 'work', 'education', 'projects', 'skills', 'awards', 'certificates', 'custom']);
const ENTRY_STRING_FIELDS = ['title', 'subtitle', 'company', 'school', 'name', 'institution', 'position', 'degree', 'major', 'role', 'department', 'tech', 'level', 'date', 'startDate', 'endDate', 'description', 'link'];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasText = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim());
const stringList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const optionalStrings = (record: Record<string, unknown>, keys: string[]) => keys.every((key) => record[key] === undefined || typeof record[key] === 'string');

function validSectionConfig(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value) || !optionalStrings(value, ['moduleName', 'titleColor', 'textColor'])) return false;
  if (['titleFontSize', 'contentFontSize', 'lineSpacing'].some((key) => value[key] !== undefined && (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || Number(value[key]) <= 0))) return false;
  if (value.textAlign !== undefined && !['left', 'center', 'right'].includes(String(value.textAlign))) return false;
  if (value.titleStyle !== undefined && !['underline', 'bar', 'pill', 'solid', 'plain'].includes(String(value.titleStyle))) return false;
  return ['hideTitle', 'markdownMode'].every((key) => value[key] === undefined || typeof value[key] === 'boolean');
}

function validSectionData(type: string, data: Record<string, unknown>): boolean {
  if (!validSectionConfig(data._config)) return false;
  if (type === 'basic') {
    return hasText(data.name) && hasText(data.jobTitle)
      && optionalStrings(data, ['name', 'jobTitle', 'phone', 'email', 'city', 'website'])
      && (data.links === undefined || (Array.isArray(data.links) && data.links.every((link) => isRecord(link) && typeof link.label === 'string' && typeof link.url === 'string')));
  }
  if (type === 'summary' || type === 'custom') return hasText(data.content);
  if (!Array.isArray(data.items) || !data.items.length) return false;
  if (type === 'skills') {
    return data.items.every((item) => hasText(item) || (isRecord(item)
      && optionalStrings(item, ['name', 'category', 'value'])
      && (hasText(item.name) || hasText(item.category))
      && (stringList(item.items) || (item.items === undefined && hasText(item.value)))));
  }
  return data.items.every((item) => isRecord(item) && optionalStrings(item, ENTRY_STRING_FIELDS)
    && (item.current === undefined || typeof item.current === 'boolean')
    && (item.bullets === undefined || stringList(item.bullets)));
}

/** Reject the whole payload when partial data could differ from creation or crash the renderer. */
export function normalizeTemplateSample(raw: unknown): TemplateSample | null {
  try {
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!isRecord(value) || value.version !== 1 || !isRecord(value.profile)) return null;
    const profile = value.profile;
    if (!['key', 'jobTitle', 'experienceLevel'].every((key) => hasText(profile[key]))
      || !stringList(profile.highlights) || !profile.highlights.length || !profile.highlights.every(hasText)
      || !Number.isInteger(profile.suggestedPages) || Number(profile.suggestedPages) < 1) return null;
    if (!Array.isArray(value.sections) || !value.sections.length || value.sections.length > 30) return null;
    let basicCount = 0;
    const seenOrders = new Set<number>();
    for (const section of value.sections) {
      if (!isRecord(section) || typeof section.sectionType !== 'string' || !SECTION_TYPES.has(section.sectionType)
        || !Number.isInteger(section.sortOrder) || Number(section.sortOrder) < 0 || Number(section.sortOrder) > 2147483647
        || (section.layout !== undefined && !['auto', 'left', 'right', 'single-column'].includes(String(section.layout)))
        || !isRecord(section.data) || !validSectionData(section.sectionType, section.data)) return null;
      if (seenOrders.has(Number(section.sortOrder))) return null;
      seenOrders.add(Number(section.sortOrder));
      if (section.sectionType === 'basic') basicCount += 1;
    }
    if (basicCount !== 1) return null;
    // Return independent JSON objects, never let preview edits mutate the catalog response.
    const sample = JSON.parse(JSON.stringify(value)) as TemplateSample;
    sample.sections.forEach((section) => { section.layout ??= 'auto'; });
    return sample;
  } catch {
    return null;
  }
}

/** Keep defaults in sync with ResumeService.applyTemplateStyle. */
export function templatePreviewLayout(template: Template): LayoutConfig {
  const config = normalizeTemplateConfig(template.config);
  const numeric = (key: keyof LayoutConfig, fallback: number, min: number, max: number) => {
    const value = config[key];
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  };
  return {
    layout: config.layout || 'single-column',
    globalFontFamily: config.fonts?.[0] || 'system-ui',
    globalFontSize: numeric('globalFontSize', 14, 10, 24),
    globalLineSpacing: numeric('globalLineSpacing', 1.6, 1, 3),
    pageTopMargin: numeric('pageTopMargin', 44, 0, 120),
    pageBottomMargin: numeric('pageBottomMargin', 44, 0, 120),
    pageLeftMargin: numeric('pageLeftMargin', 52, 0, 120),
    pageRightMargin: numeric('pageRightMargin', 52, 0, 120),
    moduleMargin: numeric('moduleMargin', 20, 0, 48),
    titleTopPadding: numeric('titleTopPadding', 2, 0, 48),
    titleBottomMargin: numeric('titleBottomMargin', 10, 0, 48),
    headerStyle: config.headerStyle || 'underline',
    themeColor: config.primaryColor || '#2563eb',
  };
}

/** Synthesize local render data only. Opening a preview never creates a persisted resume. */
export function createTemplatePreviewResume(template: Template, normalizedSample?: TemplateSample | null): ResumeDetail | null {
  const sample = normalizedSample === undefined ? normalizeTemplateSample(template.previewConfig) : normalizedSample;
  if (!sample) return null;
  const layout = templatePreviewLayout(template);
  return {
    id: `preview:${template.id}`,
    title: `${template.name}范文`,
    templateId: template.id,
    targetJob: sample.profile.jobTitle,
    fontFamily: layout.globalFontFamily!,
    fontSize: Math.round(layout.globalFontSize!),
    themeColor: layout.themeColor!,
    lineSpacing: layout.globalLineSpacing!,
    layoutConfig: JSON.stringify(layout),
    shareEnabled: false,
    viewCount: 0,
    status: 'draft',
    createdAt: '',
    updatedAt: '',
    sections: [...sample.sections].sort((a, b) => a.sortOrder - b.sortOrder).map((section, index) => ({
      ...section,
      id: `preview:${template.id}:${sample.profile.key}:${section.sortOrder}:${index}`,
      isVisible: true,
      data: JSON.parse(JSON.stringify(section.data)),
    })),
  };
}

export function templateSearchText(template: Template, sample = normalizeTemplateSample(template.previewConfig)): string {
  return [template.name, template.description, template.category, ...(template.tags || []), sample?.profile.jobTitle,
    sample?.profile.experienceLevel, ...(sample?.profile.highlights || [])].filter(Boolean).join(' ').toLowerCase();
}

/** Plain text excerpts only: full rich text is rendered by ResumePreviewEngine in the modal. */
export function sampleExcerpt(value: unknown, maxLength = 180): string {
  if (typeof value !== 'string') return '';
  const text = value.replace(/<[^>]*>/g, ' ').replace(/!?(?:\[([^\]]+)\])\([^)]*\)/g, '$1')
    .replace(/(^|\n)\s*(?:#{1,6}\s*|[-*+]\s+)/g, '$1').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
