#!/usr/bin/env node
/**
 * US-118 / US-119 / US-127 · Flick 3.0 as Lottie loops, generated from the same drawing as components/onboarding/Mascot.tsx
 * (flat Duolingo-style: no outlines, one shade, a belly, big white eyes, chunky limbs, round hands, shoes). Reproducible: `node scripts/build-flick-lottie.mjs`
 *   → assets/lottie/flick-<mood>.json  (happy, calm, worried, sleepy, focus, proud, think, shock, meditate)
 * US-120 · `meditate`: cross-legged, hands on the knees, eyes closed, floating up and down with a breathing aura.
 * US-123 · the unlock flow: guard, deflate, remind, watch, victory, key → hourglass (flick-<clip>.json).
 * US-126 · cheer (a new world unlocked) → proud.
 * US-121 · `flick-ignite.json` (2 s, plays once at launch): an ember on the hearth stones pulses, catches with a flash
 *   and sparks, Flick pops up out of the flame (squash & stretch), opens his eyes and waves. Its first frame is the
 *   native splash image (assets/images/splash-icon.png, rendered by scripts/render-splash.mjs).
 *
 * Why a script and not After Effects: a Lottie file is JSON. Every motion here comes from smooth, periodic functions
 * sampled into keyframes, so each loop closes seamlessly and every number is tunable.
 *
 * Idle loop (4 s at 60 fps): the flame path bends (tip sway + lick) and breathes; the cel shadow, highlights and core
 * follow it inside layer masks; the face rides the flame; the arms hang from moving shoulders in the mood's pose and
 * swing; blinks + glances; embers; a twinkling star (proud); drifting z's (sleepy). The shoes stay planted.
 *
 * Coordinates are the drawing's "draft space" (the flame's base at 60,113, the ground at 134.5); a null parent fits
 * it into the 120 box exactly like Mascot's FIT, inside a padded canvas (assets/lottie/flick-frame.json).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.LOTTIE_OUT || join(ROOT, 'assets/lottie');
const FR = 60;
let OP = 240; // 4 s (a loop); the ignite clip sets its own length
const STEP = 4; // a keyframe every 4 frames, linear between: smooth because the source curves are smooth
const TAU = Math.PI * 2;
const PAD_X = 22, PAD_Y = 16; // room for raised hands, the stretched tip and rising embers
const W = 120 + PAD_X * 2, H = 120 + PAD_Y + 4;
const FIT = 0.84; // Mascot: translate(60 118) scale(0.84) translate(-60 -134.5)

// ── the drawing (Mascot.tsx, draft space) ─────────────────────────────────────
// US-127 · Flick 3.0 (flat, no outlines): same shapes as Mascot.tsx
const OUTER = 'M62.6 7.4 C69.2 21.9 93 37.8 93 73.4 C93 98.5 78.5 113 60 113 C41.5 113 27 98.5 27 74.8 C27 53.6 44.2 43 52.1 32.4 C56 25.8 60 17.8 62.6 7.4 Z';
const TIP = 'M31 27 C41 36 47 47 45 60 C42.5 68.5 30 69 26.8 60 C24 51 26 39 31 27 Z';
const CORE = 'M60 90.5 C71.6 90.5 81 96 81 102.5 C81 109 71.6 114.5 60 114.5 C48.4 114.5 39 109 39 102.5 C39 96 48.4 90.5 60 90.5 Z';
const SHADE = 'M93 40 C99 80 86 116 60 117 C42 117 30 108 26 96 C40 106 64 108 78 96 C90 85 92 64 87 44 Z';
const HIGHLIGHT_SIDE = 'M44 41 C38 47 31 58 31 72 C31 78 32 82 34 86 C35 70 40 58 48 50 C46 48 45 45 44 41 Z';
const HIGHLIGHT_TIP = 'M60 8 C55 20 53 32 55 44 C57 31 59 22 62 13 Z';
const CORE_SHADOW = 'M40 106 C48 112 70 112 80 104 L80 116 L40 116 Z';
const MITTEN = 'M0 -9.5 C3 -9.5 5.5 -7 5.5 -4 C5.5 -1 3 1.5 0 1.5 C-3 1.5 -5.5 -1 -5.5 -4 C-5.5 -7 -3 -9.5 0 -9.5 Z'; // a round hand
const THUMB = 'M-4.2 -2.6 C-8.2 -3 -10 -6.4 -8.2 -8.4 C-6.8 -9.8 -4.6 -8.6 -3.6 -6.4';
const SHOE = 'M-6.5 0 C-7.6 -3.4 -6.4 -6.6 -2.6 -7 L1 -7 C5.6 -6.8 9.6 -4.4 10 -0.6 C10 0.4 9.4 1 8.4 1 L-5.2 1 C-6 1 -6.4 0.6 -6.5 0 Z';
const STAR = 'M101 12 L104 20 L112 20 L106 25 L108 33 L101 28 L94 33 L96 25 L90 20 L98 20 Z';
const C = {
  ink: '#3A2418', brow: '#C24A00', mouth: '#7A2E0E', tongue: '#FF5E5E', base: '#FF8C1A', shadow: '#F06A00', highlight: '#FF8C1A', lick: '#F06A00', lickSoft: '#F06A00',
  core: '#FFC93C', coreShadow: '#FFB020', coreShine: '#FFC93C', limb: '#F06A00', hand: '#D95400', shoe: '#D95400', sole: '#D95400',
};

// ── helpers ───────────────────────────────────────────────────────────────────
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]; };
const r2 = (v) => Math.round(v * 10) / 10;
const frames = () => Array.from({ length: Math.floor(OP / STEP) + 1 }, (_, k) => Math.min(OP, k * STEP));
const LIN = { i: { x: [1], y: [1] }, o: { x: [0], y: [0] } };
const kf = (fn) => { const ts = frames(); return { a: 1, k: ts.map((t, k) => (k < ts.length - 1 ? { t, s: fn(t), ...LIN } : { t, s: fn(t) })) }; };
const still = (v) => ({ a: 0, k: v });
const ph = (t, periodFrames, phase = 0) => Math.sin((TAU * t) / periodFrames + phase);

/** SVG path (absolute M/L/C/Q/Z) → cubic segments [[p0,c1,c2,p3], …] (each M starts a new subpath; first only). */
function parsePath(d) {
  const tok = d.match(/[MLCQZ]|-?\d*\.?\d+/g);
  let i = 0, cur = null, start = null;
  const segs = [];
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    const c = tok[i++];
    if (c === 'M') { cur = [num(), num()]; start = cur; }
    else if (c === 'L') { const p = [num(), num()]; segs.push([cur, cur, p, p]); cur = p; }
    else if (c === 'C') { const a = [num(), num()], b = [num(), num()], p = [num(), num()]; segs.push([cur, a, b, p]); cur = p; }
    else if (c === 'Q') { const q = [num(), num()], p = [num(), num()]; segs.push([cur, [cur[0] + (2 / 3) * (q[0] - cur[0]), cur[1] + (2 / 3) * (q[1] - cur[1])], [p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])], p]); cur = p; }
    else if (c === 'Z') { if (cur[0] !== start[0] || cur[1] !== start[1]) segs.push([cur, cur, start, start]); cur = start; }
  }
  return segs;
}
function toShape(segs, f, closed) {
  const v = [], ii = [], oo = [];
  const pts = segs.map(([p0, a, b, p3]) => [f(p0), f(a), f(b), f(p3)]);
  pts.forEach(([p0, a], k) => {
    v.push(p0.map(r2));
    oo.push([r2(a[0] - p0[0]), r2(a[1] - p0[1])]);
    const prev = pts[(k - 1 + pts.length) % pts.length];
    ii.push([r2(prev[2][0] - p0[0]), r2(prev[2][1] - p0[1])]);
  });
  if (!closed) {
    const last = pts[pts.length - 1];
    v.push(last[3].map(r2)); oo.push([0, 0]); ii.push([r2(last[2][0] - last[3][0]), r2(last[2][1] - last[3][1])]);
    ii[0] = [0, 0];
  }
  return { i: ii, o: oo, v, c: closed };
}
const ID = (p) => p;
const SEG = Object.fromEntries(Object.entries({ OUTER, TIP, CORE, SHADE, HIGHLIGHT_SIDE, HIGHLIGHT_TIP, CORE_SHADOW, MITTEN, THUMB, SHOE, STAR }).map(([k, d]) => [k, parsePath(d)]));

// ── motion ────────────────────────────────────────────────────────────────────
// All periods divide OP (240) so the loop closes exactly. `M` = the current mood's motion.
const MOTION = {
  happy: { sway: 1, lick: 1, breathe: 1, swing: 1 },
  calm: { sway: 0.7, lick: 0.6, breathe: 0.9, swing: 0.6 },
  proud: { sway: 1.2, lick: 1.2, breathe: 1.2, swing: 1.1 },
  worried: { sway: 0.5, lick: 1.6, breathe: 0.6, swing: 0.4 },
  sleepy: { sway: 0.5, lick: 0.3, breathe: 1.3, swing: 0.3, slow: true },
  focus: { sway: 0.4, lick: 0.9, breathe: 0.7, swing: 0.3 },
  think: { sway: 0.8, lick: 0.7, breathe: 0.8, swing: 0.4 },
  shock: { sway: 0.6, lick: 2, breathe: 1.4, swing: 0.8 },
  meditate: { sway: 0.35, lick: 0.5, breathe: 1.1, swing: 0, slow: true },
};
let M = MOTION.happy;
/**
 * US-123 · A clip can take over parts of Flick over time (all optional, t in frames):
 *   scale(t)  flame size (1 = normal) · dim(t) 0..1 lit → dim colours · lift(t) [dx, dy] whole-body offset
 *   squash(t) [sx, sy] around the feet · face {brows, mouth, eyes:'open'|'closed', look(t)→[dx,dy], o(t)→mouth "o" size}
 *   hand(side, t, shoulder) → [x, y] · front(side) arm in front of the body · raised(side, t) hand wiggles
 *   tap(t) right shoe angle (deg) · over / under: extra layers above Flick / behind him · mid: above his body, under his
 *   front arms (a mug he holds) · rot(t) whole-body rotation (lying in bed) · noExtras / noEmbers
 */
