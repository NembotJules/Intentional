/**
 * US-130 · The celebration music really plays: a real <audio> element loads the jingle and plays it to its length
 * (the web build of expo-audio). Settings → Sounds → "Celebration sounds": off is silent, on plays a taste of it.
 */
import { start, makeDb } from './lib.mjs';

const t = await start('sounds');
const { page } = t;
await page.context().addInitScript(() => {
  window.__played = [];
  const orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const r = orig.call(this);
    Promise.resolve(r).then(() => window.__played.push(`ok ${(this.currentSrc || this.src).split('/').pop()} ${this.duration.toFixed(1)}`), (e) => window.__played.push(`error ${e.name}`));
    return r;
  };
});
await t.goto('/');
const { db, settings } = makeDb({ pillars: [['Health', '#52B788', 'heart']] });
await t.seed(db, settings);
await t.goto('/settings');
const sw = page.getByLabel('Celebration sounds', { exact: true }).last();
await sw.waitFor({ timeout: 60000 });
await t.shot('settings-sounds');
const played = () => page.evaluate(() => window.__played);
ok(await t.has('Celebration sounds'), 'Settings has "Celebration sounds"');

await sw.click(); // off
await t.wait(800);
ok((await played()).length === 0, 'turned off: nothing plays');

await sw.click(); // on: a taste of the music
await t.wait(3500);
const p = await played();
ok(p.some((x) => /^ok milestone\.m4a 2\.\d$/.test(x)), `turned on: a real jingle loads and plays (${p.join(', ')})`);
ok(!p.some((x) => x.startsWith('error')), 'no playback error');

function ok(c, m) { t.ok(c, m); }
await t.finish();
