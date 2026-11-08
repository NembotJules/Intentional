#!/usr/bin/env node
/**
 * US-121 · The native splash image = the first frame of the launch clip (assets/lottie/flick-ignite.json):
 * Flick's hearth stones with one glowing ember, on transparency (the splash background colour is in app.json).
 * Rendered with lottie-web in Chrome, contained in a square exactly like the in-app LaunchIntro, so the hand-off
 * from the native splash to the animation doesn't jump. `node scripts/render-splash.mjs` (needs network for lottie-web).
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = readFileSync(join(ROOT, 'assets/lottie/flick-ignite.json'), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.E2E_CHROME || undefined });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}#a{width:1024px;height:1024px}</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js"></script></head><body><div id="a"></div></body></html>`);
await page.waitForFunction(() => window.lottie);
await page.evaluate((d) => { const a = window.lottie.loadAnimation({ container: document.getElementById('a'), renderer: 'svg', loop: false, autoplay: false, animationData: JSON.parse(d) }); a.goToAndStop(0, true); }, data);
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'assets/images/splash-icon.png'), omitBackground: true });
await browser.close();
console.log('wrote assets/images/splash-icon.png');