let CLIP = null;
const sway = (t) => M.sway * (2.6 * ph(t, 240) + 0.9 * ph(t, 80, 1.1));
const lick = (t) => M.lick * (1.6 * ph(t, 48, 0.4) + 0.8 * ph(t, 30, 2.0));
const breathe = (t) => M.breathe * (M.slow ? 0.034 * ph(t, 240, -Math.PI / 2) : 0.028 * ph(t, 120, -Math.PI / 2) + 0.012 * ph(t, 60, 0.7));

/** The living bend, in draft space: h = 0 at the flame's base (y 113), 1 at its tip (y 8). */
function flameAt(t) {
  const b = breathe(t), sw = sway(t), lk = lick(t);
  const k = CLIP?.scale ? CLIP.scale(t) : 1;
  return ([x, y]) => {
    const h = Math.max(0, Math.min(1, (113 - y) / 105));
    const px = 60 + (x - 60) * (1 - 0.55 * b) + sw * h * h + lk * Math.pow(h, 4), py = 113 - (113 - y) * (1 + b);
    return k === 1 ? [px, py] : [60 + (px - 60) * k, 113 - (113 - py) * k];
  };
}

let EYES = null; // US-121: a clip can drive the eyes itself
const eyeOpen = (t) => { if (EYES) return EYES(t); const dip = (c, w = 4) => Math.max(0, 1 - Math.abs(t - c) / w); return Math.max(0.08, 1 - Math.max(dip(60), dip(174), dip(186))); };
const glance = (t) => { const win = (a, b, v) => (t < a || t > b ? 0 : t < a + 8 ? (v * (t - a)) / 8 : t > b - 8 ? (v * (b - t)) / 8 : v); return win(96, 132, -1.6) + win(198, 222, 1.4); };

// ── Lottie building blocks ────────────────────────────────────────────────────
let ind = 0;
const ROOT_IND = 1000;
const POP_IND = 1002; // US-121: Flick pops up out of the ember
const BODY_IND = 1003; // US-123: a clip moves / squashes the whole Flick
const FLOAT_IND = 1001; // US-120: the meditating Flick floats; his aura and shadow don't
let PARENT = ROOT_IND;
const TR = { ty: 'tr', p: still([0, 0]), a: still([0, 0]), s: still([100, 100]), r: still(0), o: still(100), sk: still(0), sa: still(0) };
const layer = (nm, shapes, ks = {}, extra = {}) => ({
  ddd: 0, ind: ++ind, ty: 4, nm, sr: 1, ao: 0, ip: 0, op: OP, st: 0, bm: 0, parent: PARENT,
  ks: { o: still(100), r: still(0), p: still([0, 0, 0]), a: still([0, 0, 0]), s: still([100, 100, 100]), ...ks },
  shapes, ...extra,
});
const group = (nm, items, tr = {}) => ({ ty: 'gr', nm, it: [...items, { ...TR, ...tr }] });
const fill = (hex, a = 1) => ({ ty: 'fl', c: still(rgb(hex)), o: still(Math.round(a * 100)), r: 1 });
const DIM = { base: '#E59152', shadow: '#CC7438', highlight: '#E59152', core: '#F4CF9A', coreShadow: '#EBBE7E', coreShine: '#F4CF9A', limb: '#CC7438', hand: '#B8622E' };
const mix = (a, b, k) => { const x = rgb(a), y = rgb(b); return [0, 1, 2].map((i) => Math.round((x[i] + (y[i] - x[i]) * k) * 1000) / 1000).concat(1); };
/** A body colour: still, or fading toward its dim tone when the clip dims Flick. */
const bodyFill = (key) => (CLIP?.dim ? { ty: 'fl', c: kf((t) => mix(C[key], DIM[key], CLIP.dim(t))), o: still(100), r: 1 } : fill(C[key]));
const stroke = (w, hex = C.ink) => ({ ty: 'st', c: still(rgb(hex)), o: still(100), w: still(w), lc: 2, lj: 2, ml: 4 });
const ellipse = (p, s) => ({ ty: 'el', p: typeof p === 'function' ? kf(p) : still(p), s: typeof s === 'function' ? kf(s) : still(s), d: 1 });
const shapeKfs = (fn) => frames().map((t, k, all) => (k < all.length - 1 ? { t, s: [fn(t)], i: { x: 1, y: 1 }, o: { x: 0, y: 0 } } : { t, s: [fn(t)] }));
const pathKf = (fn) => ({ ty: 'sh', ks: { a: 1, k: shapeKfs(fn) } });
const pathStill = (shape) => ({ ty: 'sh', ks: still(shape) });
const line = (d, w = 3.2, hex = C.ink) => group('line', [pathStill(toShape(parsePath(d), ID, false)), stroke(w, hex)]);
/** A layer clipped to an animated shape (the cel shading stays inside the bending flame). */
const masked = (nm, shapes, maskFn) => layer(nm, shapes, {}, { hasMask: true, masksProperties: [{ inv: false, mode: 'a', nm: 'clip', pt: { a: 1, k: shapeKfs(maskFn) }, o: still(100), x: still(0) }] });
/** US-127 · A limb: one flat, chunky stroke (no ink outline). */
const tube = (nm, shapeItem) => group(nm, [shapeItem, CLIP?.dim ? { ty: 'st', c: kf((t) => mix(C.limb, DIM.limb, CLIP.dim(t))), o: still(100), w: still(9.5), lc: 2, lj: 2, ml: 4 } : stroke(9.5, C.limb)]);

// ── the face (per mood) ───────────────────────────────────────────────────────
const OPEN_EYES = new Set(['happy', 'worried', 'focus', 'think', 'shock']);
const faceLayer = (mood) => {
  const items = [];
  const F = CLIP?.face ?? {};
  const look = F.look ?? ((t) => [glance(t), 0]);
  const brows = F.brows ?? {
    worried: 'M45 72 L53 68 M75 72 L67 68', focus: 'M45 68.5 L54 72 M75 68.5 L66 72', think: 'M45.5 70 Q50 68.5 54 69.5 M65 68 L74 66',
    shock: 'M45 66 Q50 63 54 65 M66 65 Q70 63 75 66', meditate: 'M45.5 69 Q50 66.5 54 68 M66 68 Q70 66.5 74.5 69', happy: 'M45.5 70 Q50 67.5 54 69 M66 69 Q70 67.5 74.5 70', calm: 'M45.5 70 Q50 67.5 54 69 M66 69 Q70 67.5 74.5 70', proud: 'M45.5 70 Q50 67.5 54 69 M66 69 Q70 67.5 74.5 70',
  }[mood];
  // US-127: brows sit a little higher, above the big eyes
  if (brows) items.push(group('brows', brows.split(' M').map((x, k) => line(k ? 'M' + x : x, 2.5, C.brow)), { p: still([0, -4.5]) }));
  if (F.eyes ? F.eyes === 'open' : OPEN_EYES.has(mood)) {
    const big = mood === 'shock';
    // US-127: big white eyes, large pupils that look around, one glint
    const off = mood === 'worried' || mood === 'sad' ? 0 : 1.3;
    const white = (cx) => group('white', [ellipse([cx, 79], (t) => [big ? 17.6 : 16.4, r2((big ? 19.6 : 18.4) * eyeOpen(t))]), fill('#FFFFFF')]);
    const pupil = (cx) => group('pupil', [ellipse((t) => [r2(cx + off + look(t)[0] * 1.4), r2(80 + look(t)[1])], (t) => [big ? 8 : 10.8, r2((big ? 8.8 : 11.6) * eyeOpen(t))]), fill(C.ink)]);
    const hi = (cx) => group('glint', [ellipse((t) => [r2(cx + off + 1.5 + look(t)[0] * 1.4), r2(77.9 + look(t)[1])], (t) => { const s = eyeOpen(t) > 0.5 ? 3.6 : 0; return [s, s]; }), fill('#FFFFFF')]);
    items.push(hi(50.5), hi(69.5), pupil(50.5), pupil(69.5), white(50.5), white(69.5));
  } else if (mood === 'sleepy' && !F.eyes) {
    items.push(line('M45.5 79 Q50.5 83 55.5 79'), line('M64.5 79 Q69.5 83 74.5 79'), group('o', [ellipse([60, 92], [5.6, 6.4]), fill(C.mouth)]));
  } else {
    items.push(line('M45.5 80 Q50.5 75 55.5 80'), line('M64.5 80 Q69.5 75 74.5 80'));
  }
  if (!F.mouth && !F.o && (mood === 'happy' || mood === 'proud')) {
    items.push(
      group('tongue', [pathStill(toShape(parsePath('M56 94.6 Q60 92.4 64 94.6 Q62.4 97 60 97 Q57.6 97 56 94.6 Z'), ID, true)), fill(C.tongue)]),
      group('mouth', [pathStill(toShape(parsePath('M53 89 Q60 90 67 89 Q66 97 60 97 Q54 97 53 89 Z'), ID, true)), fill(C.mouth)]),
    );
  }
  const mouth = F.mouth ?? (F.o ? null : { meditate: 'M55.5 90 Q60 93.5 64.5 90', calm: 'M55 90 Q60 94 65 90', focus: 'M54 91 Q60 94 66 91', think: 'M54 92 L66 90', worried: 'M53 93 Q56.5 89 60 92 Q63.5 95 67 91' }[mood]);
  if (mouth) items.push(line(mouth, mood === 'calm' || mood === 'worried' ? 2.8 : 3.1));
  if (F.o) items.push(group('o', [ellipse([60, 93], (t) => { const d = r2(F.o(t)); return [d, r2(d * 1.15)]; }), fill(C.mouth)]));
  else if (mood === 'shock') items.push(group('o', [ellipse([60, 93], [9.2, 11.2]), fill(C.mouth)]));
  items.push(...[40, 80].map((cx) => group('cheek', [ellipse([cx, 89], [9.2, 5.6]), fill('#FF5A2C', 0.4)])));
  return layer('face', items, {
    a: still([60, 80, 0]),
    p: kf((t) => { const [x, y] = flameAt(t)([60, 80]); return [r2(x), r2(y), 0]; }),
    s: still([96.5, 96.5, 100]), // Mascot: 0.5 + 0.5 × 0.965
  });
};

