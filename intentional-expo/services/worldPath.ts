/**
 * US-114 · Flick's worlds as a winding path: world stops zig-zag down the screen, joined by a curvy road that is
 * coloured up to where you are. "You're here" (Flick) sits on the road between the last world you earned and the
 * next one, as far along as your hours have taken you.
 * Pure geometry: give it the statuses and the width, get the stops, the road and Flick's spot.
 */
import type { WorldStatus } from '@/services/worldUnlocks';

export const STOP = 112; // a world stop's square size
export const STEP = 176; // vertical distance between stops
const TOP = 16;

export type PathStop = { id: string; x: number; y: number; side: 'left' | 'right'; status: WorldStatus };

export function pathStops(worlds: WorldStatus[], width: number): PathStop[] {
  const pad = 22;
  return worlds.map((w, i) => {
    const side = i % 2 === 0 ? 'left' : 'right';
    return { id: w.id, side, status: w, x: side === 'left' ? pad : width - pad - STOP, y: TOP + i * STEP };
  });
}

/** Centre of a stop. */
const centre = (s: PathStop) => ({ x: s.x + STOP / 2, y: s.y + STOP / 2 });

/** The S-curve between two stops (an SVG cubic segment). */
export function segment(a: PathStop, b: PathStop): string {
  const p = centre(a);
  const q = centre(b);
  const midY = (p.y + q.y) / 2;
  return `M${p.x} ${p.y} C${p.x} ${midY} ${q.x} ${midY} ${q.x} ${q.y}`;
}

/** A point at t (0..1) along that same curve. */
export function pointOn(a: PathStop, b: PathStop, t: number): { x: number; y: number } {
  const p = centre(a);
  const q = centre(b);
  const midY = (p.y + q.y) / 2;
  const u = 1 - t;
  // cubic Bézier with control points (p.x, midY) and (q.x, midY)
  const x = u * u * u * p.x + 3 * u * u * t * p.x + 3 * u * t * t * q.x + t * t * t * q.x;
  const y = u * u * u * p.y + 3 * u * u * t * midY + 3 * u * t * t * midY + t * t * t * q.y;
  return { x, y };
}

/**
 * Where Flick stands: between the last unlocked stop and the next, at the share of hours given in between
 * (kept between 0.45 and 0.6 so he stays on the open road, clear of both stops). Null when every world is earned.
 */
export function youAreHere(stops: PathStop[], lifetimeHours: number): { index: number; t: number; x: number; y: number; next: PathStop } | null {
  const k = stops.findIndex((s) => !s.status.unlocked);
  if (k <= 0) return null;
  const a = stops[k - 1]!;
  const b = stops[k]!;
  const span = Math.max(1, b.status.unlockHours - a.status.unlockHours);
  const raw = (lifetimeHours - a.status.unlockHours) / span;
  const t = Math.max(0.45, Math.min(0.6, raw));
  return { index: k - 1, t, next: b, ...pointOn(a, b, t) };
}

export function pathHeight(n: number): number {
  return TOP * 2 + (n - 1) * STEP + STOP;
}
