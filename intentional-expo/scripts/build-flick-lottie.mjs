#!/usr/bin/env node
/**
 * US-118 · Flick as Lottie animations, generated from the same drawing as components/onboarding/Mascot.tsx
 * (a healthy flame), one idle loop per mood. Reproducible: `node scripts/build-flick-lottie.mjs`
 *   → assets/lottie/flick-<mood>.json  (happy, calm, worried, sleepy, focus, proud, think, shock)
 *
 * Why a script and not After Effects: a Lottie file is JSON. Every motion here comes from smooth,
 * periodic functions sampled into keyframes, so the loop is seamless and the numbers are tunable.
 *
 * Idle loop (4 s at 60 fps):
 *   - the flame itself bends: the tip sways and licks, the body breathes (taller/narrower), the core follows;
 *   - the face rides the flame, arms hang from shoulders that move with it and swing a little;
 *   - blinks (one single, one double), a glance left and right with the pupils;
 *   - three embers rise off the tip and fade; the ground shadow breathes with the flame.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FR = 60;
const PAD_X = 6, PAD_Y = 14; // room for the tip to stretch and the embers to rise
const W = 120 + PAD_X * 2, H = 120 + PAD_Y + 4;
const OP = 240; // 4 s
const STEP = 4; // a keyframe every 3 frames (20/s), linear between: smooth because the source curves are smooth
const TAU = Math.PI * 2;

// ── the drawing (Mascot.tsx) ──────────────────────────────────────────────────
const OUTER = 'M60 6 C66 22 90 38 92 70 C94 96 78 112 60 112 C42 112 26 98 28 72 C29 56 38 46 44 40 C44 48 47 53 51 55 C49 38 52 20 60 6 Z';
const CORE = 'M60 44 C66 55 81 62 81 81 C81 96 72 105 60 105 C48 105 39 96 39 82 C39 67 54 60 60 44 Z';
const INK = '#1E1A17';
const S = 0.965; // flame scale at intensity 0.75 (Mascot: 0.68 + 0.38 * i)
const LIFT = -8; // the body sits on its legs

// ── tiny helpers ──────────────────────────────────────────────────────────────
const rgb = (hex, a = 1) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
};
const r2 = (v) => Math.round(v * 10) / 10;
const frames = () => Array.from({ length: Math.floor(OP / STEP) + 1 }, (_, k) => Math.min(OP, k * STEP));
const LIN = { i: { x: [1], y: [1] }, o: { x: [0], y: [0] } };
const kf = (fn) => {
  const ts = frames();
  return { a: 1, k: ts.map((t, k) => (k < ts.length - 1 ? { t, s: fn(t), ...LIN } : { t, s: fn(t) })) };
};
const still = (v) => ({ a: 0, k: v });
const ph = (t, periodFrames, phase = 0) => Math.sin((TAU * t) / periodFrames + phase);

/** SVG path (absolute M/L/C/Q/Z) → list of cubic segments [[p0,c1,c2,p3], …] */
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
/** cubic segments (after mapping every point through `f`) → Lottie bezier shape */
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

// ── the motion ────────────────────────────────────────────────────────────────
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
};
let M = MOTION.happy;
const sway = (t) => M.sway * (2.6 * ph(t, 240) + 0.9 * ph(t, 80, 1.1)); // tip side to side
const lick = (t) => M.lick * (1.6 * ph(t, 48, 0.4) + 0.8 * ph(t, 30, 2.0)); // quick flicker near the tip
const breathe = (t) => M.breathe * (M.slow ? 0.034 * ph(t, 240, -Math.PI / 2) : 0.028 * ph(t, 120, -Math.PI / 2) + 0.012 * ph(t, 60, 0.7)); // taller / shorter

/** Base drawing → canvas (flame scale + lift), then the living bend. h = 0 at the base, 1 at the tip. */
function flameAt(t) {
  const b = breathe(t), sw = sway(t), lk = lick(t);
  return ([x, y]) => {
    const h = Math.max(0, Math.min(1, (112 - y) / 106));
    const bx = 60 + (x - 60) * S * (1 - 0.55 * b); // narrower as it stretches
    const by = 112 - (112 - y) * S * (1 + b);
    const dx = sw * h * h + lk * Math.pow(h, 4);
    return [bx + dx, by + LIFT];
  };
}
const OUTER_SEGS = parsePath(OUTER);
const CORE_SEGS = parsePath(CORE);