// ── arms: the mood's pose, swinging from shoulders that move with the flame ────
const DEFAULT_ARMS = { meditate: 'knees', happy: 'down', calm: 'down', proud: 'star', worried: 'hug', sleepy: 'down', focus: 'down', think: 'chin', shock: 'cheer' };
let WAVE_K = () => 1; // 0 = hand down, 1 = raised (the ignite clip ramps it)
let t0 = 0;
function handRest(arms, side, sh) {
  if (CLIP?.hand) return CLIP.hand(side, t0, sh);
  const L = side < 0;
  switch (arms) {
    case 'cheer': return [sh[0] + side * 16, sh[1] - 30];
    case 'chin': return L ? [sh[0] - 19, sh[1] + 22] : [70, 101];
    case 'hug': return L ? [49, 103] : [71, 103];
    case 'star': return L ? [sh[0] - 19, sh[1] + 22] : [104, 42];
    case 'knees': return L ? [23, 118] : [97, 118];
    case 'wave': { const k = WAVE_K(t0); const down = [sh[0] + side * 19, sh[1] + 22]; return L ? down : [down[0] + (sh[0] + 21 - down[0]) * k, down[1] + (sh[1] - 25 - down[1]) * k]; }
    default: return [sh[0] + side * 19, sh[1] + 22];
  }
}
const armLayer = (side, arms) => {
  const shoulder = (t) => flameAt(t)(side < 0 ? [34, 84] : [86, 80]);
  const raisedAt = (t) => (CLIP?.raised ? CLIP.raised(side, t) : false) || arms === 'cheer' || (arms === 'star' && side > 0) || (arms === 'wave' && side > 0 && WAVE_K(t) > 0.5);
  const still2 = (arms === 'chin' && side > 0) || !!CLIP?.hand;
  const hand = (t) => {
    t0 = t;
    const [x, y] = handRest(arms, side, shoulder(t));
    const swing = still2 ? 0 : M.swing * (1.6 * ph(t, 120, side < 0 ? 0 : Math.PI) + 0.5 * ph(t, 60, 1.3));
    const raised = raisedAt(t);
    const wiggle = raised ? (arms === 'wave' ? 4.5 * ph(t, 24) : 1.8 * ph(t, 40, side < 0 ? 0 : Math.PI)) : 0;
    return [x + swing + wiggle, y + 0.7 * M.swing * ph(t, 120, side < 0 ? 0.6 : 2.2) + (raised ? 0.9 * ph(t, 40, 1) : 0)];
  };
  const ctrl = (t) => { const a = shoulder(t), b = hand(t); return [(a[0] + b[0]) / 2 + side * 6, (a[1] + b[1]) / 2 + 4]; };
  const handTf = (t) => {
    const h = hand(t), c = ctrl(t);
    const rot = Math.atan2(h[1] - c[1], h[0] - c[0]) + Math.PI / 2;
    const cs = Math.cos(rot) * 1.2, sn = Math.sin(rot) * 1.2;
    return ([x, y]) => [h[0] + x * cs - y * sn, h[1] + x * sn + y * cs];
  };
  const front = CLIP?.front ? CLIP.front(side) : arms === 'hug' || (arms === 'chin' && side > 0);
  // US-120 · meditating hands: resting on the knees, fingers out, thumb and index touching in a ring (gyan mudra).
  const mudraTf = (t) => {
    const h = hand(t), rot = (side < 0 ? -70 : 70) * (Math.PI / 180);
    const cs = Math.cos(rot) * 1.25, sn = Math.sin(rot) * 1.25;
    return ([x, y]) => [h[0] + x * cs - y * sn, h[1] + x * sn + y * cs];
  };
  const ringAt = (t, r) => { const f = mudraTf(t); const c = f([side < 0 ? 4.6 : -4.6, -10.5]); return { c, d: r * 2.5 }; };
  const handItems = arms === 'knees'
    ? [
        group('ringHole', [ellipse((t) => ringAt(t).c.map(r2), [4.6, 4.6]), fill('#FFE7A3')]),
        group('ring', [ellipse((t) => ringAt(t).c.map(r2), [11.4, 11.4]), fill(C.hand)]),
        group('mitten', [pathKf((t) => toShape(SEG.MITTEN, mudraTf(t), true)), fill(C.hand)]),
      ]
    : [group('mitten', [pathKf((t) => toShape(SEG.MITTEN, handTf(t), true)), fill(C.hand)])];
  const lay = layer(side < 0 ? 'armL' : 'armR', [
    ...handItems,
    tube('arm', pathKf((t) => toShape(parsePath(`M${r2(shoulder(t)[0])} ${r2(shoulder(t)[1])} Q${r2(ctrl(t)[0])} ${r2(ctrl(t)[1])} ${r2(hand(t)[0])} ${r2(hand(t)[1])}`), ID, false))),
  ]);
  HANDS[side] = hand;
  return { lay, front };
};
const HANDS = {};

// ── embers, extras ────────────────────────────────────────────────────────────
const embers = () => [0, 1, 2].map((k) => {
  const off = (k * OP) / 3;
  const u = (t) => ((t + off) % OP) / OP;
  const x0 = [52, 66, 59][k];
  return layer(`ember${k}`, [group('e', [ellipse((t) => { const q = u(t); return [r2(x0 + 6 * Math.sin(q * TAU * 1.5 + k) + sway(t) * 0.6), r2(4 - q * 26)]; }, (t) => { const s = r2((k === 1 ? 4 : 3.2) * (1 - 0.5 * u(t))); return [s, s]; }), fill(k === 1 ? '#FFD23F' : '#FFB547')])], {
    o: kf((t) => { const q = u(t); return [r2(100 * (q < 0.1 ? q / 0.1 : q > 0.7 ? Math.max(0, (1 - q) / 0.3) : 1))]; }),
  });
});
const extrasFor = (mood) => {
  if (CLIP?.noExtras) return [];
  if (mood === 'proud') {
    return [layer('star', [group('star', [pathStill(toShape(SEG.STAR, ([x, y]) => [x + 6, y - 3], true)), stroke(2.5), fill('#FFD23F')])], {
      a: still([107, 19.5, 0]), p: still([107, 19.5, 0]), s: kf((t) => { const k = r2(100 + 7 * ph(t, 60)); return [k, k, 100]; }), r: kf((t) => [r2(8 * ph(t, 120))]),
    })];
  }
  if (mood === 'sleepy') {
    return [0, 1].map((k) => {
      const u = (t) => ((t + (k * OP) / 2) % OP) / OP;
      return layer(`z${k}`, [group('z', [line('M0 0 L8 0 L0 9 L8 9', 2.4)], {
        p: kf((t) => { const q = u(t); return [r2(92 + q * 16 + 2 * Math.sin(q * TAU)), r2(26 - q * 28)]; }),
        s: kf((t) => { const s = r2(70 + 50 * u(t)); return [s, s]; }),
      })], { o: kf((t) => { const q = u(t); return [r2(100 * (q < 0.15 ? q / 0.15 : q > 0.7 ? Math.max(0, (1 - q) / 0.3) : 1))]; }) });
    });
  }
  return [];
};

// ── US-120 · meditation: floating, crossed legs, aura ─────────────────────────
/** 0..1, up at 1: one slow rise and fall per loop, in step with the breath. */
const floatK = (t) => 0.5 + 0.5 * ph(t, 240, -Math.PI / 2);
function crossedLegs() {
  // a wide lap: thighs out to knees well past the body, shins folded across in front, shoe tips crossing in the middle.
  const thigh = (side) => (t) => { const h = flameAt(t)(side < 0 ? [50, 108] : [70, 108]); return toShape(parsePath(`M${r2(h[0])} ${r2(h[1])} Q${side < 0 ? 32 : 88} 112 ${side < 0 ? 21 : 99} 123`), ID, false); };
  return layer('legs', [
    group('shoes', [
      pathStill(toShape(SEG.SHOE, ([x, y]) => [62 + x * 1.1, 131 + y * 1.1], true)),
      pathStill(toShape(SEG.SHOE, ([x, y]) => [58 - x * 1.1, 131 + y * 1.1], true)),
      fill(C.shoe),
    ]),
    tube('shinR', pathStill(toShape(parsePath('M99 123 Q86 132 60 129'), ID, false))),
    tube('shinL', pathStill(toShape(parsePath('M21 123 Q34 132 60 129'), ID, false))),
    tube('thighL', pathKf(thigh(-1))),
    tube('thighR', pathKf(thigh(1))),
    // the lap between thighs and shins, in the limbs' shadow tone (no hole showing the aura through)
    group('lap', [pathStill(toShape(parsePath('M50 106 Q32 112 21 123 Q34 132 60 129 Q86 132 99 123 Q88 112 70 106 Z'), ID, true)), fill(C.limb)]),
  ]);
}
function aura() {
  const ring = (k) => {
    const u = (t) => ((t + k * 120) % 240) / 240; // two rings, half a loop apart
    return layer(`ring${k}`, [group('ring', [ellipse([60, 78], (t) => { const d = r2(92 + 60 * u(t)); return [d, d]; }), stroke(3, '#FFC94A')])], {
      o: kf((t) => { const q = u(t); return [r2(70 * (q < 0.15 ? q / 0.15 : 1 - (q - 0.15) / 0.85))]; }),
    }, { parent: FLOAT_IND });
  };
  const glow = layer('glow', [
    group('outer', [ellipse([60, 78], (t) => { const d = r2(120 + 10 * floatK(t)); return [d, d]; }), fill('#FFE7A3')]),
    group('inner', [ellipse([60, 80], (t) => { const d = r2(92 + 8 * floatK(t)); return [d, d]; }), fill('#FFD27A')]),
  ], { o: kf((t) => [r2(32 + 18 * floatK(t))]) }, { parent: FLOAT_IND });
  const motes = [0, 1, 2, 3].map((k) => {
    const u = (t) => ((t + k * 60) % 240) / 240;
    const x0 = [26, 94, 40, 82][k];
    return layer(`mote${k}`, [group('m', [ellipse((t) => [r2(x0 + 3 * Math.sin(u(t) * TAU + k)), r2(108 - u(t) * 70)], [3.2, 3.2]), fill('#FFB547')])], {
      o: kf((t) => { const q = u(t); return [r2(90 * (q < 0.2 ? q / 0.2 : q > 0.7 ? Math.max(0, (1 - q) / 0.3) : 1))]; }),
    }, { parent: FLOAT_IND });
  });
  return [...motes, ...[0, 1].map(ring), glow];
}

