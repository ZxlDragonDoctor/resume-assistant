/**
 * 缩略图工具
 * ------------------------------------------------------------------
 * 缩略图不需要真实数据，用简历 id 生成稳定伪随机视觉，
 * 既省一次请求，又让每份简历有辨识度。
 */

/** 由字符串生成 32 位整数种子（djb2 变体） */
export function hashSeed(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0x7fffffff;
  }
  return hash;
}

/** 把十六进制色转为带透明度的 rgba，用于浅色底 */
export function backgroundColorFor(hex: string, alpha: number): string {
  const fallback = `rgba(79, 70, 229, ${alpha})`;
  if (!hex || typeof hex !== 'string') return fallback;

  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return fallback;

  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ------------------------------------------------------------------
// 日期与文本
// ------------------------------------------------------------------

/**
 * 把日期规整成 `YYYY-MM` 或 `YYYY-MM-DD`。
 * 后端与导出服务都接受任意字符串，前端统一约定 `YYYY-MM` 以便排序与对齐。
 */
export function formatMonth(value: string | undefined | null): string {
  if (!value) return '';
  const text = String(value).trim();
  if (!text) return '';
  // 已是 YYYY-MM / YYYY-MM-DD
  const plain = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(text);
  if (plain) return plain[3] ? `${plain[1]}-${plain[2]}-${plain[3]}` : `${plain[1]}-${plain[2]}`;
  // YYYY/MM 或 YYYY.MM
  const slash = /^(\d{4})[/.](\d{1,2})$/.exec(text);
  if (slash) return `${slash[1]}-${slash[2].padStart(2, '0')}`;
  // 中文
  const cn = /^(\d{4})\s*年\s*(\d{1,2})\s*月?$/.exec(text);
  if (cn) return `${cn[1]}-${cn[2].padStart(2, '0')}`;
  // 纯年份
  if (/^\d{4}$/.test(text)) return text;
  return text;
}

/** `YYYY-MM` → Date（用于 antd RangePicker） */
export function toDayDate(value: string | undefined | null): Date | null {
  const normalized = formatMonth(value);
  if (!normalized) return null;
  const parts = normalized.split('-');
  if (parts.length < 2) return null;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 去掉富文本标签，得到用于统计字数 / 送给 AI 的纯文本 */
export function stripHtml(input: string): string {
  return String(input || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 通用的文本块 → 纯文本（Markdown 保留符号，仅做换行规整） */
export function plainText(input: unknown): string {
  const text = String(input ?? '');
  return /<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i.test(text) ? stripHtml(text) : text.trim();
}

// ------------------------------------------------------------------
// 颜色
// ------------------------------------------------------------------

/** 判断深浅：用于自动决定实底标题的文字颜色 */
export function isLightColor(hex: string): boolean {
  if (!hex) return false;
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // 相对亮度（sRGB 近似）
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}