// face anchor rides the flame at the core's middle (60, 80)
const faceAt = (t) => flameAt(t)([60, 80]);
const FACE_SCALE = 0.5 + 0.5 * S;
const faceY0 = 112 - (112 - 80) * S + LIFT;

// blinks: single at 1.0 s, double at 2.9 s; glance left 1.6–2.2 s, right 3.3–3.7 s
const eyeOpen = (t) => {
  const dip = (c, w = 4) => Math.max(0, 1 - Math.abs(t - c) / w);
  return Math.max(0.08, 1 - Math.max(dip(60), dip(174), dip(186)));
};
const glance = (t) => {
  const win = (a, b, v) => (t < a || t > b ? 0 : t < a + 8 ? (v * (t - a)) / 8 : t > b - 8 ? (v * (b - t)) / 8 : v);
  return win(96, 132, -1.6) + win(198, 222, 1.4);
};

// ── layers ────────────────────────────────────────────────────────────────────
let ind = 0;
const TR = { ty: 'tr', p: still([0, 0]), a: still([0, 0]), s: still([100, 100]), r: still(0), o: still(100), sk: still(0), sa: still(0) };
const ROOT_IND = 1000;
const layer = (nm, shapes, ks = {}) => ({
  ddd: 0, ind: ++ind, ty: 4, nm, sr: 1, ao: 0, ip: 0, op: OP, st: 0, bm: 0, parent: ROOT_IND,
  ks: { o: still(100), r: still(0), p: still([0, 0, 0]), a: still([0, 0, 0]), s: still([100, 100, 100]), ...ks },
  shapes,
});
const group = (nm, items, tr = {}) => ({ ty: 'gr', nm, it: [...items, { ...TR, ...tr }] });
// Lottie ignores a colour's alpha: transparency goes in the fill's opacity.
const fill = (hex, a = 1) => ({ ty: 'fl', c: still(rgb(hex)), o: still(Math.round(a * 100)), r: 1 });
const stroke = (w, hex = INK) => ({ ty: 'st', c: still(rgb(hex)), o: still(100), w: still(w), lc: 2, lj: 2, ml: 4 });
const grad = (top, bottom, y0, y1) => ({ ty: 'gf', o: still(100), r: 1, t: 1, s: still([60, y0]), e: still([60, y1]), g: { p: 2, k: still([0, ...rgb(top).slice(0, 3), 1, ...rgb(bottom).slice(0, 3)]) } });
const ellipse = (p, s) => ({ ty: 'el', p: typeof p === 'function' ? kf(p) : still(p), s: typeof s === 'function' ? kf(s) : still(s), d: 1 });
const pathKf = (fn) => ({ ty: 'sh', ks: { a: 1, k: frames().map((t, k, all) => (k < all.length - 1 ? { t, s: [fn(t)], i: { x: 1, y: 1 }, o: { x: 0, y: 0 } } : { t, s: [fn(t)] })) } });

// face: eyes, brows, mouth per mood (Mascot.tsx) — one layer moved with the flame
const line = (d, w = 3.2) => group('line', [{ ty: 'sh', ks: still(toShape(parsePath(d), (p) => p, false)) }, stroke(w)]);
const OPEN_EYES = new Set(['happy', 'worried', 'focus', 'think', 'shock']);
const faceLayer = (mood) => {
  const items = [];
  if (OPEN_EYES.has(mood)) {
    const big = mood === 'shock';
    const eye = (cx) => group('eye', [ellipse((t) => [r2(cx + glance(t)), 80], (t) => [big ? 8.8 : 7.2, r2((big ? 11.2 : 9.2) * eyeOpen(t))]), fill(INK)]);
    const hi = (cx) => group('highlight', [ellipse((t) => [r2(cx + glance(t) * 1.2), 78.2], (t) => { const d = eyeOpen(t) > 0.5 ? 2.6 : 0; return [d, d]; }), fill('#FFFFFF')]);
    items.push(hi(52.3), hi(70.3), eye(51), eye(69));
  } else if (mood === 'sleepy') {
    items.push(line('M46 79 Q50.5 82.5 55 79'), line('M65 79 Q69.5 82.5 74 79'), group('o', [ellipse([60, 92], [5.2, 6]), fill(INK)]));
  } else {
    items.push(line('M46 80 Q50.5 75.5 55 80'), line('M65 80 Q69.5 75.5 74 80'));
  }
  if (mood === 'worried') items.push(line('M45 72 L53 68', 2.8), line('M75 72 L67 68', 2.8));
  if (mood === 'think') items.push(line('M65 69 L74 67', 2.8));
  if (mood === 'focus') items.push(line('M45 69 L54 72.5', 2.8), line('M75 69 L66 72.5', 2.8));
  const mouth = {
    happy: 'M53 89 Q60 97 67 89', proud: 'M53 89 Q60 97 67 89', calm: 'M55 90 Q60 94 65 90', focus: 'M54 91 Q60 94 66 91',
    think: 'M54 92 L66 90', worried: 'M53 93 Q56.5 89 60 92 Q63.5 95 67 91',
  }[mood];
  if (mouth) items.push(line(mouth, mood === 'calm' || mood === 'worried' ? 2.8 : 3.2));
  if (mood === 'shock') items.push(group('o', [ellipse([60, 93], [8.8, 10.4]), fill(INK)]));
  items.push(...[44, 76].map((cx) => group('cheek', [ellipse([cx, 88], [8, 8]), fill('#FF6F61', 0.35)])));
  return layer('face', items, {
    a: still([60, 80, 0]),
    p: kf((t) => { const [x, y] = faceAt(t); return [r2(x), r2(y), 0]; }),
    s: still([FACE_SCALE * 100, FACE_SCALE * 100, 100]),
  });
};