// ── one loop ──────────────────────────────────────────────────────────────────
function build(mood, opts = {}) {
  M = MOTION[mood];
  ind = 0;
  const moved = !!(CLIP?.lift || CLIP?.squash || CLIP?.rot);
  PARENT = opts.parent ?? (mood === 'meditate' ? FLOAT_IND : moved ? BODY_IND : ROOT_IND);
  const bodyShape = (t) => toShape(SEG.OUTER, flameAt(t), true);
  const coreShape = (t) => toShape(SEG.CORE, flameAt(t), true);
  // US-127: no outline; the side tip is its own shape behind the body
  const tip = layer('tip', [group('tip', [pathKf((t) => toShape(SEG.TIP, flameAt(t), true)), bodyFill('base')])]);
  const coreShade = masked('coreShade', [
    group('shine', [ellipse((t) => flameAt(t)([51, 64]).map(r2), [6.4, 12]), fill(C.coreShine)], { r: still(25) }),
    group('coreShadow', [pathKf((t) => toShape(SEG.CORE_SHADOW, flameAt(t), true)), bodyFill('coreShadow')]),
  ], coreShape);
  const core = masked('core', [group('core', [pathKf(coreShape), bodyFill('core')])], bodyShape);
  const bodyShade = masked('bodyShade', [group('shadow', [pathKf((t) => toShape(SEG.SHADE, flameAt(t), true)), bodyFill('shadow')])], bodyShape);
  const base = layer('base', [group('base', [pathKf(bodyShape), bodyFill('base')])]);
  const pose = opts.arms ?? DEFAULT_ARMS[mood];
  const arms = [armLayer(-1, pose), armLayer(1, pose)];
  const legs = mood === 'meditate' ? crossedLegs() : layer('legs', [
    group('shoes', [
      pathStill(toShape(SEG.SHOE, ([x, y]) => [46.5 - x * 1.4, 131 + y * 1.4], true)),
      ...(CLIP?.tap ? [] : [pathStill(toShape(SEG.SHOE, ([x, y]) => [73.5 + x * 1.4, 131 + y * 1.4], true))]),
      fill(C.shoe),
    ]),
    // US-123: the right shoe taps (rotates on its heel)
    ...(CLIP?.tap ? [group('tapShoe', [pathKf((t) => { const a = (CLIP.tap(t) * Math.PI) / 180, hx = 73.5 - 6.5 * 1.3, hy = 131; return toShape(SEG.SHOE, ([x, y]) => { const px = 73.5 + x * 1.4 - hx, py = 131 + y * 1.4 - hy; return [hx + px * Math.cos(a) - py * Math.sin(a), hy + px * Math.sin(a) + py * Math.cos(a)]; }, true); }), fill(C.shoe)])] : []),
    tube('legL', pathKf((t) => toShape(parsePath(`M${r2(flameAt(t)([51, 106])[0])} ${r2(flameAt(t)([51, 106])[1])} L45.5 126`), ID, false))),
    tube('legR', pathKf((t) => toShape(parsePath(`M${r2(flameAt(t)([69, 106])[0])} ${r2(flameAt(t)([69, 106])[1])} L74.5 126`), ID, false))),
  ]);
  const shadowLayerParent = opts.parent ? POP_IND : ROOT_IND;
  // US-123: props above / behind Flick (they hang from the root, not from his moving body)
  const keep = PARENT; PARENT = ROOT_IND;
  const over = CLIP?.over ? CLIP.over() : [];
  const under = CLIP?.under ? CLIP.under() : [];
  const mid = CLIP?.mid ? CLIP.mid() : [];
  PARENT = keep;
  const shadow = layer('shadow', [group('s', [ellipse([60, 134.5], (t) => [r2(72 * (1 - breathe(t) * 1.2) * (mood === 'meditate' ? 0.86 + 0.08 * floatK(t) : 1)), 7.2]), fill('#1E1A17', mood === 'meditate' ? 0.1 : 0.13)])], {}, { parent: shadowLayerParent });
  // Lottie draws the first layer on top.
  return {
    v: '5.9.0', fr: FR, ip: 0, op: OP, w: W, h: H, nm: `Flick 3.0 · ${mood}`, ddd: 0, assets: [],
    layers: [
      ...over, faceLayer(mood), ...extrasFor(mood), ...(mood === 'sleepy' || mood === 'meditate' || CLIP?.noEmbers ? [] : embers().map((e) => (opts.embersFrom ? { ...e, ip: opts.embersFrom } : e))),
      ...arms.filter((a) => a.front).map((a) => a.lay),
      ...mid,
      coreShade, core, bodyShade, base, tip,
      ...arms.filter((a) => !a.front).map((a) => a.lay),
      legs, ...under, ...(mood === 'meditate' ? aura() : []), shadow,
      ...(moved ? [{ ddd: 0, ind: BODY_IND, ty: 3, nm: 'body', sr: 1, ao: 0, ip: 0, op: OP, st: 0, bm: 0, parent: ROOT_IND, ks: { o: still(100), r: CLIP.rot ? kf((t) => [r2(CLIP.rot(t))]) : still(0), a: still([60, 134.5, 0]), p: kf((t) => { const [dx, dy] = CLIP.lift ? CLIP.lift(t) : [0, 0]; return [r2(60 + dx), r2(134.5 + dy), 0]; }), s: kf((t) => { const [sx, sy] = CLIP.squash ? CLIP.squash(t) : [1, 1]; return [r2(sx * 100), r2(sy * 100), 100]; }) } }] : []),
      ...(mood === 'meditate' ? [{ ddd: 0, ind: FLOAT_IND, ty: 3, nm: 'float', sr: 1, ao: 0, ip: 0, op: OP, st: 0, bm: 0, parent: ROOT_IND, ks: { o: still(100), r: still(0), a: still([0, 0, 0]), p: kf((t) => [0, r2(-6 - 4 * floatK(t)), 0]), s: still([100, 100, 100]) } }] : []),
      // the null parent: draft space → the 120 box (Mascot's FIT) → the padded canvas
      { ddd: 0, ind: ROOT_IND, ty: 3, nm: 'root', sr: 1, ao: 0, ip: 0, op: OP, st: 0, bm: 0, ks: { o: still(100), r: still(0), a: still([60, 134.5, 0]), p: still([PAD_X + 60, PAD_Y + 118, 0]), s: still([FIT * 100, FIT * 100, 100]) } },
    ],
  };
}

// ── US-121 · the launch clip ──────────────────────────────────────────────────
const ease = (a, b, t) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const outBack = (q) => { const c = 1.9; return 1 + (c + 1) * Math.pow(q - 1, 3) + c * Math.pow(q - 1, 2); };
/** Flick's size as he pops out of the ember: nothing, a little flame, a stretched jump, a squash, settled. */
function popScale(t) {
  if (t < 16) return [0, 0];
  if (t < 24) { const q = ease(16, 24, t); return [0.3 * q, 0.3 * q]; }
  if (t < 34) { const f = 0.02 * Math.sin(t); return [0.3 + f, 0.3 - f]; }
  if (t < 48) { const q = outBack(ease(34, 48, t)); return [0.3 + 0.7 * q * 0.96, 0.3 + 0.7 * q * 1.1]; }
  if (t < 56) { const q = ease(48, 56, t); return [0.96 + 0.1 * q, 1.1 - 0.17 * q]; }
  const q = ease(56, 66, t); return [1.06 - 0.06 * q, 0.93 + 0.07 * q];
}
function buildIgnite() {
  OP = 120;
  M = MOTION.happy;
  EYES = (t) => (t < 42 ? 0.08 : t < 48 ? 0.08 + 0.92 * ease(42, 48, t) : Math.max(0.08, 1 - Math.max(0, 1 - Math.abs(t - 96) / 4)));
  WAVE_K = (t) => ease(58, 70, t);
  const clip = build('happy', { arms: 'wave', parent: POP_IND, embersFrom: 50 });
  EYES = null; WAVE_K = () => 1;
  const R = (nm, shapes, ks = {}) => ({ ...layer(nm, shapes, ks), parent: ROOT_IND });
  const ember = R('ember', [
    group('core', [ellipse([60, 127], (t) => { const d = r2(7 + 2 * Math.sin(t / 2.2) + 6 * ease(8, 18, t)); return [d, d]; }), fill('#FFD23F')]),
    group('glow', [ellipse([60, 127], (t) => { const d = r2(16 + 4 * Math.sin(t / 2.2) + 20 * ease(8, 18, t)); return [d, d]; }), fill('#FFB547', 0.45)]),
  ], { o: kf((t) => [r2(100 * (1 - ease(20, 26, t)))]) });
  const smoke = [0, 1].map((k) => R(`smoke${k}`, [group('s', [ellipse((t) => [r2(60 + (k ? 4 : -3) + 2 * Math.sin(t / 3)), r2(120 - t * 1.6 - k * 6)], (t) => { const d = r2(5 + t * 0.25); return [d, d]; }), fill('#BDB5AD')])], { o: kf((t) => [r2(60 * (1 - ease(6 + k * 3, 18, t)) * ease(0, 3, t))]) }));
  const flash = R('flash', [group('ring', [ellipse([60, 112], (t) => { const d = r2(10 + 130 * ease(18, 38, t)); return [d, d]; }), stroke(4, '#FFD23F')])], { o: kf((t) => [r2(t < 18 ? 0 : 90 * (1 - ease(18, 38, t)))]) });
  const burst = Array.from({ length: 8 }, (_, k) => {
    const a = (k / 8) * TAU - Math.PI / 2;
    return R(`spark${k}`, [group('p', [ellipse((t) => { const q = ease(18, 40, t); const d = 8 + 46 * (1 - Math.pow(1 - q, 2)); return [r2(60 + Math.cos(a) * d), r2(110 + Math.sin(a) * d)]; }, (t) => { const s = r2(4.5 * (1 - 0.5 * ease(18, 40, t))); return [s, s]; }), fill(k % 2 ? '#FFB547' : '#FF7A3A')])], { o: kf((t) => [r2(t < 18 ? 0 : 100 * (1 - ease(30, 40, t)))]) });
  });
  const stones = R('stones', [-30, -18, -6, 6, 18, 30].map((dx, k) => group(`stone${k}`, [ellipse([60 + dx, 135 + Math.abs(dx) * 0.12], [15, 9.2]), stroke(1.4, '#5E5247'), fill(k % 2 ? '#A69685' : '#8C7D6E')])));
  const pop = { ddd: 0, ind: POP_IND, ty: 3, nm: 'pop', sr: 1, ao: 0, ip: 0, op: OP, st: 0, bm: 0, parent: ROOT_IND, ks: { o: still(100), r: still(0), a: still([60, 134.5, 0]), p: still([60, 134.5, 0]), s: kf((t) => { const [x, y] = popScale(t); return [r2(x * 100), r2(y * 100), 100]; }) } };
  // stones under Flick's shoes, the effects in front of him
  const rootLayer = clip.layers.pop();
  clip.layers.push(stones, rootLayer, pop);
  clip.layers.unshift(flash, ...burst, ember, ...smoke);
  clip.nm = 'Flick 3.0 · ignite';
  return clip;
}

