/**
 * 品牌资产预览页生成器
 * ------------------------------------------------------------------
 * 把 frontend/public 下的品牌资产读进来（SVG 内联、PNG 转 base64），
 * 生成一个完全自包含的 HTML 预览页，可在真实尺寸下检查可读性。
 *
 * 用法：node scripts/gen-brand-preview.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '../../frontend/public');
const OUT_FILE = resolve(__dirname, '../../tmp/logo-preview.html');

const svgSrc = (f) => readFileSync(join(PUBLIC_DIR, f), 'utf8');
const pngUrl = (f) => 'data:image/png;base64,' + readFileSync(join(PUBLIC_DIR, f)).toString('base64');

/** 设定显示尺寸，并把渐变 id 加后缀，避免同页多次内联时互相覆盖 */
function sized(svg, size, key) {
  return svg
    .replace(/(<svg[^>]*?)\swidth="[^"]*"/, `$1 width="${size}"`)
    .replace(/(<svg[^>]*?)\sheight="[^"]*"/, `$1 height="${size}"`)
    .replace(/xlBrandGrad/g, `xlBrandGrad-${key}`)
    .replace(/xlFaviconGrad/g, `xlFaviconGrad-${key}`);
}

const logoSvg = svgSrc('logo.svg');
const faviconSvg = svgSrc('favicon.svg');

// 主标各尺寸
const SIZES = [16, 24, 32, 48, 64, 128];
const sizeRow = SIZES.map(
  (s, i) => `<div class="cell">
      <div class="stage">${sized(logoSvg, s, `s${i}`)}</div>
      <span class="tag">${s}px</span>
    </div>`
).join('');

// 反白版（去掉底板、整体白色、五官镂空）
const monoMark = (size, key) => `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <mask id="mono-${key}" maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="40">
    <rect width="40" height="40" fill="#000"/>
    <path d="M13.8 14 L10.6 10.4 L16.6 12.2 Z" fill="#fff" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/>
    <path d="M26.2 14 L29.4 10.4 L23.4 12.2 Z" fill="#fff" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/>
    <rect x="9.2" y="13" width="21.6" height="17.6" rx="8.8" fill="#fff"/>
    <ellipse cx="15.9" cy="21.3" rx="1.75" ry="2.05" fill="#000"/>
    <ellipse cx="24.1" cy="21.3" rx="1.75" ry="2.05" fill="#000"/>
    <path d="M17.8 25.7 Q20 27.3 22.2 25.7" stroke="#000" stroke-width="1.1" stroke-linecap="round" fill="none"/>
  </mask>
  <rect width="40" height="40" fill="#FFFFFF" mask="url(#mono-${key})"/>
</svg>`;

const tabs = [16, 32].map((s, i) => `<div class="tab">
    <span class="dot"></span>
    <img src="${pngUrl(`favicon-${s}.png`)}" width="${s}" height="${s}" alt="favicon ${s}" />
    <span class="tabname">晓龙简历 - 免费在线简历制作</span>
  </div>`).join('');

const files = [
  ['logo.svg', '站内品牌标（矢量）', 'AppLayout / Login 使用的图形基准'],
  ['favicon.svg', '浏览器图标（矢量）', '16px 优化版，去掉了泡泡与细节'],
  ['favicon.ico', '传统 favicon', '16 / 32 / 48 三尺寸打包'],
  ['favicon-16/32/48.png', 'favicon 位图', '兜底与第三方平台引用'],
  ['apple-touch-icon.png', 'iOS 主屏图标', '180×180，满幅渐变交给系统遮罩'],
  ['icon-192.png', 'PWA 图标', 'manifest 引用'],
  ['icon-512.png', 'PWA 图标 / 分享大图', 'manifest 引用，兼 maskable'],
  ['logo.png', '泡泡龙吉祥物', '1024×1024 透明底品牌主视觉'],
  ['logo-mascot.svg', '吉祥物矢量源', 'logo.png 的源文件，可无损改色改形'],
];

const fileRows = files
  .map(([n, d, u]) => `<tr><td><code>${n}</code></td><td>${d}</td><td>${u}</td></tr>`)
  .join('');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>品牌资产预览 · 晓龙简历</title>
