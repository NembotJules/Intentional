/**
 * Intentional design tokens — v1.1 addendum (Stitch / Disciplined Archive).
 * Surfaces: background shifts, not box borders. Text: min legibility #474747.
 */

export const Surface = {
  /** BRUTALIST base (Focus, Welcome, story screens) */
  lowest: '#0e0e0e',
  /** CLEAN DARK screen base */
  base: '#131313',
  low: '#1b1b1b',
  /** Cards, grouped content */
  container: '#1f1f1f',
  high: '#2a2a2a',
  highest: '#353535',
} as const;

export const Text = {
  primary: '#e2e2e2',
  secondary: '#c6c6c6',
  muted: '#8a8a8a',
  label: '#6b6b6b',
  dim: '#474747',
  ghost: '#353535',
} as const;

/** 15% white — chips, swatches, contained inputs (addendum §4) */
export const ghostBorder = 'rgba(255,255,255,0.15)';

export function hexToRgba(hex: string, alpha: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Goal-colored CTA border (addendum §7) */
export function goalBorderColor(hex: string): string {
  return hexToRgba(hex, 0.3);
}

export const Colors = {
  goalPhysique: '#4A9EED',
  goalFinances: '#22C55E',
  goalSkills: '#8B5CF6',
  goalMind: '#F59E0B',

  backgroundPrimary: Surface.base,
  backgroundSecondary: Surface.container,
  backgroundTertiary: Surface.high,
  backgroundOverlay: Surface.low,
  backgroundFocus: Surface.lowest,

  textPrimary: Text.primary,
  textSecondary: Text.secondary,
  /** @deprecated prefer textMuted — kept for call sites */
  textTertiary: Text.muted,
  textMuted: Text.muted,
  textLabel: Text.label,
  textDim: Text.dim,
  textGhost: Text.ghost,
  /** Text on white primary CTA / light fills */
  textInverse: '#0e0e0e',

  /** Primary “light” accent on dark (headers, selected tab text on dark pill) */
  accentBlue: Text.primary,
  accentSuccess: '#22C55E',
  accentWarning: '#F59E0B',
  accentDanger: '#DC2626',

  /** Technical / ghost dividers only */
  separator: ghostBorder,

  surfaceLowest: Surface.lowest,
  surface: Surface.base,
  surfaceLow: Surface.low,
  surfaceContainer: Surface.container,
  surfaceHigh: Surface.high,
  surfaceHighest: Surface.highest,

  ghostBorder,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  screenH: 16,
  screenV: 20,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
  /** v1.1 primary CTA */
  cta: 6,
} as const;

export const FontSize = {
  largeTitle: 34,
  title1: 28,
  title2: 22,
  title3: 20,
  headline: 17,
  body: 17,
  footnote: 13,
  caption: 12,
  timer: 72,
  score: 48,
} as const;