// ── US-123 · the unlock flow: six moments ──────────────────────────────────────
const rect = (p, size, r) => ({ ty: 'rc', p: still(p), s: still(size), r: still(r), d: 1 });
const pulse = (t, a, b) => (t < a || t > b ? 0 : Math.sin((Math.PI * (t - a)) / (b - a)));
/** A padlock standing on the ground at x; `open(t)` 0 = shut, 1 = shackle up. */
function padlock(x, open = () => 0, nm = 'padlock') {
  const y = 116;
  return layer(nm, [
    group('keyhole', [ellipse([x, y - 2], [5.2, 5.2]), rect([x, y + 3], [2.6, 7], 1.2), fill(C.ink)]),
    group('body', [rect([x, y], [34, 28], 6), stroke(3), fill('#FFC23D')]),
    group('bodyShade', [rect([x + 9, y + 2], [10, 22], 4), fill('#F2A81E')]),
    group('shackle', [pathStill(toShape(parsePath('M-10 0 L-10 -10 C-10 -24 10 -24 10 -10 L10 0'), ID, false)), stroke(3.6, '#B8B0A8'), stroke(8.4)], {
      // pivot on the right leg (anchor 10,0 → placed at x + 10) so it swings open from there
      p: kf((t) => [x + 10, r2(y - 12 - 9 * open(t))]), r: kf((t) => [r2(-14 * open(t))]), a: still([10, 0]),
    }),
  ]);
}
function sparksAt(cx, cy, from, to, n = 8, dist = 26, nm = 'click') {
  return Array.from({ length: n }, (_, k) => {
    const a = (k / n) * TAU - Math.PI / 2;
    return layer(`${nm}${k}`, [group('p', [ellipse((t) => { const q = ease(from, to, t); const d = 6 + dist * (1 - Math.pow(1 - q, 2)); return [r2(cx + Math.cos(a) * d), r2(cy + Math.sin(a) * d)]; }, (t) => { const s2 = r2(4 * (1 - 0.5 * ease(from, to, t))); return [s2, s2]; }), fill(k % 2 ? '#FFB547' : '#FFD23F')])], { o: kf((t) => [r2(t < from ? 0 : 100 * (1 - ease(from + (to - from) * 0.5, to, t)))]) });
  });
}
const firmBrows = 'M45 68.5 L54 71 M75 68.5 L66 71';
const sadBrows = 'M45 71 L53 67.5 M75 71 L67 67.5';
const down = (side, sh) => [sh[0] + side * 19, sh[1] + 22];

function withClip(clip, mood, frames, fn) {
  CLIP = clip; OP = frames;
  try { return fn ? fn() : build(mood); } finally { CLIP = null; EYES = null; OP = 240; }
}

const CLIPS = {
  // 1 · on guard: arms crossed in front of a big padlock, tapping his foot. Firm, friendly. (loop)
  guard: () => withClip({
    face: { brows: firmBrows, eyes: 'open', mouth: 'M54 91 Q60 94.5 66 91', look: (t) => [r2(1.2 * pulse(t, 140, 200)), 0] },
    hand: (side, t) => (side < 0 ? [67, 97 + 0.6 * ph(t, 120)] : [53, 97 + 0.6 * ph(t, 120, 1)]),
    front: () => true,
    tap: (t) => -18 * pulse(t % 60, 0, 14),
    under: () => [padlock(124)],
  }, 'focus', 240),

  // 2 · deflate: you said yes; the flame shrinks and dims with a long sigh. (once, holds the last frame)
  deflate: () => { EYES = (t) => (t < 8 ? 1 : Math.max(0.12, 1 - (t - 8) / 10)); return withClip({
    scale: (t) => 1 - 0.2 * ease(6, 40, t),
    dim: (t) => 0.85 * ease(6, 40, t),
    lift: (t) => [0, r2(3 * ease(6, 40, t))],
    face: { brows: sadBrows, eyes: 'open', o: (t) => (t < 10 ? 0.1 : t < 38 ? 7 - 2 * ease(30, 38, t) : 4) },
    hand: (side, t, sh) => { const k = ease(6, 40, t); const d = down(side, sh); return [d[0] - side * 3 * k, d[1] + 5 * k]; },
    over: () => [0, 1, 2].map((k) => layer(`sigh${k}`, [group('puff', [ellipse((t) => { const q = ease(12 + k * 5, 46, t); return [r2(68 + 26 * q), r2(98 + 8 * q - 4 * Math.sin(q * 3))]; }, (t) => { const d = r2(5 + 9 * ease(12 + k * 5, 46, t)); return [d, d]; }), fill('#FFFFFF')])], { o: kf((t) => [r2(t < 12 + k * 5 ? 0 : 80 * (1 - ease(26 + k * 5, 50, t)))]) })),
  }, 'worried', 54); },

  // 3 · shows the stakes: holds up a sign with an hourglass, pleading a little. (loop)
  remind: () => withClip({
    face: { brows: sadBrows, eyes: 'open', mouth: 'M55 91.5 Q60 93.5 65 91.5', look: () => [1.4, -1.2] },
    hand: (side, t, sh) => (side < 0 ? down(side, sh) : [102 + 1.5 * ph(t, 120), 70 + 1.2 * ph(t, 60)]),
    over: () => {
      const h = (t) => HANDS[1](t);
      const tilt = (t) => r2(6 * ph(t, 120, 0.8));
      return [layer('sign', [
        group('glyph', [pathStill(toShape(parsePath('M-6 -9 L6 -9 L0 0 L6 9 L-6 9 L0 0 Z'), ID, true)), stroke(2.2), fill('#FFD95C')], { p: still([0, -30]) }),
        group('board', [rect([0, -30], [36, 30], 6), stroke(3), fill('#FFF8F6')]),
        group('stick', [pathStill(toShape(parsePath('M0 -16 L0 -6'), ID, false)), stroke(3.4, '#B5793A'), stroke(7)]),
      ], { p: kf((t) => [r2(h(t)[0]), r2(h(t)[1]), 0]), r: kf((t) => [tilt(t)]) })];
    },
  }, 'worried', 240),

  // 4 · watches you type: eyes down on your words, hands clasped, a small nod now and then. (loop; the app nods on each word)
  watch: () => withClip({
    face: { brows: 'M45.5 69 Q50 67 54 68.5 M66 68.5 Q70 67 74.5 69', eyes: 'open', mouth: 'M55.5 91 Q60 93 64.5 91', look: (t) => [-1.4, r2(1.8 + 0.6 * pulse(t % 80, 0, 16))] },
    hand: (side, t) => (side < 0 ? [56, 104] : [64, 104]),
    front: () => true,
    lift: (t) => [0, r2(1.2 * pulse(t % 80, 0, 16))],
  }, 'think', 240),

  // 5 · victory: kept it blocked; two jumps with fist pumps, the padlock snaps shut, confetti. (once → proud)
  victory: () => withClip({
    face: { eyes: 'closed' },
    lift: (t) => [0, r2(-22 * (pulse(t, 10, 34) + pulse(t, 44, 68)))],
    squash: (t) => { const c = pulse(t, 2, 10) + pulse(t, 34, 42) + pulse(t, 68, 78); return [r2(1 + 0.08 * c), r2(1 - 0.1 * c)]; },
    hand: (side, t, sh) => [sh[0] + side * 14, r2(sh[1] - 28 - 6 * Math.abs(Math.sin(t / 4.5)))],
    raised: () => true,
    under: () => [padlock(126, (t) => 1 - outBack(ease(20, 28, t)))],
    over: () => [
      ...sparksAt(126, 100, 24, 44, 8, 24, 'click'),
      ...Array.from({ length: 16 }, (_, k) => {
        const x0 = 10 + ((k * 37) % 120), sp = 0.8 + ((k * 13) % 7) / 10, col = ['#FF6A2B', '#FFD23F', '#4C6FFF', '#2D8A5F', '#E5484D', '#8E5CF6'][k % 6];
        return layer(`confetti${k}`, [group('c', [rect([0, 0], [5, 8], 1), fill(col)], {
          p: kf((t) => [r2(x0 + 6 * Math.sin(t / 9 + k)), r2(-20 + Math.max(0, t - 20 - (k % 5) * 3) * sp * 1.4)]),
          r: kf((t) => [r2((t * (k % 2 ? 9 : -7)) % 360)]),
        })], { o: kf((t) => [t < 20 ? 0 : r2(100 * (1 - ease(130, 150, t)))]) });
      }),
    ],
  }, 'happy', 150),

  // US-126 · cheer: a new world unlocked; the victory jumps and fist pumps, no padlock, no confetti of its own
  // (the reveal screen throws it). (once → proud)
  cheer: () => withClip({
    face: { eyes: 'closed' },
    lift: (t) => [0, r2(-22 * (pulse(t, 10, 34) + pulse(t, 44, 68)))],
    squash: (t) => { const c = pulse(t, 2, 10) + pulse(t, 34, 42) + pulse(t, 68, 78); return [r2(1 + 0.08 * c), r2(1 - 0.1 * c)]; },
    hand: (side, t, sh) => [sh[0] + side * 14, r2(sh[1] - 28 - 6 * Math.abs(Math.sin(t / 4.5)))],
    raised: () => true,
    over: () => sparksAt(60, 14, 30, 50, 8, 26, 'cheer'),
  }, 'happy', 110),

  // 6a · reluctant key: unlocked anyway; he holds out a key, lets it go, sighs. (once → hourglass)
  key: () => withClip({
    face: { brows: sadBrows, eyes: 'open', mouth: 'M54 93 Q60 90 66 93', look: (t) => [r2(1.6 * ease(10, 24, t)), 0] },
    hand: (side, t, sh) => {
      if (side < 0) return down(side, sh);
      const d = down(side, sh), out = [110, 90];
      const k = ease(8, 24, t) * (1 - ease(84, 100, t));
      return [r2(d[0] + (out[0] - d[0]) * k), r2(d[1] + (out[1] - d[1]) * k)];
    },
    over: () => {
      const h = (t) => HANDS[1](t);
      return [layer('key', [
        group('teeth', [pathStill(toShape(parsePath('M4 0 L18 0 L18 5 M13 0 L13 4'), ID, false)), stroke(3.2)]),
        group('bow', [ellipse([-2, 0], [11, 11]), stroke(2.6), fill('#FFC23D')]),
        group('hole', [ellipse([-2, 0], [3.6, 3.6]), fill(C.ink)]),
      ], {
        p: kf((t) => { const g = ease(66, 90, t); const [x, y] = h(t); return [r2(x + 4 + 60 * g), r2(y - 6 - 30 * g + 40 * g * g), 0]; }),
        r: kf((t) => [r2(-20 + 220 * ease(66, 90, t))]),
        o: kf((t) => [r2(100 * (1 - ease(80, 92, t)))]),
      })];
    },
  }, 'worried', 120),

  // 6b · beside an hourglass, watching your minutes run. (loop)
  hourglass: () => withClip({
    face: { brows: 'M45.5 69.5 Q50 67.5 54 68.5 M66 68.5 Q70 67.5 74.5 69.5', eyes: 'open', mouth: 'M55.5 91 Q60 92.5 64.5 91', look: () => [1.6, 0.8] },
    under: () => {
      const x = 126, y = 112;
      return [layer('hourglass', [
        group('stream', [pathStill(toShape(parsePath(`M${x} ${y - 2} L${x} ${y + 14}`), ID, false)), { ty: 'st', c: still(rgb('#F2A81E')), o: kf((t) => [r2(70 + 30 * Math.abs(Math.sin(t / 3)))]), w: still(2.2), lc: 2, lj: 2, ml: 4 }]),
        group('sandTop', [pathStill(toShape(parsePath(`M${x - 10} ${y - 14} L${x + 10} ${y - 14} L${x} ${y - 2} Z`), ID, true)), fill('#FFC23D')]),
        group('sandBottom', [pathStill(toShape(parsePath(`M${x - 13} ${y + 20} Q${x} ${y + 6} ${x + 13} ${y + 20} Z`), ID, true)), fill('#FFC23D')]),
        group('glass', [pathStill(toShape(parsePath(`M${x - 14} ${y - 20} L${x + 14} ${y - 20} L${x + 2} ${y} L${x + 14} ${y + 20} L${x - 14} ${y + 20} L${x - 2} ${y} Z`), ID, true)), stroke(2.6), fill('#E8F4FF', 0.7)]),
        group('caps', [rect([x, y - 22], [36, 6], 3), rect([x, y + 22], [36, 6], 3), stroke(2.6), fill('#B5793A')]),
      ])];
    },
  }, 'calm', 240),
};

