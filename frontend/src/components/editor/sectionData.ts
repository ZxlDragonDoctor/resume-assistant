/**
 * 模块数据操作助手
 * ------------------------------------------------------------------
 * SectionContentEditor 与样式面板都以「不可变更新」的方式修改 data，
 * 但 data 的形状包含 `_config` 与业务字段两部分，逐层展开会很啰嗦。
 * 这里把常见操作收敛成纯函数，避免每个编辑器重复写 spread。
 */
import {
  normalizeSectionData,
  type ResumeItem,
  type SectionConfig,
  type SectionData,
  type SectionType,
  type SkillGroup,
} from '../../types/resume';
import { EMPTY_SECTION_DATA, NEW_ITEM_TEMPLATE } from '../../stores/resumeStore';

/** 读取模块级配置 */
export function readConfig(data: SectionData | undefined): SectionConfig {
  return (normalizeSectionData(data)._config || {}) as SectionConfig;
}

/** 写入模块级配置（保留业务字段与顺序） */
export function writeConfig(data: SectionData | undefined, patch: Partial<SectionConfig>): SectionData {
  const base = normalizeSectionData(data);
  return { ...base, _config: { ...readConfig(data), ...patch } };
}

/** 清空某个配置键（值为 undefined 时删除，避免脏数据） */
export function clearConfigKeys(data: SectionData | undefined, keys: (keyof SectionConfig)[]): SectionData {
  const base = normalizeSectionData(data);
  const cfg: Record<string, unknown> = { ...readConfig(data) };
  keys.forEach((k) => {
    delete cfg[k as string];
  });
  return { ...base, _config: cfg as SectionConfig };
}

/** 读取列表型模块的 items */
export function readItems(data: SectionData | undefined): ResumeItem[] {
  const raw = normalizeSectionData(data).items;
  return Array.isArray(raw) ? (raw as ResumeItem[]) : [];
}

/** 写入 items */
export function writeItems(data: SectionData | undefined, items: ResumeItem[]): SectionData {
  return { ...normalizeSectionData(data), items };
}

/** 局部更新第 index 条 */
export function patchItem(
  data: SectionData | undefined,
  index: number,
  patch: Partial<ResumeItem>
): SectionData {
  const items = readItems(data).map((item, i) => (i === index ? { ...item, ...patch } : item));
  return writeItems(data, items);
}

/** 在末尾追加一条（用 NEW_ITEM_TEMPLATE 的深拷贝） */
export function appendItem(data: SectionData | undefined, type: SectionType): SectionData {
  const template = NEW_ITEM_TEMPLATE[type];
  const fresh: ResumeItem =
    template && typeof template === 'object'
      ? (JSON.parse(JSON.stringify(template)) as ResumeItem)
      : { title: '', bullets: [''] };
  return writeItems(data, [...readItems(data), fresh]);
}

/** 删除第 index 条 */
export function removeItem(data: SectionData | undefined, index: number): SectionData {
  return writeItems(
    data,
    readItems(data).filter((_, i) => i !== index)
  );
}

/** 上/下移动 */
export function moveItem(data: SectionData | undefined, index: number, delta: number): SectionData {
  const items = [...readItems(data)];
  const target = index + delta;
  if (target < 0 || target >= items.length) return normalizeSectionData(data);
  [items[index], items[target]] = [items[target], items[index]];
  return writeItems(data, items);
}

/** 复制第 index 条（插到其后） */
export function duplicateItem(data: SectionData | undefined, index: number): SectionData {
  const items = [...readItems(data)];
  const source = items[index];
  if (!source) return normalizeSectionData(data);
  const copy = JSON.parse(JSON.stringify(source)) as ResumeItem;
  items.splice(index + 1, 0, copy);
  return writeItems(data, items);
}

// ------------------------------------------------------------------
// 要点（bullets）
// ------------------------------------------------------------------

/** 更新某条目的第 bulletIndex 个要点 */
export function patchBullet(
  data: SectionData | undefined,
  itemIndex: number,
  bulletIndex: number,
  value: string
): SectionData {
  const items = readItems(data).map((item, i) => {
    if (i !== itemIndex) return item;
    const bullets = [...(item.bullets || [])];
    bullets[bulletIndex] = value;
    return { ...item, bullets };
  });
  return writeItems(data, items);
}

