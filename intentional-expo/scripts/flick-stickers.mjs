/**
 * US-128 · The hero stickers drawn in Flick 3.0's style instead of Fluent Emoji: the four tab-bar icons, the streak
 * flame and the lock/unlock pair. Same rules as Flick (components/onboarding/Mascot.tsx): flat fills, no outline,
 * chunky rounded shapes, one darker shade on the lower right. build-stickers.mjs turns each SVG into a die-cut
 * sticker (white outline, soft shadow) like the others, so they keep the same PNG names and nothing else changes.
 */

// Flick's palette
const O = '#FF8C1A';
const OS = '#F06A00';
const Y = '#FFC93C';
const YS = '#FFB020';
const INK = '#3A2418';
const RED = '#FF5A4E';
const RS = '#E2403A';
const CREAM = '#FFF4DF';
const CS = '#F3DDBB';
const GREEN = '#52B788';
const GS = '#3A9A6C';
const STEEL = '#B39A8B';
const STEELS = '#957A6B';

// Flick's flame (draft space, see Mascot.tsx)
const OUTER = 'M62.6 7.4 C69.2 21.9 93 37.8 93 73.4 C93 98.5 78.5 113 60 113 C41.5 113 27 98.5 27 74.8 C27 53.6 44.2 43 52.1 32.4 C56 25.8 60 17.8 62.6 7.4 Z';
const TIP = 'M31 27 C41 36 47 47 45 60 C42.5 68.5 30 69 26.8 60 C24 51 26 39 31 27 Z';
/** The flame's yellow heart (the streak flame has no face, so no belly: an inner flame instead). */
const HEART = 'M61 56 C67 69 78 77 78 93 C78 104 70.5 111 60 111 C49.5 111 42 104 42 94 C42 82 54 74 61 56 Z';
const SHADE = 'M93 40 C99 80 86 116 60 117 C42 117 30 108 26 96 C40 106 64 108 78 96 C90 85 92 64 87 44 Z';

const svg = (body, viewBox = '0 0 120 120') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="120" height="120">${body}</svg>`;

/** A shape in its shade colour, then lit again everywhere but a crescent on the lower right. */
function shaded(id, silhouette, shade, lit, dx = -6, dy = -6) {
  // (a clipPath takes shapes only, no <g>, so each shape gets the offset itself)
  const moved = silhouette.replace(/<(circle|rect|path)\b/g, `<$1 transform="translate(${dx} ${dy})"`);
  return `<defs><clipPath id="${id}">${moved}</clipPath></defs>${shade}<g clip-path="url(#${id})">${lit}</g>`;
}

function sun() {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const p = (r) => `${(60 + r * Math.cos(a)).toFixed(1)} ${(60 + r * Math.sin(a)).toFixed(1)}`;
    return `<path d="M${p(43)} L${p(53)}" stroke="${i % 2 ? Y : O}" stroke-width="11" stroke-linecap="round"/>`;
  }).join('');
  const disc = (c) => `<circle cx="60" cy="60" r="33" fill="${c}"/>`;
  return svg(rays + shaded('sun', disc('#000'), disc(OS), disc(O)) + `<circle cx="60" cy="60" r="19" fill="${Y}"/>`);
}

function target() {
  const rings = (a, b) => [46, 35, 24, 13].map((r, i) => `<circle cx="60" cy="62" r="${r}" fill="${i % 2 ? b : a}"/>`).join('');
  const board = shaded('target', `<circle cx="60" cy="62" r="46"/>`, rings(RS, CS), rings(RED, CREAM));
  // the dart, stuck in the middle
  const dart =
    `<path d="M62 60 L96 26" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M90 22 L104 8 L106 20 Z" fill="${O}" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M100 32 L114 18 L102 16 Z" fill="${OS}" stroke="${OS}" stroke-width="4" stroke-linejoin="round"/>`;
  return svg(board + dart);
}

function padlock(open) {
  // US-128: open = the shackle's left leg pops out and the arch lifts
  const shackle = open ? 'M80 58 V30 A20 20 0 0 0 40 30 V36' : 'M40 58 V42 A20 20 0 0 1 80 42 V58';
  const body = (c) => `<rect x="20" y="52" width="80" height="60" rx="18" fill="${c}"/>`;
  return svg(
    `<path d="${shackle}" fill="none" stroke="${STEELS}" stroke-width="14" stroke-linecap="round"/>` +
      `<path d="${shackle}" fill="none" stroke="${STEEL}" stroke-width="8" stroke-linecap="round" transform="translate(-2 -1)"/>` +
      shaded(open ? 'unlock' : 'lock', body('#000'), body(OS), body(O)) +
      `<circle cx="60" cy="78" r="9" fill="${INK}"/><rect x="55.5" y="80" width="9" height="17" rx="4.5" fill="${INK}"/>`,
  );
}

function chart() {
  const bars = [
    [16, 64, Y, YS],
    [46, 40, O, OS],
    [76, 14, GREEN, GS],
  ];
  return svg(
    bars
      .map(([x, top, c, s]) => `<rect x="${x}" y="${top}" width="28" height="${108 - top}" rx="10" fill="${s}"/><rect x="${x}" y="${top}" width="21" height="${108 - top - 5}" rx="9" fill="${c}"/>`)
      .join(''),
  );
}

function flame() {
  return svg(
    `<defs><clipPath id="flame"><path d="${OUTER}"/></clipPath></defs>` +
      `<path d="${TIP}" fill="${OS}"/><path d="${OUTER}" fill="${O}"/>` +
      `<g clip-path="url(#flame)"><path d="${SHADE}" fill="${OS}"/><path d="${HEART}" fill="${Y}"/></g>`,
    '2 4 112 112',
  );
}

export const FLICK_STICKERS = {
  sun: sun(),
  target: target(),
  lock: padlock(false),
  unlock: padlock(true),
  chart: chart(),
  flame: flame(),
};
