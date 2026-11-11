#!/usr/bin/env node
/**
 * US-122 → US-127 · The app icon, drawn by the real Flick (components/onboarding/Mascot, waving) so it always matches
 * the app: the dev server's /flick-lab?solo=1 draws him, this script copies his SVG into scripts/icon/{icon,fg}.html
 * (the peach sunburst / a transparent square) and renders: icon.png (iOS, 1024, opaque), the Android adaptive
 * foreground / background / monochrome (his silhouette, eyes cut out) layers, and the web favicon.
 *   E2E_BASE_URL=http://localhost:8082 E2E_CHROME=/usr/bin/google-chrome node scripts/render-icon.mjs
 * (the web dev server running; Python Pillow for the resizes).
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.E2E_BASE_URL || 'http://localhost:8081';
const tmp = mkdtempSync(join(tmpdir(), 'flick-icon-'));
const b = await chromium.launch({ executablePath: process.env.E2E_CHROME || undefined });
const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });

// 1 · Flick, from the app itself
await p.goto(`${BASE}/flick-lab?solo=1`);
const svg = await p.getByLabel('solo Flick').locator('svg').first().evaluate((e) => e.outerHTML, null, { timeout: 120000 });
/** Flick's 120 box placed at (x, y), `w` wide, inside a 1024 square. */
const place = (x, y, w) => svg.replace(/^<svg([^>]*?)\swidth="[^"]*"([^>]*?)\sheight="[^"]*"/, `<svg$1$2 x="${x}" y="${y}" width="${w}" height="${w}"`);
const FLICK = { icon: place(-17, 51, 1057), fg: place(183, 162, 657) };

// 2 · into the templates, rendered
for (const n of ['icon', 'fg', 'bg']) {
  const html = readFileSync(join(ROOT, 'scripts/icon', n + '.html'), 'utf8').replace('<!--FLICK-->', FLICK[n] ?? '');
  writeFileSync(join(tmp, n + '.html'), html);
  await p.goto(`file://${join(tmp, n + '.html')}`);
  await p.waitForTimeout(200);
  await p.screenshot({ path: join(tmp, n + '.png'), omitBackground: n === 'fg' });
}
await b.close();

// 3 · sizes; the monochrome layer is his white silhouette with the eyes cut out
const py = `
from PIL import Image
A='${join(ROOT, 'assets/images')}/'; T='${tmp}/'
Image.open(T+'icon.png').convert('RGB').save(A+'icon.png')
fg=Image.open(T+'fg.png').convert('RGBA')
fg.resize((512,512),Image.LANCZOS).save(A+'android-icon-foreground.png')
Image.open(T+'bg.png').convert('RGBA').resize((512,512),Image.LANCZOS).save(A+'android-icon-background.png')
mono=Image.new('RGBA',fg.size,(0,0,0,0)); src=fg.load(); dst=mono.load()
for y in range(fg.size[1]):
  for x in range(fg.size[0]):
    r,g,b,a=src[x,y]
    eye=(r>235 and g>235 and b>235) or (r<90 and g<60 and b<50)
    if a>0 and not eye: dst[x,y]=(255,255,255,a)
mono.resize((432,432),Image.LANCZOS).save(A+'android-icon-monochrome.png')
Image.open(T+'icon.png').convert('RGBA').resize((48,48),Image.LANCZOS).save(A+'favicon.png')
`;
execFileSync('python3', ['-c', py], { stdio: 'inherit' });
console.log('wrote the app icon set to assets/images/');