// arms: shoulders on the flame's sides, hands swinging gently (pendulum, out of phase)
const armPath = (from, to, side) => {
  const mx = (from[0] + to[0]) / 2 + side * 5, my = (from[1] + to[1]) / 2 + 3;
  return `M${from[0]} ${from[1]} Q${mx} ${my} ${to[0]} ${to[1]}`;
};
const DEFAULT_ARMS = { happy: 'down', calm: 'down', proud: 'star', worried: 'hug', sleepy: 'down', focus: 'down', think: 'chin', shock: 'cheer' };
/** Hand rest position from the shoulder (Mascot.tsx handsFor), in the 120 drawing. */
function handOffset(arms, side, shoulder) {
  const L = side < 0;
  switch (arms) {
    case 'cheer': return [shoulder[0] + side * 12, shoulder[1] - 24];
    case 'chin': return L ? [shoulder[0] - 9, shoulder[1] + 13] : [shoulder[0] - 14, shoulder[1] + 16];
    case 'hug': return [shoulder[0] - side * 6, shoulder[1] + 18];
    case 'star': return L ? [shoulder[0] - 9, shoulder[1] + 13] : [99, 40 + LIFT];
    default: return [shoulder[0] + side * 9, shoulder[1] + 13];
  }
}
const arm = (side, arms) => {
  const sx = side < 0 ? 31 : 89;
  const shoulder = (t) => flameAt(t)([sx, 84]);
  const hand = (t) => {
    const [x, y] = handOffset(arms, side, shoulder(t));
    const raised = arms === 'cheer' || (arms === 'star' && side > 0);
    const swing = M.swing * (1.4 * ph(t, 120, side < 0 ? 0 : Math.PI) + 0.5 * ph(t, 60, 1.3));
    const wave = raised ? 1.6 * ph(t, 40, side < 0 ? 0 : Math.PI) : 0; // raised hands wiggle
    return [x + (arms === 'chin' && side > 0 ? 0 : swing) + wave, y + 0.6 * M.swing * ph(t, 120, side < 0 ? 0.6 : 2.2) + (raised ? 0.8 * ph(t, 40, 1) : 0)];
  };
  return [
    group('hand', [ellipse((t) => hand(t).map(r2), [9.2, 9.2]), fill('#FFC94A'), stroke(2.2)]),
    group('arm', [pathKf((t) => toShape(parsePath(armPath(shoulder(t).map(r2), hand(t).map(r2), side)), (p) => p, false)), stroke(3.2)]),
  ];
};

/** The proud star (held up, twinkling) and the sleepy z's (drifting up). */
const extrasFor = (mood) => {
  if (mood === 'proud') {
    const star = 'M101 12 L104 20 L112 20 L106 25 L108 33 L101 28 L94 33 L96 25 L90 20 L98 20 Z';
    return [layer('star', [group('star', [{ ty: 'sh', ks: still(toShape(parsePath(star), (p) => [p[0], p[1] + LIFT], true)) }, stroke(2.5), fill('#FFD23F')], {
      a: still([101, 22 + LIFT]), p: still([101, 22 + LIFT]), s: kf((t) => { const k = r2(100 + 7 * ph(t, 60)); return [k, k]; }), r: kf((t) => [r2(8 * ph(t, 120))]),
    })])];
  }
  if (mood === 'sleepy') {
    return [0, 1].map((k) => {
      const off = (k * OP) / 2;
      const u = (t) => ((t + off) % OP) / OP;
      return layer(`z${k}`, [group('z', [line('M0 0 L7 0 L0 8 L7 8', 2.4)], {
        p: kf((t) => { const q = u(t); return [r2(86 + q * 14 + 2 * Math.sin(q * TAU)), r2(30 + LIFT - q * 26)]; }),
        s: kf((t) => { const k2 = r2(70 + 50 * u(t)); return [k2, k2]; }),
      })], { o: kf((t) => { const q = u(t); return [r2(100 * (q < 0.15 ? q / 0.15 : q > 0.7 ? Math.max(0, (1 - q) / 0.3) : 1))]; }) });
    });
  }
  return [];
};