/** 追加一个要点 */
export function appendBullet(data: SectionData | undefined, itemIndex: number): SectionData {
  const items = readItems(data).map((item, i) =>
    i === itemIndex ? { ...item, bullets: [...(item.bullets || []), ''] } : item
  );
  return writeItems(data, items);
}

/** 删除一个要点（至少保留一条，避免文本框消失） */
export function removeBullet(
  data: SectionData | undefined,
  itemIndex: number,
  bulletIndex: number
): SectionData {
  const items = readItems(data).map((item, i) => {
    if (i !== itemIndex) return item;
    const bullets = (item.bullets || []).filter((_, bi) => bi !== bulletIndex);
    return { ...item, bullets: bullets.length ? bullets : [''] };
  });
  return writeItems(data, items);
}

// ------------------------------------------------------------------
// 技能：字符串标签 ↔ 分组
// ------------------------------------------------------------------

/** items 是否为分组形态 */
export function isGroupedSkills(data: SectionData | undefined): boolean {
  const raw = normalizeSectionData(data).items;
  if (!Array.isArray(raw) || raw.length === 0) return false;
  return raw.some(
    (i) => i && typeof i === 'object' && ((i as SkillGroup).name || (i as SkillGroup).category)
  );
}

/** 转为字符串标签数组 */
export function readSkillTags(data: SectionData | undefined): string[] {
  const raw = normalizeSectionData(data).items;
  if (!Array.isArray(raw)) return [];
  return raw.filter((i) => typeof i === 'string').map((i) => String(i));
}

/** 写出字符串标签数组 */
export function writeSkillTags(data: SectionData | undefined, tags: string[]): SectionData {
  return { ...normalizeSectionData(data), items: tags };
}

/** 切换为分组形态：把已有标签塞进第一个分组 */
export function toGroupedSkills(data: SectionData | undefined): SectionData {
  const tags = readSkillTags(data);
  const groups: SkillGroup[] = [
    { name: '编程语言', items: tags.slice(0, 4) },
    { name: '框架 / 中间件', items: tags.slice(4) },
  ].filter((g) => (g.items || []).length > 0);
  return {
    ...normalizeSectionData(data),
    items: groups.length ? groups : [{ name: '编程语言', items: [] }],
  };
}

/** 读取分组 */
export function readSkillGroups(data: SectionData | undefined): SkillGroup[] {
  const raw = normalizeSectionData(data).items;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i) => i && typeof i === 'object')
    .map((i) => {
      const g = i as SkillGroup;
      return {
        name: g.name || g.category || '',
        items: Array.isArray(g.items)
          ? g.items
          : String(g.value || '')
              .split(/[,，、|]/)
              .map((s) => s.trim())
              .filter(Boolean),
      };
    });
}

/** 写出分组 */
export function writeSkillGroups(data: SectionData | undefined, groups: SkillGroup[]): SectionData {
  return { ...normalizeSectionData(data), items: groups };
}

// ------------------------------------------------------------------
// 基本信息链接
// ------------------------------------------------------------------

export function readLinks(data: SectionData | undefined): { label: string; url: string }[] {
  const raw = normalizeSectionData(data).links;
  if (!Array.isArray(raw)) return [];
  return (raw as { label?: string; url?: string }[]).map((l) => ({
    label: l?.label || '',
    url: l?.url || '',
  }));
}

export function writeLinks(
  data: SectionData | undefined,
  links: { label: string; url: string }[]
): SectionData {
  return { ...normalizeSectionData(data), links };
}

// ------------------------------------------------------------------
// 新建模块
// ------------------------------------------------------------------

/** 取某类型的空数据（深拷贝，避免多个模块共享同一对象） */
export function emptyDataFor(type: SectionType): SectionData {
  const base = EMPTY_SECTION_DATA[type] ?? { content: '', _config: {} };
  return JSON.parse(JSON.stringify(base)) as SectionData;
}

/**
 * 为「列表型模块」预置一条空记录。
 * 新建模块时直接给一条空白记录，用户不用再点一次「添加」。
 */
export function initialDataFor(type: SectionType): SectionData {
  const data = emptyDataFor(type);
  const template = NEW_ITEM_TEMPLATE[type];
  if (typeof template === 'object' && template !== null) {
    return { ...data, items: [JSON.parse(JSON.stringify(template)) as ResumeItem] };
  }
  return data;
}
