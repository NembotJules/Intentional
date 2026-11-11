/**
 * US-110 · Builds the sticker icons in assets/icons/stickers/ from Microsoft Fluent Emoji "Flat" SVGs (MIT,
 * https://github.com/microsoft/fluentui-emoji). Each one becomes a die-cut sticker: a thick white outline and a small
 * soft shadow, rendered by Chrome at 192 px on a transparent background.
 *
 *   E2E_CHROME=/usr/bin/google-chrome node scripts/build-stickers.mjs          # all
 *   E2E_CHROME=/usr/bin/google-chrome node scripts/build-stickers.mjs moon sun # some
 *
 * Tab-bar stickers also get a muted "-grey" twin (grayscale, lighter) for the inactive tabs (GREY below).
 *
 * US-128: sun, target, lock, unlock, chart and flame are drawn in Flick's style in scripts/flick-stickers.mjs instead.
 *
 * To add a sticker: add `key: 'assets/<Fluent name>/Flat/<file>.svg'` below, run the script, then add the key to
 * components/ui/Sticker.tsx.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLICK_STICKERS } from './flick-stickers.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'assets/icons/stickers');
const RAW = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/';
const SIZE = 192; // output px
const ICON = 148; // the emoji inside, leaves room for the outline and shadow
const OUTLINE = 8; // white border, px at 192
const SOURCES = {
  apple: 'assets/Red apple/Flat/red_apple_flat.svg',
  baby: 'assets/Baby/Default/Flat/baby_flat_default.svg',
  banknote: 'assets/Dollar banknote/Flat/dollar_banknote_flat.svg',
  beach: 'assets/Beach with umbrella/Flat/beach_with_umbrella_flat.svg',
  bed: 'assets/Bed/Flat/bed_flat.svg',
  bell: 'assets/Bell/Flat/bell_flat.svg',
  bike: 'assets/Bicycle/Flat/bicycle_flat.svg',
  book: 'assets/Open book/Flat/open_book_flat.svg',
  box: 'assets/Package/Flat/package_flat.svg',
  brain: 'assets/Brain/Flat/brain_flat.svg',
  briefcase: 'assets/Briefcase/Flat/briefcase_flat.svg',
  bulb: 'assets/Light bulb/Flat/light_bulb_flat.svg',
  calendar: 'assets/Spiral calendar/Flat/spiral_calendar_flat.svg',
  camera: 'assets/Camera/Flat/camera_flat.svg',
  candle: 'assets/Candle/Flat/candle_flat.svg',
  chart: 'assets/Bar chart/Flat/bar_chart_flat.svg',
  check: 'assets/Check mark button/Flat/check_mark_button_flat.svg',
  church: 'assets/Church/Flat/church_flat.svg',
  city: 'assets/Cityscape/Flat/cityscape_flat.svg',
  clock: 'assets/Alarm clock/Flat/alarm_clock_flat.svg',
  cloud: 'assets/Cloud/Flat/cloud_flat.svg',
  code: 'assets/Laptop/Flat/laptop_flat.svg',
  coffee: 'assets/Hot beverage/Flat/hot_beverage_flat.svg',
  coins: 'assets/Coin/Flat/coin_flat.svg',
  crystal: 'assets/Crystal ball/Flat/crystal_ball_flat.svg',
  dog: 'assets/Dog face/Flat/dog_face_flat.svg',
  door: 'assets/Door/Flat/door_flat.svg',
  dumbbell: 'assets/Flexed biceps/Default/Flat/flexed_biceps_flat_default.svg',
  envelope: 'assets/Envelope/Flat/envelope_flat.svg',
  eyes: 'assets/Eyes/Flat/eyes_flat.svg',
  film: 'assets/Film frames/Flat/film_frames_flat.svg',
  flame: 'assets/Fire/Flat/fire_flat.svg',
  footprints: 'assets/Footprints/Flat/footprints_flat.svg',
  gamepad: 'assets/Video game/Flat/video_game_flat.svg',
  gear: 'assets/Gear/Flat/gear_flat.svg',
  gem: 'assets/Gem stone/Flat/gem_stone_flat.svg',
  globe: 'assets/Globe showing europe-africa/Flat/globe_showing_europe-africa_flat.svg',
  graduation: 'assets/Graduation cap/Flat/graduation_cap_flat.svg',
  hammer: 'assets/Hammer/Flat/hammer_flat.svg',
  handheart: 'assets/Heart hands/Default/Flat/heart_hands_flat_default.svg',
  handshake: 'assets/Handshake/Flat/handshake_flat.svg',
  heart: 'assets/Red heart/Flat/red_heart_flat.svg',
  hourglass: 'assets/Hourglass not done/Flat/hourglass_not_done_flat.svg',
  house: 'assets/House/Flat/house_flat.svg',
  hundred: 'assets/Hundred points/Flat/hundred_points_flat.svg',
  inbox: 'assets/Inbox tray/Flat/inbox_tray_flat.svg',
  key: 'assets/Key/Flat/key_flat.svg',
  landmark: 'assets/Classical building/Flat/classical_building_flat.svg',
  languages: 'assets/Speech balloon/Flat/speech_balloon_flat.svg',
  laptop: 'assets/Laptop/Flat/laptop_flat.svg',
  leaf: 'assets/Leaf fluttering in wind/Flat/leaf_fluttering_in_wind_flat.svg',
  lock: 'assets/Locked/Flat/locked_flat.svg',
  lotus: 'assets/Lotus/Flat/lotus_flat.svg',
  memo: 'assets/Memo/Flat/memo_flat.svg',
  mic: 'assets/Studio microphone/Flat/studio_microphone_flat.svg',
  moon: 'assets/Crescent moon/Flat/crescent_moon_flat.svg',
  mountain: 'assets/Snow-capped mountain/Flat/snow-capped_mountain_flat.svg',
  music: 'assets/Musical notes/Flat/musical_notes_flat.svg',
  nophone: 'assets/No mobile phones/Flat/no_mobile_phones_flat.svg',
  palette: 'assets/Artist palette/Flat/artist_palette_flat.svg',
  party: 'assets/Party popper/Flat/party_popper_flat.svg',
  pen: 'assets/Fountain pen/Flat/fountain_pen_flat.svg',
  phone: 'assets/Mobile phone/Flat/mobile_phone_flat.svg',
  picture: 'assets/Framed picture/Flat/framed_picture_flat.svg',
  piggybank: 'assets/Money bag/Flat/money_bag_flat.svg',
  pin: 'assets/Round pushpin/Flat/round_pushpin_flat.svg',
  plane: 'assets/Airplane/Flat/airplane_flat.svg',
  prohibited: 'assets/Prohibited/Flat/prohibited_flat.svg',
  question: 'assets/Red question mark/Flat/red_question_mark_flat.svg',
  repeat: 'assets/Repeat button/Flat/repeat_button_flat.svg',
  rocket: 'assets/Rocket/Flat/rocket_flat.svg',
  salad: 'assets/Green salad/Flat/green_salad_flat.svg',
  seedling: 'assets/Seedling/Flat/seedling_flat.svg',
  shield: 'assets/Shield/Flat/shield_flat.svg',
  smile: 'assets/Smiling face with smiling eyes/Flat/smiling_face_with_smiling_eyes_flat.svg',
  sparkles: 'assets/Sparkles/Flat/sparkles_flat.svg',
  sprout: 'assets/Herb/Flat/herb_flat.svg',
  star: 'assets/Star/Flat/star_flat.svg',
  stethoscope: 'assets/Stethoscope/Flat/stethoscope_flat.svg',
  stop: 'assets/Stop button/Flat/stop_button_flat.svg',
  stopwatch: 'assets/Stopwatch/Flat/stopwatch_flat.svg',
  sun: 'assets/Sun/Flat/sun_flat.svg',
  sunrise: 'assets/Sunrise/Flat/sunrise_flat.svg',
  sunset: 'assets/Sunset/Flat/sunset_flat.svg',
  target: 'assets/Bullseye/Flat/bullseye_flat.svg',
  teacup: 'assets/Teacup without handle/Flat/teacup_without_handle_flat.svg',
  trash: 'assets/Wastebasket/Flat/wastebasket_flat.svg',
  tree: 'assets/Deciduous tree/Flat/deciduous_tree_flat.svg',
  trending: 'assets/Chart increasing/Flat/chart_increasing_flat.svg',
  trophy: 'assets/Trophy/Flat/trophy_flat.svg',
  unlock: 'assets/Unlocked/Flat/unlocked_flat.svg',
  users: 'assets/People hugging/Flat/people_hugging_flat.svg',
  utensils: 'assets/Fork and knife/Flat/fork_and_knife_flat.svg',
  wallet: 'assets/Purse/Flat/purse_flat.svg',
  wave: 'assets/Water wave/Flat/water_wave_flat.svg',
};

/** Stickers that also get a muted `<key>-grey.png` (inactive tab-bar icons). */
const GREY = ['sun', 'target', 'lock', 'chart', 'house', 'gear'];