<link rel="icon" href="${pngUrl('favicon-32.png')}" />
<style>
  :root{
    --brand:#4F46E5; --brand2:#7C3AED; --line:#E2E8F0;
    --ink:#0F172A; --ink2:#475569; --ink3:#94A3B8; --bg:#F8FAFC;
  }
  *{box-sizing:border-box}
  body{
    margin:0; padding:48px 32px 64px; background:var(--bg); color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;
  }
  .wrap{max-width:1040px;margin:0 auto}
  header{margin-bottom:40px}
  h1{font-size:28px;margin:0 0 8px;letter-spacing:-.5px}
  .sub{color:var(--ink2);font-size:14px;margin:0}
  h2{font-size:15px;margin:0 0 16px;color:var(--ink);letter-spacing:-.2px}
  section{background:#fff;border:1px solid var(--line);border-radius:14px;padding:24px;margin-bottom:20px}
  .row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:28px}
  .cell{display:flex;flex-direction:column;align-items:center;gap:10px}
  .stage{display:flex;align-items:flex-end;justify-content:center;height:132px}
  .tag{font-size:11px;color:var(--ink3);font-variant-numeric:tabular-nums}
  .tabstrip{background:#DEE1E6;border-radius:10px 10px 0 0;padding:8px 8px 0;display:inline-flex;gap:6px}
  .tab{
    display:flex;align-items:center;gap:8px;background:#fff;border-radius:8px 8px 0 0;
    padding:8px 14px 9px;font-size:12px;color:var(--ink2);max-width:280px;
  }
  .tabname{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tab img{display:block;flex:none}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--brand);flex:none}
  .onbrand{
    background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);
    border-radius:14px;padding:32px;display:flex;align-items:center;gap:12px;
  }
  .onbrand .name{color:#fff;font-size:20px;font-weight:700;letter-spacing:-.2px}
  .apps{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-end}
  .app{display:flex;flex-direction:column;align-items:center;gap:10px}
  .app img{display:block;border-radius:22%}
  .mascot{display:flex;align-items:center;gap:32px;flex-wrap:wrap}
  .mascot img{display:block;width:300px;height:300px}
  .mascot p{margin:0;color:var(--ink2);font-size:13px;line-height:1.8;max-width:420px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
  th{color:var(--ink3);font-weight:500;font-size:12px}
  td:first-child{white-space:nowrap}
  code{font-family:'JetBrains Mono',Consolas,monospace;font-size:12px;color:var(--brand)}
  tr:last-child td{border-bottom:none}
  .hint{font-size:12px;color:var(--ink3);margin:12px 0 0}
</style>
</head>
<body>
<div class="wrap">

  <header>
    <h1>品牌资产预览 · 晓龙简历</h1>
    <p class="sub">泡泡龙标识 · 矢量标 + 全套图标。颜色取自 <code>styles/tokens.ts</code> 品牌令牌（#4F46E5 → #7C3AED）。</p>
  </header>

  <section>
    <h2>主标 · 各尺寸</h2>
    <div class="row">${sizeRow}</div>
    <p class="hint">小尺寸下已刻意简化：去掉泡泡与腮红，只保留龙角、龙头、眼睛和嘴。</p>
  </section>

  <section>
    <h2>浏览器标签页模拟</h2>
    <div class="tabstrip">${tabs}</div>
  </section>

  <section>
    <h2>反白版 · 用于品牌色背景</h2>
    <div class="onbrand">
      ${monoMark(34, 'demo')}
      <span class="name">晓龙简历</span>
    </div>
    <p class="hint">登录页左侧就是这么用的：去掉底板，整体白色，五官镂空透出背景。</p>
  </section>

  <section>
    <h2>应用图标</h2>
    <div class="apps">
      <div class="app"><img src="${pngUrl('favicon-16.png')}" width="16" height="16" alt="" /><span class="tag">16</span></div>
      <div class="app"><img src="${pngUrl('favicon-32.png')}" width="32" height="32" alt="" /><span class="tag">32</span></div>
      <div class="app"><img src="${pngUrl('favicon-48.png')}" width="48" height="48" alt="" /><span class="tag">48</span></div>
      <div class="app"><img src="${pngUrl('apple-touch-icon.png')}" width="120" height="120" alt="" /><span class="tag">180 · iOS</span></div>
      <div class="app"><img src="${pngUrl('icon-192.png')}" width="96" height="96" alt="" /><span class="tag">192 · PWA</span></div>
      <div class="app"><img src="${pngUrl('icon-512.png')}" width="128" height="128" alt="" /><span class="tag">512 · PWA</span></div>
    </div>
    <p class="hint">系统图标用满幅渐变（无圆角），由 iOS / Android 自行遮罩，避免二次圆角。</p>
  </section>

  <section>
    <h2>吉祥物主视觉</h2>
    <div class="mascot">
      <img src="${pngUrl('logo.png')}" alt="泡泡龙吉祥物" />
      <p>
        泡泡龙手持一份简历，两侧是翅膀，右上飘着泡泡 —— 同时点出「龙」和「简历」两层语义。<br />
        透明底 1024×1024，可直接用于登录页插画、分享封面或空状态图。<br />
        源文件是矢量（<code>logo-mascot.svg</code>），改色改形都不会失真。
      </p>
    </div>
  </section>

  <section>
    <h2>文件清单</h2>
    <table>
      <thead><tr><th>文件</th><th>用途</th><th>说明</th></tr></thead>
      <tbody>${fileRows}</tbody>
    </table>
    <p class="hint">改动矢量源后，跑 <code>node export-service/scripts/gen-brand-icons.mjs</code> 重新生成全套位图。</p>
  </section>

</div>
</body>
</html>`;

writeFileSync(OUT_FILE, html, 'utf8');
console.log('预览页已生成：' + OUT_FILE);
