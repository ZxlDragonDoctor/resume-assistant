/**
 * 品牌 Logo · 泡泡龙
 * ------------------------------------------------------------------
 * 用 SVG 内联绘制，避免依赖图片资源，任意尺寸都清晰。
 * 图形语义：圆角渐变底 + 泡泡龙头，呼应「晓龙」的「龙」。
 *
 * 注意：这里的几何与 public/logo.svg 是同一套，
 * 改动其中一个务必同步另一个，否则站内标与 favicon 会不一致。
 */
import { brand, neutral } from '../../styles/tokens';

interface Props {
  size?: number;
  /** 纯白版：去掉底板整体白色、五官镂空。用于品牌色 / 深色背景 */
  monochrome?: boolean;
}

let idSeq = 0;

export default function Logo({ size = 32, monochrome = false }: Props) {
  // SVG 的 id 必须唯一，否则同页面多个 Logo 会互相覆盖
  const uid = (idSeq += 1);
  const gradientId = `logo-grad-${uid}`;
  const maskId = `logo-mask-${uid}`;

  if (monochrome) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="晓龙简历"
      >
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="40">
          <rect width="40" height="40" fill="#000" />
          <path d="M13.8 14 L10.6 10.4 L16.6 12.2 Z" fill="#fff" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M26.2 14 L29.4 10.4 L23.4 12.2 Z" fill="#fff" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
          <rect x="9.2" y="13" width="21.6" height="17.6" rx="8.8" fill="#fff" />
          <ellipse cx="15.9" cy="21.3" rx="1.75" ry="2.05" fill="#000" />
          <ellipse cx="24.1" cy="21.3" rx="1.75" ry="2.05" fill="#000" />
          <path d="M17.8 25.7 Q20 27.3 22.2 25.7" stroke="#000" strokeWidth="1.1" strokeLinecap="round" fill="none" />
        </mask>
        <rect width="40" height="40" fill={neutral[0]} mask={`url(#${maskId})`} />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="晓龙简历"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor={brand.primary} />
          <stop offset="1" stopColor={brand.secondary} />
        </linearGradient>
      </defs>

      {/* 圆角底板 */}
      <rect width="40" height="40" rx="11" fill={`url(#${gradientId})`} />

      {/* 泡泡 */}
      <circle cx="32.4" cy="12" r="1.9" fill={neutral[0]} fillOpacity="0.42" />
      <circle cx="29.6" cy="7.4" r="1.15" fill={neutral[0]} fillOpacity="0.28" />

      {/* 龙角（先画，根部被龙头盖住） */}
      <path d="M13.8 14 L10.6 10.4 L16.6 12.2 Z" fill={neutral[0]} stroke={neutral[0]} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M26.2 14 L29.4 10.4 L23.4 12.2 Z" fill={neutral[0]} stroke={neutral[0]} strokeWidth="1.7" strokeLinejoin="round" />

      {/* 龙头 */}
      <rect x="9.2" y="13" width="21.6" height="17.6" rx="8.8" fill={neutral[0]} />

      {/* 腮红 */}
      <ellipse cx="13.1" cy="24.4" rx="1.9" ry="1.3" fill={brand.primaryBorder} />
      <ellipse cx="26.9" cy="24.4" rx="1.9" ry="1.3" fill={brand.primaryBorder} />

      {/* 眼睛 */}
      <ellipse cx="15.9" cy="21.3" rx="1.75" ry="2.05" fill={brand.primaryActive} />
      <ellipse cx="24.1" cy="21.3" rx="1.75" ry="2.05" fill={brand.primaryActive} />
      <circle cx="16.5" cy="20.5" r="0.55" fill={neutral[0]} />
      <circle cx="23.5" cy="20.5" r="0.55" fill={neutral[0]} />

      {/* 嘴 */}
      <path d="M17.8 25.7 Q20 27.3 22.2 25.7" stroke={brand.primaryActive} strokeWidth="1.1" strokeLinecap="round" fill="none" />
    </svg>
  );
}