// ── US-124 · the Block tab's presets: Flick acting each one out (loops) ─────────
const steam = (x, y, nm = 'steam', drift = 0) => [0, 1, 2].map((k) => {
  const u = (t) => ((t + k * 80) % 240) / 240;
  return layer(`${nm}${k}`, [group('s', [pathKf((t) => { const q = u(t), yy = y - q * 22, xx = x + (k - 1) * 5 + drift * q; return toShape(parsePath(`M${r2(xx)} ${r2(yy)} Q${r2(xx + 4 * Math.sin(q * 6 + k))} ${r2(yy - 5)} ${r2(xx)} ${r2(yy - 10)}`), ID, false); }), stroke(2.6, '#A89A90')])], { o: kf((t) => { const q = u(t); return [r2(90 * (q < 0.2 ? q / 0.2 : 1 - (q - 0.2) / 0.8))]; }) });
});
const zzz = (x, y) => [0, 1, 2].map((k) => {
  const u = (t) => ((t + k * 80) % 240) / 240;
  return layer(`z${k}`, [group('z', [line('M0 0 L8 0 L0 9 L8 9', 2.6)], {
    p: kf((t) => { const q = u(t); return [r2(x + q * 22 + 3 * Math.sin(q * TAU)), r2(y - q * 34)]; }),
    s: kf((t) => { const s2 = r2(60 + 70 * u(t)); return [s2, s2]; }),
  })], { o: kf((t) => { const q = u(t); return [r2(100 * (q < 0.15 ? q / 0.15 : q > 0.7 ? Math.max(0, (1 - q) / 0.3) : 1))]; }) });
});
const PRESET_CLIPS = {
  // asleep in bed: lying on his side on a pillow, a night-blue starry blanket rising with each breath, z's drifting up.
  'preset-bedtime': () => withClip({
    rot: () => 90, lift: () => [-58, -24], squash: () => [0.95, 0.95],
    noExtras: true, noEmbers: true,
    face: { eyes: 'closed', brows: 'M45.5 70 Q50 68.5 54 69.5 M66 69.5 Q70 68.5 74.5 70', mouth: null, o: (t) => r2(4.4 + 1.2 * ph(t, 240, -Math.PI / 2)) },
    hand: (side) => (side < 0 ? [40, 100] : [80, 100]), front: () => false,
    under: () => [layer('bed', [
      group('pillow', [ellipse([84, 124], [76, 20]), stroke(2.6), fill('#FFFFFF')]),
      group('mattress', [rect([60, 128], [150, 16], 8), stroke(2.6), fill('#F3E3DA')]),
    ])],
    over: () => [
      layer('blanket', [
        group('fold', [pathStill(toShape(parsePath('M30 88 Q38 92 38 104'), ID, false)), stroke(2.2, '#34437A')]),
        group('stars', [...[0, 1, 2, 3, 4].map((k) => ellipse([[-4, 12, 26, 2, 20][k], [100, 92, 106, 116, 120][k]], [3.4, 3.4])), fill('#FFD95C')]),
        group('quilt', [pathStill(toShape(parsePath('M-16 130 L-16 92 Q-12 80 4 80 L28 80 Q40 82 42 98 Q44 116 40 130 Z'), ID, true)), stroke(2.8), fill('#4A5B9C')]),
      ], { p: kf((t) => [0, r2(-1.6 * (0.5 + 0.5 * ph(t, 240, -Math.PI / 2))), 0]) }),
      ...zzz(124, 84),
    ],
  }, 'sleepy', 240),

  // evening wind-down: eyes closed, a warm mug of tea in both hands, steam curling up.
  'preset-winddown': () => withClip({
    noEmbers: true,
    face: { eyes: 'closed', brows: 'M45.5 69.5 Q50 67.5 54 68.5 M66 68.5 Q70 67.5 74.5 69.5', mouth: 'M55.5 90.5 Q60 93.5 64.5 90.5' },
    hand: (side, t) => (side < 0 ? [45.5, 112 + 0.8 * ph(t, 240)] : [74.5, 112 + 0.8 * ph(t, 240)]), front: () => true,
    // the steam curls up and away to his right, never across his face
    over: () => steam(78, 100, 'steam', 26),
    mid: () => [
      layer('mug', [
        group('heart', [pathStill(toShape(parsePath('M60 111 C55 107 56 103 60 105.5 C64 103 65 107 60 111 Z'), ID, true)), fill('#FF6A2B')]),
        group('tea', [rect([60, 99], [24, 3.6], 1.8), fill('#B5793A')]),
        group('cup', [rect([60, 108], [28, 22], 5), stroke(2.6), fill('#FFFFFF')]),
      ], { p: kf((t) => [0, r2(0.8 * ph(t, 240)), 0]) }),
    ],
  }, 'calm', 240),

  // morning focus: a big stretch, arms up, as the sun rises behind the hill.
  'preset-morning': () => withClip({
    face: { eyes: 'closed', o: (t) => r2(3 + 4 * Math.max(0, ph(t, 240, -Math.PI / 2))) },
    hand: (side, t, sh) => [r2(sh[0] + side * (12 + 4 * Math.max(0, ph(t, 240, -Math.PI / 2)))), r2(sh[1] - 34 - 6 * Math.max(0, ph(t, 240, -Math.PI / 2)))],
    raised: () => true,
    squash: (t) => { const k = Math.max(0, ph(t, 240, -Math.PI / 2)); return [r2(1 - 0.03 * k), r2(1 + 0.05 * k)]; },
    under: () => [layer('sunrise', [
      group('hill', [pathStill(toShape(parsePath('M-30 132 Q60 104 150 132 L150 140 L-30 140 Z'), ID, true)), fill('#B8DDA0')]),
      group('sun', [ellipse([112, 0], [40, 40]), fill('#FFD23F')], { p: kf((t) => [0, r2(96 - 10 * (0.5 + 0.5 * ph(t, 240, -Math.PI / 2)))]) }),
      group('glow', [ellipse([112, 0], [58, 58]), fill('#FFE7A3', 0.6)], { p: kf((t) => [0, r2(96 - 10 * (0.5 + 0.5 * ph(t, 240, -Math.PI / 2)))]) }),
    ])],
  }, 'happy', 240),

  // work hours: behind a little laptop, focused, both hands tapping, a coffee beside him.
  'preset-work': () => withClip({
    noEmbers: true,
    face: { look: () => [0, 1.4] },
    hand: (side, t) => (side < 0 ? [50, r2(103 - 2.2 * Math.max(0, Math.sin(t / 2.1)))] : [70, r2(103 - 2.2 * Math.max(0, Math.sin(t / 2.1 + 1.7)))]), front: () => true,
    over: () => [
      layer('laptop', [
        group('logo', [ellipse([60, 112], [6, 6]), fill('#FFFFFF', 0.8)]),
        group('lid', [rect([60, 112], [44, 26], 4), stroke(2.6), fill('#8C99A8')]),
        group('base', [rect([60, 126], [56, 6], 3), stroke(2.6), fill('#B8C2CC')]),
      ]),
      layer('coffee', [
        group('cup', [rect([102, 120], [14, 16], 3), stroke(2.4), fill('#FFFFFF')]),
        group('coffee', [rect([102, 113.4], [11, 2.6], 1.3), fill('#7A4A2A')]),
      ]),
      ...steam(102, 108, 'cofsteam'),
    ],
  }, 'focus', 240),

  // dinner time: at the table with a plate, lifting his fork, a little heart now and then.
  'preset-dinner': () => withClip({
    noEmbers: true,
    face: { eyes: 'closed' },
    hand: (side, t, sh) => {
      if (side < 0) return [46, 112];
      const k = Math.max(0, Math.sin((TAU * t) / 120)); // the fork goes up to his mouth twice a loop
      return [r2(74 - 8 * k), r2(112 - 16 * k)];
    },
    front: () => true,
    over: () => [
      layer('fork', [group('fork', [pathStill(toShape(parsePath('M0 0 L0 -14 M-3 -14 L-3 -20 M0 -14 L0 -20 M3 -14 L3 -20 M-3 -14 L3 -14'), ID, false)), stroke(2.2, '#B8C2CC'), stroke(4.6)])], {
        p: kf((t) => { const h = HANDS[1](t); return [r2(h[0] + 2), r2(h[1] - 4), 0]; }), r: kf((t) => [r2(-20 * Math.max(0, Math.sin((TAU * t) / 120)))]),
      }),
      layer('plate', [
        group('peas', [ellipse([66, 120], [5, 5]), ellipse([70, 122], [5, 5]), fill('#5BB062')]),
        group('food', [ellipse([56, 120], [14, 8]), fill('#FF9A52')]),
        group('plate', [ellipse([60, 123], [40, 12]), stroke(2.4), fill('#FFFFFF')]),
      ]),
      layer('table', [group('t', [rect([60, 132], [150, 12], 4), stroke(2.6), fill('#C98B4F')])]),
      layer('heart', [group('h', [pathStill(toShape(parsePath('M0 4 C-8 -2 -6 -9 0 -5 C6 -9 8 -2 0 4 Z'), ID, true)), stroke(2), fill('#E5484D')], {
        p: kf((t) => { const q = ((t + 60) % 240) / 240; return [r2(98 + 4 * Math.sin(q * TAU)), r2(70 - q * 30)]; }),
      })], { o: kf((t) => { const q = ((t + 60) % 240) / 240; return [r2(100 * (q < 0.15 ? q / 0.15 : q > 0.6 ? Math.max(0, (1 - q) / 0.4) : 1))]; }) }),
    ],
  }, 'happy', 240),
};