// embers rising off the tip, staggered thirds of the loop
const embers = () =>
  [0, 1, 2].map((k) => {
    const off = (k * OP) / 3;
    const u = (t) => (((t + off) % OP) / OP); // 0→1 across the loop
    const x0 = [52, 66, 59][k];
    return layer(`ember${k}`, [group('e', [ellipse((t) => {
      const q = u(t);
      return [r2(x0 + 6 * Math.sin(q * TAU * 1.5 + k) + sway(t) * 0.6), r2(14 - q * 26)];
    }, (t) => { const q = u(t); const s = r2((k === 1 ? 3.6 : 2.8) * (1 - 0.5 * q)); return [s, s]; }), fill(k === 1 ? '#FFD23F' : '#FFB547')])], {
      o: kf((t) => { const q = u(t); return [r2(100 * (q < 0.1 ? q / 0.1 : q > 0.7 ? Math.max(0, (1 - q) / 0.3) : 1))]; }),
    });
  });

function build(mood) {
  M = MOTION[mood];
  ind = 0;
  const flame = layer('flame', [
    group('core', [pathKf((t) => toShape(CORE_SEGS, flameAt(t), true)), grad('#FFE27A', '#FFF6D2', 44, 105)]),
    group('outer', [pathKf((t) => toShape(OUTER_SEGS, flameAt(t), true)), stroke(3.5), grad('#FF5A2E', '#FF9F3A', 6, 112)]),
  ]);
  const hipX = 9 * S;
  const legs = layer('legs', [
    group('feet', [ellipse([55 - hipX, 116], [11, 6]), ellipse([65 + hipX, 116], [11, 6]), stroke(2), fill('#FF6A33')]),
    line(`M${60 - hipX} 100 L${58 - hipX} 115`, 3.4),
    line(`M${60 + hipX} 100 L${62 + hipX} 115`, 3.4),
  ]);
  const shadow = layer('shadow', [group('s', [ellipse([60, 118], (t) => [r2(2 * (26 * S + 6) * (1 - breathe(t) * 1.2)), 5]), fill('#1E1A17', 0.12)])]);
  const arms = DEFAULT_ARMS[mood];
  // Lottie draws the first layer on top.
  return {
    v: '5.9.0', fr: FR, ip: 0, op: OP, w: W, h: H, nm: `Flick · ${mood}`, ddd: 0, assets: [],
    layers: [
      faceLayer(mood), ...extrasFor(mood), ...(mood === 'sleepy' ? [] : embers()),
      ...[arm(-1, arms), arm(1, arms)].map((a, k) => layer(k ? 'armR' : 'armL', a)), flame, legs, shadow,
      // the null parent: shifts the 120×120 drawing into the padded canvas
      { ddd: 0, ind: ROOT_IND, ty: 3, nm: 'root', sr: 1, ao: 0, ip: 0, op: OP, st: 0, bm: 0, ks: { o: still(100), r: still(0), p: still([PAD_X, PAD_Y, 0]), a: still([0, 0, 0]), s: still([100, 100, 100]) } },
    ],
  };
}

const MOODS = Object.keys(MOTION);
mkdirSync(join(ROOT, 'assets/lottie'), { recursive: true });
let total = 0;
for (const mood of MOODS) {
  const json = JSON.stringify(build(mood));
  total += json.length;
  writeFileSync(join(ROOT, `assets/lottie/flick-${mood}.json`), json);
}
console.log(`wrote ${MOODS.length} moods to assets/lottie/ (${(total / 1024).toFixed(0)} KB, ${OP / FR}s @ ${FR}fps)`);
// The padded canvas, for the player: the 120 drawing sits at (PAD_X, PAD_Y) inside W × H.
writeFileSync(join(ROOT, 'assets/lottie/flick-frame.json'), JSON.stringify({ w: W, h: H, padX: PAD_X, padY: PAD_Y }));
