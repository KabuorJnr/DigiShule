// Regenerate the app-tile PNG set from a full-bleed maskable source so the
// mobile/PWA launcher icon renders as a clean circle once the OS applies its
// mask. Run: node scripts/gen-app-icons.mjs
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Full-bleed: purple fills the whole square (no transparent corners), the cap
// sits inside the central safe zone so a circular OS mask never clips it.
const maskable = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#8b3bff"/><stop offset="1" stop-color="#5b12d6"/>
  </linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(256 268) scale(0.72) translate(-256 -240)">
    <path d="M256 150 L402 205 L256 260 L110 205 Z" fill="#ffffff"/>
    <path d="M200 236 L312 236 L312 280 Q312 316 256 316 Q200 316 200 280 Z" fill="#ffffff" opacity="0.92"/>
    <line x1="402" y1="205" x2="402" y2="300" stroke="#47bfff" stroke-width="11" stroke-linecap="round"/>
    <circle cx="402" cy="314" r="15" fill="#47bfff"/>
    <circle cx="402" cy="205" r="10" fill="#47bfff"/>
  </g>
</svg>`;

const targets = [
  { file: 'pwa-512x512.png', size: 512 },
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'apple-touch-icon.png', size: 180 },
];

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });

for (const { file, size } of targets) {
  const html = `<!doctype html><meta charset=utf-8><style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${maskable}`;
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  const el = await page.$('svg');
  await el.screenshot({ path: join(publicDir, file), omitBackground: true });
  console.log('wrote', file, `(${size}px)`);
}

await browser.close();
console.log('done');
