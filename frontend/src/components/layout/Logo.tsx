interface Props {
  size?: number;
  /** Adds contrast when the mascot sits on the login page's brand-colored panel. */
  onBrandBackground?: boolean;
}

export default function Logo({ size = 32, onBrandBackground = false }: Props) {
  return (
    <span
      role="img"
      aria-label="晓龙简历"
      style={{
        width: size,
        height: size,
        flex: '0 0 auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: onBrandBackground ? Math.round(size * 0.24) : 0,
        background: onBrandBackground ? 'rgba(255,255,255,0.18)' : 'transparent',
      }}
    >
      <img
        src="/logo.png"
        alt=""
        width={size}
        height={size}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </span>
  );
}