// ── US-129 · "N more years of …": Flick acting out each word (loops, 4 s; the word changes after 3.6 s) ─────────
/** Body space (hands) → canvas space (props), for a clip that moves / squashes Flick (no rotation). */
const toCanvas = (lift, squash) => (t, [x, y]) => { const [dx, dy] = lift ? lift(t) : [0, 0]; const [sx, sy] = squash ? squash(t) : [1, 1]; return [60 + dx + (x - 60) * sx, 134.5 + dy + (y - 134.5) * sy]; };
const lerp2 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const smooth = (q) => q * q * (3 - 2 * q);
/** 1 while shown, fading in over 4 frames from `from`, out over the loop's reset (216 → 232). */
const shownFrom = (from) => (t) => [r2(t < from ? 0 : 100 * Math.min(1, (t - from) / 4) * (1 - ease(216, 232, t)))];
const HEART = 'M0 5 C-10 -2 -7 -11 0 -6 C7 -11 10 -2 0 5 Z';

const BRICK_X = 108, BRICK_W = 27, BRICK_H = 13, BRICK_EVERY = 54;
const brickTop = (k) => 134.5 - BRICK_H * (k + 1);
/** Building: a brick drops in, Flick winds up and hammers it down; four bricks, a little wall. */
function buildingHand(t) {
  const k = Math.min(3, Math.floor(t / BRICK_EVERY)), u = t - k * BRICK_EVERY;
  const idle = [76, 98], wind = [70, 52], hit = [BRICK_X - 18, brickTop(k) - 8];
  if (t >= 4 * BRICK_EVERY) return { p: idle, a: 20 };
  if (u < 16) return { p: idle, a: 20 };
  if (u < 34) { const q = smooth(ease(16, 34, u)); return { p: lerp2(idle, wind, q), a: 20 - 70 * q }; }
  if (u < 40) { const q = ease(34, 40, u); return { p: lerp2(wind, hit, q * q), a: -50 + 140 * q * q }; }
  if (u < 46) return { p: hit, a: 90 };
  const q = smooth(ease(46, 54, u)); return { p: lerp2(hit, idle, q), a: 90 - 70 * q };
}
const ACTIVITY_CLIPS = {
  'act-building': () => {
    const lift = () => [-18, 0];
    const hitAt = (k) => k * BRICK_EVERY + 40;
    return withClip({
      lift,
      squash: (t) => { const c = [0, 1, 2, 3].reduce((m, k) => m + pulse(t, hitAt(k), hitAt(k) + 8), 0); return [r2(1 + 0.03 * c), r2(1 - 0.04 * c)]; },
      face: { look: (t) => (t % BRICK_EVERY < 14 ? [0.6, -0.6] : [1.5, 0.9]) },
      hand: (side, t, sh) => (side < 0 ? [sh[0] - 15, sh[1] + 20] : buildingHand(t).p.map((v, i) => (i ? v : v + 18))),
      front: (side) => side > 0,
      over: () => [
        layer('hammer', [
          group('head', [rect([0, -19], [17, 9], 2.5), stroke(2.4), fill('#9AA5B1')]),
          group('handle', [pathStill(toShape(parsePath('M0 4 L0 -15'), ID, false)), stroke(5, '#B5793A')]),
        ], { p: kf((t) => [...buildingHand(t).p.map(r2), 0]), r: kf((t) => [r2(buildingHand(t).a)]) }),
        ...[0, 1, 2, 3].flatMap((k) => sparksAt(BRICK_X, brickTop(k), hitAt(k), hitAt(k) + 14, 6, 18, `dust${k}`)),
      ],
      under: () => [0, 1, 2, 3].map((k) => {
        const drop = k * BRICK_EVERY + 2;
        const y = (t) => { const q = ease(drop, drop + 12, t); return brickTop(k) + BRICK_H - 44 * (1 - q * q) - 3 * pulse(t, drop + 12, drop + 18); };
        return layer(`brick${k}`, [
          group('shine', [rect([-2, -BRICK_H + 3], [BRICK_W - 8, 2.4], 1.2), fill('#F7A27C')]),
          group('brick', [rect([0, -BRICK_H / 2], [BRICK_W, BRICK_H], 2.5), stroke(2.4), fill('#E2673F')]),
        ], {
          p: kf((t) => [BRICK_X, r2(y(t)), 0]),
          s: kf((t) => { const c = pulse(t, hitAt(k), hitAt(k) + 8); return [r2(100 + 14 * c), r2(100 - 16 * c), 100]; }),
          o: kf(shownFrom(drop)),
        });
      }),
    }, 'happy', 240);
  },

  'act-training': () => {
    // four reps: squat with the bar at the chest, press it overhead, hold, lower
    const rep = (t) => { const u = t % 60; return u < 10 ? 0 : u < 24 ? smooth(ease(10, 24, u)) : u < 34 ? 1 : 1 - smooth(ease(34, 56, u)); };
    const squash = (t) => { const k = rep(t); return [r2(1.05 - 0.07 * k), r2(0.92 + 0.11 * k)]; };
    const hand = (side, t) => [side < 0 ? 38 : 82, r2(88 - 42 * rep(t))];
    const at = toCanvas(null, squash);
    const barY = (t) => at(t, hand(1, t))[1] - 2;
    const barX = (t, side) => at(t, hand(side, t))[0];
    const plate = (side, nm) => group(nm, [rect([0, 0], [9, 28], 3), fill('#4A5B9C'), stroke(2.4)], { p: kf((t) => [r2(barX(t, side) + side * 20), r2(barY(t))]) });
    return withClip({
      squash,
      face: { brows: firmBrows, eyes: 'open', mouth: 'M54 91 Q60 94.5 66 91', look: () => [0, -0.8] },
      hand, front: () => true,
      mid: () => [layer('barbell', [
        plate(-1, 'plateL'), plate(1, 'plateR'),
        group('bar', [pathKf((t) => toShape(parsePath(`M${r2(barX(t, -1) - 26)} ${r2(barY(t))} L${r2(barX(t, 1) + 26)} ${r2(barY(t))}`), ID, false)), stroke(4.6, '#6B5B53')]),
      ])],
      over: () => [0, 1, 2, 3].flatMap((k) => [-1, 1].map((side) => {
        const from = k * 60 + 24;
        const u = (t) => ease(from, from + 18, t);
        return layer(`sweat${k}${side}`, [group('d', [pathStill(toShape(parsePath('M0 -5 C3 0 4 3 0 5 C-4 3 -3 0 0 -5 Z'), ID, true)), fill('#7CC6F2')], {
          p: kf((t) => [r2(60 + side * (24 + 16 * u(t))), r2(44 - 10 * Math.sin(Math.PI * u(t)) + 14 * u(t))]),
        })], { o: kf((t) => [r2(t < from || t > from + 18 ? 0 : 100 * (1 - u(t)))]) });
      })),
    }, 'focus', 240);
  },

  'act-learning': () => {
    const aha = 150;
    const lift = (t) => [0, r2(-12 * pulse(t, aha + 4, aha + 20))];
    const page = (from) => (t) => { const q = smooth(ease(from, from + 18, t)); return [r2(100 - 200 * q), 100]; };
    return withClip({
      lift,
      face: { eyes: 'open', mouth: 'M55 91 Q60 94 65 91', look: (t) => (t < aha ? [r2(0.5 * Math.sin(t / 9)), 1.8] : [0.6, -1.8]) },
      hand: (side, t) => (t < aha + 2 ? [side < 0 ? 42 : 78, 102] : side > 0 ? [96, 52] : [42, 110]),
      raised: (side, t) => side > 0 && t >= aha + 2,
      front: () => true,
      mid: () => [layer('book', [
        ...[30, 96].map((from, k) => group(`flip${k}`, [rect([13, 0], [26, 30], 2), stroke(2), fill('#FFF8EC')], { a: still([0, 0]), p: still([60, 96]), s: kf(page(from)), o: kf((t) => [t < from || t > from + 18 ? 0 : 100]) })),
        ...[0, 1, 2].flatMap((k) => [line(`M${36} ${88 + k * 6} L${54} ${88 + k * 6}`, 1.8, '#C9B8A6'), line(`M${66} ${88 + k * 6} L${84} ${88 + k * 6}`, 1.8, '#C9B8A6')]),
        group('pages', [rect([47, 96], [26, 30], 2), rect([73, 96], [26, 30], 2), stroke(2), fill('#FFFFFF')]),
        group('cover', [rect([60, 98], [58, 34], 4), stroke(2.4), fill('#4A5B9C')]),
      ], { p: kf((t) => { const [dx, dy] = lift(t); return t < aha + 2 ? [dx, dy, 0] : [dx, r2(dy + 40), 0]; }), o: kf((t) => [t < aha + 2 ? 100 : 0]) })],
      over: () => [
        layer('bulb', [
          ...[0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * TAU - Math.PI / 2; return line(`M${r2(Math.cos(a) * 18)} ${r2(Math.sin(a) * 18)} L${r2(Math.cos(a) * 25)} ${r2(Math.sin(a) * 25)}`, 3, '#FFB020'); }),
          group('base', [rect([0, 13], [10, 7], 2), stroke(2.2), fill('#A89A90')]),
          group('glass', [ellipse([0, 0], [24, 24]), stroke(2.4), fill('#FFE14D')]),
        ], {
          p: still([90, 20, 0]),
          s: kf((t) => { const q = ease(aha, aha + 12, t); const k = t < aha ? 0 : outBack(q) * (1 + 0.06 * ph(t, 30)); return [r2(100 * k), r2(100 * k), 100]; }),
          o: kf((t) => [r2(t < aha ? 0 : 100 * (1 - ease(216, 230, t)))]),
        }),
        ...sparksAt(90, 20, aha, aha + 20, 8, 30, 'aha'),
      ],
    }, 'happy', 240);
  },

  'act-earning': () => {
    const lift = () => [-16, 0];
    const EVERY = 50, STACK_X = 106, COIN_H = 6;
    const coinTop = (k) => 129 - COIN_H * k; // k = 0 is the coin already there
    const hand = (side, t, sh) => {
      if (side < 0) return [sh[0] - 15, sh[1] + 20];
      const u = t % EVERY;
      if (t >= 4 * EVERY) return [96, 98];
      if (u < 8) return lerp2([96, 98], [94, 105], smooth(u / 8));
      if (u < 14) return lerp2([94, 105], [100, 80], smooth((u - 8) / 6));
      return lerp2([100, 80], [96, 98], smooth(ease(14, 30, u)));
    };
    const coin = (nm, extra) => layer(nm, [group('edge', [ellipse([0, 2.4], [24, 9]), stroke(2.2), fill('#E0A100')]), group('face', [ellipse([0, 0], [24, 9]), stroke(2.2), fill('#FFC93C')])], extra);
    return withClip({
      lift,
      face: { look: (t) => { const u = t % EVERY; return u > 12 && u < 36 && t < 4 * EVERY ? [1.5, -1.2] : [1.4, 0.8]; } },
      hand, front: (side) => side > 0,
      under: () => [coin('coin0', { p: still([STACK_X, coinTop(0), 0]), o: kf((t) => [r2(100 * (1 - ease(216, 232, t)))]) })],
      over: () => [1, 2, 3, 4].flatMap((k) => {
        const from = (k - 1) * EVERY + 12, land = from + 22;
        const start = (t) => { const [hx, hy] = hand(1, Math.min(t, from), [0, 0]); return [hx - 16, hy - 4]; };
        const pos = (t) => {
          if (t >= land) return [STACK_X, coinTop(k) + 2 * pulse(t, land, land + 6)];
          const q = ease(from, land, t), [sx, sy] = start(from);
          return [sx + (STACK_X - sx) * q, sy + (coinTop(k) - sy) * q - 48 * Math.sin(Math.PI * q)];
        };
        return [
          coin(`coin${k}`, { p: kf((t) => [...pos(t).map(r2), 0]), s: kf((t) => [t < land ? r2(100 * Math.abs(Math.cos((t - from) / 3))) : 100, 100, 100]), o: kf(shownFrom(from)) }),
          ...sparksAt(STACK_X, coinTop(k), land, land + 14, 6, 18, `clink${k}`),
        ];
      }),
    }, 'happy', 240);
  },

  'act-loving': () => {
    const close = (t) => smooth(ease(24, 60, t)) * (1 - smooth(ease(212, 236, t)));
    const lift = (t) => [r2(-16 + 10 * close(t)), 0];
    const partnerX = (t) => r2(124 - 22 * close(t));
    const P = (x, y) => [(x - 60) * 0.6, (y - 113) * 0.6];
    const partner = layer('partner', [
      group('face', [line('M-11 -26 Q-7.5 -29.5 -4 -26', 2.4), line('M4 -26 Q7.5 -29.5 11 -26', 2.4), line('M-4 -18 Q0 -14.5 4 -18', 2.4, C.mouth), ellipse([-13, -19], [6.4, 4]), ellipse([13, -19], [6.4, 4]), fill('#FF5A7A', 0.5)]),
      group('core', [pathStill(toShape(SEG.CORE, ([x, y]) => P(x, y), true)), fill('#FFC2D1')]),
      group('shade', [pathStill(toShape(SEG.SHADE, ([x, y]) => P(x, y), true)), fill('#EC5A84')]),
      group('body', [pathStill(toShape(SEG.OUTER, ([x, y]) => P(x, y), true)), fill('#FF7A9C')]),
      group('tip', [pathStill(toShape(SEG.TIP, ([x, y]) => P(120 - x, y), true)), fill('#FF7A9C')]),
    ], { p: kf((t) => [partnerX(t), r2(132 - 2 * Math.abs(ph(t, 60))), 0]), r: kf((t) => [r2(-6 * close(t) + 3 * ph(t, 120))]) });
    return withClip({
      lift, rot: (t) => r2(5 * close(t)),
      face: { eyes: 'closed' },
      hand: (side, t, sh) => (side < 0 ? [sh[0] - 14, sh[1] + 18] : lerp2([sh[0] + 19, sh[1] + 22], [partnerX(t) + 14 - lift(t)[0], 104], close(t)).map(r2)),
      front: (side) => side > 0,
      under: () => [partner],
      over: () => [0, 1, 2, 3].map((k) => {
        const from = 64 + k * 34, u = (t) => ease(from, from + 60, t);
        return layer(`heart${k}`, [group('h', [pathStill(toShape(parsePath(HEART), ID, true)), fill(k % 2 ? '#FF5A7A' : '#E5484D')], {
          p: kf((t) => [r2(92 + (k % 2 ? 8 : -6) * Math.sin(u(t) * TAU)), r2(70 - 66 * u(t))]),
          s: kf((t) => { const s2 = r2(60 + 70 * outBack(Math.min(1, u(t) * 3))); return [s2, s2]; }),
        })], { o: kf((t) => [r2(t < from ? 0 : 100 * (1 - ease(from + 40, from + 60, t)))]) });
      }),
    }, 'happy', 240);
  },

  'act-living': () => {
    const beat = (t) => pulse(t % 30, 0, 18); // a hop every half second
    const side = (t) => Math.sin((TAU * t) / 120); // swaying left / right
    return withClip({
      lift: (t) => [r2(6 * side(t)), r2(-12 * beat(t))],
      squash: (t) => { const c = pulse(t % 30, 22, 30); return [r2(1 + 0.06 * c), r2(1 - 0.08 * c)]; },
      rot: (t) => r2(8 * side(t)),
      face: { eyes: 'closed' },
      hand: (s, t, sh) => { const up = s > 0 ? side(t) > 0 : side(t) <= 0; return up ? [sh[0] + s * 14, r2(sh[1] - 32 + 3 * ph(t, 30))] : [sh[0] + s * 18, sh[1] + 18]; },
      raised: () => true,
      under: () => [layer('sun', [
        group('rays', Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * TAU; return line(`M${r2(Math.cos(a) * 30)} ${r2(Math.sin(a) * 30)} L${r2(Math.cos(a) * 40)} ${r2(Math.sin(a) * 40)}`, 6, k % 2 ? '#FFC93C' : '#FF8C1A'); }), { r: kf((t) => [r2(t * 0.75)]) }),
        group('disc', [ellipse([0, 0], [46, 46]), fill('#FFC93C')]),
      ], { p: still([116, 18, 0]) })],
      over: () => [0, 1, 2].map((k) => {
        const u = (t) => ((t + k * 80) % 240) / 240;
        return layer(`note${k}`, [group('n', [
          pathStill(toShape(parsePath('M0 0 L0 -15 L9 -18 L9 -4'), ID, false)), stroke(2.6),
          ellipse([-2.6, 0.5], [7, 5.4]), ellipse([6.4, -3.5], [7, 5.4]), fill(C.ink),
        ], { p: kf((t) => [r2((k % 2 ? 4 : 106) + 10 * Math.sin(u(t) * TAU)), r2(80 - 70 * u(t))]) })], {
          o: kf((t) => { const q = u(t); return [r2(100 * (q < 0.12 ? q / 0.12 : q > 0.7 ? Math.max(0, (1 - q) / 0.3) : 1))]; }),
        });
      }),
    }, 'happy', 240);
  },
};

const MOODS = Object.keys(MOTION);
mkdirSync(OUT, { recursive: true });
let total = 0;
for (const mood of MOODS) {
  const json = JSON.stringify(build(mood));
  total += json.length;
  writeFileSync(join(OUT, `flick-${mood}.json`), json);
}
for (const [name, make] of Object.entries({ ...CLIPS, ...PRESET_CLIPS, ...ACTIVITY_CLIPS })) { const json = JSON.stringify(make()); total += json.length; writeFileSync(join(OUT, `flick-${name}.json`), json); }
OP = 240;
{ const json = JSON.stringify(buildIgnite()); total += json.length; writeFileSync(join(OUT, 'flick-ignite.json'), json); OP = 240; }
writeFileSync(join(OUT, 'flick-frame.json'), JSON.stringify({ w: W, h: H, padX: PAD_X, padY: PAD_Y }));
console.log(`wrote ${MOODS.length} moods to assets/lottie/ (${(total / 1024).toFixed(0)} KB, ${OP / FR}s @ ${FR}fps)`);
