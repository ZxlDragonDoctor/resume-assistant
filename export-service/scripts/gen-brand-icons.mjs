/**
 * Generate browser and installed-app icon assets from the canonical mascot PNG.
 *
 * The source image is frontend/public/logo.png. This script writes only derived
 * icons and intentionally never rewrites the source file.
 *
 * Run from the repository root:
 *   node export-service/scripts/gen-brand-icons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '../../frontend/public');
const SOURCE_FILE = join(PUBLIC_DIR, 'logo.png');
const MASCOT_DATA_URL = `data:image/png;base64,${readFileSync(SOURCE_FILE).toString('base64')}`;
const TILE_COLOR = '#F5F3FF';

async function renderIcon(page, size, outFile, { cornerRadius = 0, padding = 0.12 } = {}) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>
       html,body{width:100%;height:100%;margin:0;padding:0;background:transparent}
       .tile{box-sizing:border-box;width:100%;height:100%;display:flex;align-items:center;
         justify-content:center;overflow:hidden;background:${TILE_COLOR};
         border-radius:${cornerRadius}%}
       img{display:block;width:${100 - padding * 2}%;height:${100 - padding * 2}%;object-fit:contain}
     </style></head><body><div class="tile"><img src="${MASCOT_DATA_URL}" alt=""></div></body></html>`,
    { waitUntil: 'load' }
  );
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
  await page.screenshot({ path: join(PUBLIC_DIR, outFile), omitBackground: true });
  return outFile;
}

/** Assemble a multi-size ICO from PNG payloads. */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = 6 + directory.length;
  entries.forEach(({ size, buffer }, index) => {
    const entry = 16 * index;
    directory.writeUInt8(size >= 256 ? 0 : size, entry);
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    directory.writeUInt8(0, entry + 2);
    directory.writeUInt8(0, entry + 3);
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(buffer.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += buffer.length;
  });

  return Buffer.concat([header, directory, ...entries.map(({ buffer }) => buffer)]);
}

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const generated = [];
  const icoEntries = [];

  try {
    for (const size of [16, 32, 48]) {
      const file = `favicon-${size}.png`;
      await renderIcon(page, size, file, { cornerRadius: 24, padding: 4 });
      icoEntries.push({ size, buffer: readFileSync(join(PUBLIC_DIR, file)) });
      generated.push(file);
    }

    writeFileSync(join(PUBLIC_DIR, 'favicon.ico'), buildIco(icoEntries));
    generated.push('favicon.ico');

    for (const [size, file, padding] of [
      [180, 'apple-touch-icon.png', 12],
      [192, 'icon-192.png', 12],
      // Keep every mascot detail within Android's 80%-diameter maskable safe zone.
      [512, 'icon-512.png', 22],
    ]) {
      await renderIcon(page, size, file, { padding });
      generated.push(file);
    }
  } finally {
    await browser.close();
  }

  console.log(`Generated ${generated.length} derived brand icons from logo.png:`);
  generated.forEach((file) => console.log(`  - ${file}`));
}

main().catch((error) => {
  console.error('Brand icon generation failed:', error);
  process.exit(1);
});
