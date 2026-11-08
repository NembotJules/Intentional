#!/usr/bin/env node
/**
 * US-122 · The Flick 2.0 app icon, rendered from scripts/icon/*.html (the approved Flick 2.0 drawing, waving, on a
 * peach sunburst): icon.png (iOS, 1024, opaque), the Android adaptive foreground / background / monochrome layers, and
 * the web favicon. `node scripts/render-icon.mjs` (Chrome via E2E_CHROME, Python Pillow for the resizes).
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'flick-icon-'));
const b = await chromium.launch({ executablePath: process.env.E2E_CHROME || undefined });
const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
for (const n of ['icon', 'fg', 'bg', 'mono']) {
  await p.goto(`file://${join(ROOT, 'scripts/icon', n + '.html')}`);
  await p.waitForTimeout(200);
  await p.screenshot({ path: join(tmp, n + '.png'), omitBackground: n === 'fg' || n === 'mono' });
}
await b.close();
const py = `
from PIL import Image
A='${join(ROOT, 'assets/images')}/'; T='${tmp}/'
Image.open(T+'icon.png').convert('RGB').save(A+'icon.png')
Image.open(T+'fg.png').convert('RGBA').resize((512,512),Image.LANCZOS).save(A+'android-icon-foreground.png')
Image.open(T+'bg.png').convert('RGBA').resize((512,512),Image.LANCZOS).save(A+'android-icon-background.png')
Image.open(T+'mono.png').convert('RGBA').resize((432,432),Image.LANCZOS).save(A+'android-icon-monochrome.png')
Image.open(T+'icon.png').convert('RGBA').resize((48,48),Image.LANCZOS).save(A+'favicon.png')
`;
execFileSync('python3', ['-c', py], { stdio: 'inherit' });
console.log('wrote the app icon set to assets/images/');
