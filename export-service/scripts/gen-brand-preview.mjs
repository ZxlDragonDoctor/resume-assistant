/**
 * Build a self-contained preview of the raster mascot and generated icon sizes.
 *
 * Run from the repository root:
 *   node export-service/scripts/gen-brand-preview.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '../../frontend/public');
const OUT_FILE = resolve(__dirname, '../../tmp/logo-preview.html');
const pngUrl = (file) => `data:image/png;base64,${readFileSync(join(PUBLIC_DIR, file)).toString('base64')}`;
const logo = pngUrl('logo.png');

const markSizes = [16, 24, 28, 34, 48, 64, 128];
const markCells = markSizes.map((size) => `
  <div class="mark-cell">
  <div class="mark-stage"><img data-mascot width="${size}" height="${size}" alt="" /></div>
    <span class="tag">${size}px</span>
  </div>`).join('');

const tabSamples = [16, 32].map((size) => `
  <div class="tab">
    <span class="tab-dot"></span>
    <img src="${pngUrl(`favicon-${size}.png`)}" width="${size}" height="${size}" alt="" />
    <span class="tab-name">晓龙简历 - 免费在线简历制作</span>
  </div>`).join('');

const appIcons = [
  ['favicon-16.png', 16, '16px favicon'],
  ['favicon-32.png', 32, '32px favicon'],
  ['favicon-48.png', 48, '48px favicon'],
  ['apple-touch-icon.png', 120, '180px · Apple'],
  ['icon-192.png', 96, '192px · PWA'],
  ['icon-512.png', 128, '512px · PWA / maskable'],
].map(([file, displaySize, label]) => `
  <div class="app-icon">
    <img src="${pngUrl(file)}" width="${displaySize}" height="${displaySize}" alt="" />
    <span class="tag">${label}</span>
  </div>`).join('');

const files = [
  ['logo.png', 'Canonical transparent mascot artwork; website logo and Open Graph image'],
  ['favicon-16.png / favicon-32.png / favicon-48.png', 'Browser favicon raster sizes'],
  ['favicon.ico', 'Multi-size browser favicon'],
  ['apple-touch-icon.png', 'Apple home-screen icon'],
  ['icon-192.png / icon-512.png', 'PWA icons; 512px entry supports maskable use'],
];
const fileRows = files.map(([name, purpose]) => `<tr><td><code>${name}</code></td><td>${purpose}</td></tr>`).join('');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>品牌图标预览 · 晓龙简历</title>
<style>
  :root{--brand:#4f46e5;--purple:#7c3aed;--line:#e2e8f0;--ink:#0f172a;--muted:#64748b;--bg:#f8fafc;--tile:#f5f3ff}
  *{box-sizing:border-box}
  body{margin:0;padding:40px 24px 56px;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif}
  .wrap{max-width:1000px;margin:0 auto}
  h1{margin:0 0 6px;font-size:26px;letter-spacing:-.4px}
  h2{margin:0 0 16px;font-size:15px}
  .sub{margin:0;color:var(--muted);font-size:13px}
  section{margin-top:20px;padding:22px;border:1px solid var(--line);border-radius:14px;background:#fff}
  .marks{display:flex;align-items:flex-end;flex-wrap:wrap;gap:20px}
  .mark-cell,.app-icon{display:flex;flex-direction:column;align-items:center;gap:8px}
  .mark-stage{height:110px;min-width:48px;display:flex;align-items:flex-end;justify-content:center}
  .mark-stage img,.tab img,.app-icon img{display:block;object-fit:contain}
  .tag{color:#94a3b8;font-size:11px;font-variant-numeric:tabular-nums;text-align:center}
  .tabstrip{display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap;padding:10px 10px 0;border-radius:10px 10px 0 0;background:#dee1e6}
  .tab{display:flex;align-items:center;gap:8px;max-width:320px;padding:8px 12px 9px;border-radius:8px 8px 0 0;background:#fff;color:#475569;font-size:12px}
  .tab-dot{width:8px;height:8px;border-radius:50%;background:var(--brand)}
  .tab-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .on-brand{display:flex;align-items:center;gap:11px;padding:28px;border-radius:14px;background:linear-gradient(135deg,var(--brand),var(--purple))}
  .contrast-tile{display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(255,255,255,.18)}
  .on-brand strong{color:#fff;font-size:20px}
  .apps{display:flex;align-items:flex-end;flex-wrap:wrap;gap:22px}
  .app-icon img{border-radius:18%}
  .source{display:flex;align-items:center;gap:28px;flex-wrap:wrap}
  .source img{display:block;width:260px;height:260px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:12px}
  .source p{max-width:520px;color:#475569;font-size:13px;line-height:1.7}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
  th{color:#94a3b8;font-size:12px;font-weight:500}
  tr:last-child td{border-bottom:0}
  code{color:var(--brand);font-family:Consolas,monospace;font-size:12px}
  @media(max-width:600px){body{padding:24px 14px}.source img{width:180px;height:180px}}
</style>
</head>
<body data-mascot="${logo}">
<main class="wrap">
  <header><h1>品牌图标预览 · 晓龙简历</h1><p class="sub">毛绒泡泡龙主视觉 · 同一张透明 PNG 派生浏览器与 PWA 图标</p></header>
  <section>
    <h2>站内标识 · 实际渲染尺寸</h2>
    <div class="marks">${markCells}</div>
  </section>
  <section>
    <h2>导航栏浅色背景</h2>
    <div style="display:flex;align-items:center;gap:9px"><img data-mascot width="28" height="28" alt="" /><strong>晓龙简历</strong><span style="margin-left:auto;color:var(--muted);font-size:12px">首页　模板库　我的简历</span></div>
  </section>
  <section>
    <h2>登录页品牌色背景</h2>
    <div class="on-brand"><span class="contrast-tile" style="width:34px;height:34px"><img data-mascot width="34" height="34" alt="" /></span><strong>晓龙简历</strong></div>
  </section>
  <section>
    <h2>浏览器标签页</h2>
    <div class="tabstrip">${tabSamples}</div>
  </section>
  <section>
    <h2>浏览器与安装图标</h2>
    <div class="apps">${appIcons}</div>
  </section>
  <section>
    <h2>主视觉源文件</h2>
    <div class="source"><img data-mascot alt="泡泡龙抱着简历卡片" /><p>这是站内 Logo、Open Graph 图片和浏览器 / PWA 图标的唯一图像来源。衍生图标使用淡紫底色和安全留白，生成脚本不会覆盖此文件。</p></div>
  </section>
  <section>
    <h2>文件清单</h2>
    <table><thead><tr><th>文件</th><th>用途</th></tr></thead><tbody>${fileRows}</tbody></table>
  </section>
</main>
<script>document.querySelectorAll('[data-mascot]').forEach((image) => { image.src = document.body.dataset.mascot; });</script>
</body>
</html>`;

writeFileSync(OUT_FILE, html, 'utf8');
console.log('Brand preview generated: ' + OUT_FILE);
