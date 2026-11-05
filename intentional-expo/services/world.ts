/**
 * US-098 · Flick's world on Today, as pure functions of the clock and of today's hours.
 *  - The sky follows the local time of day: night, dawn, day, dusk (sun or moon, stars at night).
 *  - The world warms with today's time given against today's plan: grey-blue and quiet at 0,
 *    saturated with flowers and a glow around Flick once the plan is given.
 * The component (components/world/FlickWorld.tsx) only draws what `worldLook` returns.
 */
import { worldTheme, type SkyPhase, type WorldPalette } from '@/services/worldThemes';

export type { SkyPhase };

/** night 21:00–04:59 · dawn 05:00–07:59 · day 08:00–16:59 · dusk 17:00–20:59 (dusk starts with Today's "Good evening") */
export function skyPhase(hour: number): SkyPhase {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 21 || h < 5) return 'night';
  if (h < 8) return 'dawn';
  if (h < 17) return 'day';
  return 'dusk';
}

/**
 * 0..1: how much of today's plan has been given. With no plan today, an hour counts as a full day.
 * Eased so the first minutes already show (a 15-minute start is visible, not 4% of a dull world).
 */
export function worldWarmth(minutesGiven: number, planMinutes: number): number {
  const given = Math.max(0, minutesGiven || 0);
  if (given <= 0) return 0;
  const target = planMinutes > 0 ? planMinutes : 60;
  const r = Math.min(1, given / target);
  return Math.round(Math.sqrt(r) * 1000) / 1000;
}

function hex(n: string): [number, number, number] {
  const s = n.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

/** Mix two #rrggbb colours, t = 0 → a, 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`.toUpperCase();
}

export interface WorldLook extends WorldPalette {
  phase: SkyPhase;
  /** Sun by day, dawn and dusk; moon at night. x,y in a 0..1 box of the scene. */
  body: { kind: 'sun' | 'moon'; x: number; y: number; color: string };
  stars: number;
  /** Flowers / embers on the hill. */
  blooms: number;
  /** The warm halo behind Flick, 0..1. */
  glow: number;
  warmth: number;
}

export function worldLook(opts: { hour: number; minute?: number; warmth: number; themeId?: string | null }): WorldLook {
  const theme = worldTheme(opts.themeId);
  const phase = skyPhase(opts.hour);
  const w = Math.max(0, Math.min(1, opts.warmth));
  const cold = theme.cold[phase];
  const warm = theme.warm[phase];
  const pal = (k: keyof WorldPalette) => mix(cold[k], warm[k], w);
  const t = ((opts.hour % 24) + (opts.minute ?? 0) / 60) / 24;
  // The sun arcs over the day (rises left at dawn, sets right at dusk); the moon sits high at night.
  const dayT = Math.max(0, Math.min(1, (t * 24 - 5) / 16));
  const body =
    phase === 'night'
      ? { kind: 'moon' as const, x: 0.78, y: 0.16, color: '#F4F1DE' }
      : {
          kind: 'sun' as const,
          x: 0.12 + 0.76 * dayT,
          y: 0.52 - 0.4 * Math.sin(Math.PI * dayT),
          color: phase === 'day' ? mix('#FFE7A0', '#FFD23F', w) : mix('#F7C59A', '#FF9F3A', w),
        };
  return {
    phase,
    ...{ skyTop: pal('skyTop'), skyBottom: pal('skyBottom'), hillBack: pal('hillBack'), hillFront: pal('hillFront') },
    body,
    stars: phase === 'night' ? 14 : phase === 'dusk' ? 4 : 0,
    blooms: Math.round(w * 9),
    glow: Math.round((0.12 + 0.68 * w) * 100) / 100,
    warmth: w,
  };
}
