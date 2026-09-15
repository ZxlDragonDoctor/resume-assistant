/**
 * 品牌图标生成脚本
 * ------------------------------------------------------------------
 * 把 frontend/public 下的矢量源（logo.svg / favicon.svg / logo-mascot.svg）
 * 栅格化成全套位图，并组装多尺寸 favicon.ico。
 *
 * 放在 export-service 下是因为只有这里有现成的 Puppeteer + Chrome，
 * 用浏览器渲染 SVG 能保证与页面里的显示完全一致。
 *
 * 用法：node scripts/gen-brand-icons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '../../frontend/public');

const readSvg = (file) => readFileSync(join(PUBLIC_DIR, file), 'utf8');

/** 把 <svg> 的 width/height 改成目标像素（viewBox 不变，等比缩放） */
function scaleSvg(svg, size) {
  return svg
    .replace(/(<svg[^>]*?)\swidth="[^"]*"/, `$1 width="${size}"`)
    .replace(/(<svg[^>]*?)\sheight="[^"]*"/, `$1 height="${size}"`);
}

/** PWA / apple-touch 图标由系统自行遮罩，所以去掉底板圆角改为满幅 */
function squareTile(svg) {
  return svg.replace(/rx="11"/g, 'rx="0"');
}

async function render(page, svg, size, outFile) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<!DOCTYPE html><html><head><style>
       html,body{margin:0;padding:0;background:transparent}
       svg{display:block}
     </style></head><body>${svg}</body></html>`,
    { waitUntil: 'load' }
  );
  await page.screenshot({ path: join(PUBLIC_DIR, outFile), omitBackground: true });
  return outFile;
}

/** 手工组装 ICO：header + 目录项 + PNG 载荷（Vista+ 与所有现代浏览器均支持） */
function buildIco(entries) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  entries.forEach(({ size, buffer }, i) => {
    const e = 16 * i;
    dir.writeUInt8(size >= 256 ? 0 : size, e + 0);
    dir.writeUInt8(size >= 256 ? 0 : size, e + 1);
    dir.writeUInt8(0, e + 2); // 调色板数
    dir.writeUInt8(0, e + 3); // reserved
    dir.writeUInt16LE(1, e + 4); // planes
    dir.writeUInt16LE(32, e + 6); // 位深
    dir.writeUInt32LE(buffer.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += buffer.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.buffer)]);
}

const main = async () => {
  const faviconSvg = readSvg('favicon.svg');
  const logoSvg = readSvg('logo.svg');
  const mascotSvg = readSvg('logo-mascot.svg');

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const done = [];

  // 1. favicon 各尺寸（保留圆角底板，标签页里更好看）
  const icoEntries = [];
  for (const size of [16, 32, 48]) {
    const file = `favicon-${size}.png`;
    await render(page, scaleSvg(faviconSvg, size), size, file);
    icoEntries.push({ size, buffer: readFileSync(join(PUBLIC_DIR, file)) });
    done.push(file);
  }

  // 2. favicon.ico（16/32/48 三尺寸打包）
  writeFileSync(join(PUBLIC_DIR, 'favicon.ico'), buildIco(icoEntries));
  done.push('favicon.ico');

  // 3. PWA / apple-touch（满幅渐变，交给系统遮罩）
  const squareSvg = squareTile(logoSvg);
  for (const [size, file] of [
    [180, 'apple-touch-icon.png'],
    [192, 'icon-192.png'],
    [512, 'icon-512.png'],
  ]) {
    await render(page, scaleSvg(squareSvg, size), size, file);
    done.push(file);
  }

  // 4. 吉祥物主视觉
  await render(page, scaleSvg(mascotSvg, 1024), 1024, 'logo.png');
  done.push('logo.png');

  await browser.close();
  console.log(`生成完成（${done.length} 个文件）：`);
  done.forEach((f) => console.log('  - ' + f));
};

main().catch((err) => {
  console.error('生成失败：', err);
  process.exit(1);
});