const keys = process.argv.slice(2).length ? process.argv.slice(2) : [...new Set([...Object.keys(SOURCES), ...Object.keys(FLICK_STICKERS)])];
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.E2E_CHROME || undefined });
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
for (const key of keys) {
  // US-128: the hero stickers are drawn in Flick's style (scripts/flick-stickers.mjs), the rest come from Fluent
  let svg = FLICK_STICKERS[key];
  if (!svg) {
    const src = SOURCES[key];
    if (!src) throw new Error(`unknown sticker ${key}`);
    const res = await fetch(RAW + src.split('/').map(encodeURIComponent).join('/'));
    if (!res.ok) throw new Error(`${key}: ${res.status} ${src}`);
    svg = await res.text();
  }
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
<svg width="0" height="0" style="position:absolute"><filter id="s" x="-20%" y="-20%" width="140%" height="140%">
  <feMorphology in="SourceAlpha" operator="dilate" radius="${OUTLINE}" result="d"/>
  <feGaussianBlur in="d" stdDeviation="0.6" result="db"/>
  <feFlood flood-color="#ffffff"/><feComposite in2="db" operator="in" result="white"/>
  <feGaussianBlur in="db" stdDeviation="3.5" result="sb"/><feOffset in="sb" dy="4" result="so"/>
  <feFlood flood-color="#000" flood-opacity="0.22"/><feComposite in2="so" operator="in" result="shadow"/>
  <feMerge><feMergeNode in="shadow"/><feMergeNode in="white"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter></svg>
<div style="width:${SIZE}px;height:${SIZE}px;display:flex;align-items:center;justify-content:center">
<img src="${dataUri}" style="width:${ICON}px;height:${ICON}px;filter:url(#s)"></div></body></html>`);
  await page.waitForFunction(() => document.images[0]?.complete);
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: SIZE, height: SIZE } });
  await writeFile(path.join(OUT, `${key}.png`), png);
  if (GREY.includes(key)) {
    await page.evaluate(() => {
      document.images[0].style.filter = 'url(#s) grayscale(1) brightness(1.18) contrast(0.85)';
    });
    const grey = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: SIZE, height: SIZE } });
    await writeFile(path.join(OUT, `${key}-grey.png`), grey);
  }
  process.stdout.write(`${key} `);
}
await browser.close();
console.log(`\n${keys.length} stickers → assets/icons/stickers/`);
