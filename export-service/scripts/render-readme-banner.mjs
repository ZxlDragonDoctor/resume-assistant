import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../..');
const svgPath = resolve(repoRoot, 'docs/assets/banner.svg');
const svg = await readFile(svgPath, 'utf8');
const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const variants = [
  { path: resolve(repoRoot, 'docs/assets/banner.png'), width: 1280, height: 420 },
  { path: resolve(repoRoot, 'docs/assets/banner@2x.png'), width: 2560, height: 840 },
];

let browser;
try {
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  for (const variant of variants) {
    const page = await browser.newPage();
    await page.setViewport({ width: variant.width, height: variant.height, deviceScaleFactor: 1 });
    await page.setContent(
      `<html><body style="margin:0;width:${variant.width}px;height:${variant.height}px;overflow:hidden"><img src="${svgDataUrl}" style="display:block;width:${variant.width}px;height:${variant.height}px"></body></html>`,
      { waitUntil: 'load' },
    );
    await page.evaluate(() => document.images[0].decode());
    await mkdir(dirname(variant.path), { recursive: true });
    const png = Buffer.from(await page.screenshot({ path: variant.path, type: 'png' }));
    const actualWidth = png.readUInt32BE(16);
    const actualHeight = png.readUInt32BE(20);
    await page.close();
    if (actualWidth !== variant.width || actualHeight !== variant.height) {
      throw new Error(`${variant.path} is ${actualWidth}×${actualHeight}; expected ${variant.width}×${variant.height}`);
    }
    console.log(`Rendered ${variant.path} (${actualWidth}×${actualHeight})`);
  }
} finally {
  if (browser) await browser.close();
}
