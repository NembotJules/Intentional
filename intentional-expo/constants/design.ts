import type { TextStyle } from 'react-native';

/**
 * Intentional design tokens — Quiet Ledger.
 * Main app: warm paper and ink. Focus: dark ceremonial shell.
 */

export const Surface = {
  canvas: '#F7F2EA',
  surface: '#FFFCF6',
  surfaceRaised: '#F0E6D8',
  ink: '#171411',
  muted: '#746B60',
  faint: '#A69685',
  rule: '#E4D8C8',
  ruleStrong: '#CDBDA8',

  focusCanvas: '#0B0E0F',
  focusSurface: '#121819',
  focusRule: '#253034',
  focusText: '#FFF8EE',
  focusMuted: '#9FA9A5',
  focusFaint: '#6F7A78',

  // Legacy aliases kept while screens migrate to Quiet Ledger names.
  lowest: '#0B0E0F',
  base: '#F7F2EA',
  low: '#F0E6D8',
  container: '#FFFCF6',
  high: '#F0E6D8',
  highest: '#CDBDA8',
} as const;

export const Text = {
  primary: Surface.ink,
  secondary: Surface.muted,
  muted: Surface.faint,
  label: Surface.muted,
  dim: Surface.ruleStrong,
  ghost: Surface.faint,
  inverse: Surface.surface,
} as const;

export const ghostBorder = Surface.rule;

export function hexToRgba(hex: string, alpha: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function goalBorderColor(hex: string): string {
  return hexToRgba(hex, 0.35);
}

export const Colors = {
  pillarBody: '#D65A31',
  pillarMoney: '#2F8F5B',
  pillarMind: '#4C6FFF',
  pillarCraft: '#A66A00',

  goalPhysique: '#D65A31',
  goalFinances: '#2F8F5B',
  goalSkills: '#A66A00',
  goalMind: '#4C6FFF',

  backgroundPrimary: Surface.canvas,
  backgroundSecondary: Surface.surface,
  backgroundTertiary: Surface.surfaceRaised,
  backgroundOverlay: Surface.surfaceRaised,
  backgroundFocus: Surface.focusCanvas,

  textPrimary: Text.primary,
  textSecondary: Text.secondary,
  textTertiary: Text.muted,
  textMuted: Text.muted,
  textLabel: Text.label,
  textDim: Text.dim,
  textGhost: Text.ghost,
  textInverse: Text.inverse,

  accentBlue: '#4C6FFF',
  accentSuccess: '#2F8F5B',
  accentWarning: '#A66A00',
  accentDanger: '#B5442E',

  separator: ghostBorder,

  surfaceLowest: Surface.focusCanvas,
  surface: Surface.canvas,
  surfaceLow: Surface.surfaceRaised,
  surfaceContainer: Surface.surface,
  surfaceHigh: Surface.surfaceRaised,
  surfaceHighest: Surface.ruleStrong,

  ghostBorder,
} as const;

export const Spacing = {
  space1: 4,
  space2: 8,
  space3: 12,
  space4: 16,
  space5: 20,
  space6: 24,
  space8: 32,
  space10: 40,
  space12: 48,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  screenH: 20,
  screenV: 24,
} as const;

export const Radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  full: 9999,
  cta: 9999,
} as const;

export const FontSize = {
  display1: 56,
  display2: 44,
  display3: 34,
  largeTitle: 44,
  title1: 34,
  title2: 24,
  title3: 20,
  headline: 17,
  body: 17,
  bodySmall: 15,
  footnote: 12,
  caption: 11,
  timer: 112,
  timeLarge: 64,
  score: 64,
} as const;

export const FontFamily = {
  display: 'InstrumentSerif-Regular',
  displayItalic: 'InstrumentSerif-Italic',
  body: 'SourceSans3-Regular',
  bodyMedium: 'SourceSans3-Medium',
  bodySemiBold: 'SourceSans3-SemiBold',
  bodyBold: 'SourceSans3-Bold',
  mono: 'IBMPlexMono-Regular',
  monoMedium: 'IBMPlexMono-Medium',
  monoSemiBold: 'IBMPlexMono-SemiBold',
} as const;

/**
 * Type presets — one serif for display moments, one sans for everything else.
 * Monospace is reserved for the focus timer; labels are sans, not uppercase mono.
 */
export const Type: Record<'hero' | 'title' | 'heading' | 'body' | 'meta' | 'eyebrow' | 'number', TextStyle> = {
  hero: { fontFamily: FontFamily.display, fontSize: 64, lineHeight: 66, color: Surface.ink, letterSpacing: -0.5 },
  title: { fontFamily: FontFamily.display, fontSize: 36, lineHeight: 40, color: Surface.ink, letterSpacing: -0.2 },
  heading: { fontFamily: FontFamily.bodySemiBold, fontSize: 17, lineHeight: 22, color: Surface.ink },
  body: { fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22, color: Surface.muted },
  meta: { fontFamily: FontFamily.bodyMedium, fontSize: 13, lineHeight: 17, color: Surface.muted },
  eyebrow: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, lineHeight: 17, color: Surface.faint, letterSpacing: 0.2 },
  number: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, lineHeight: 17, color: Surface.muted, fontVariant: ['tabular-nums'] },
};

/** Soft paper shadow for raised cards. */
export const Elevation = {
  card: {
    shadowColor: '#3A2A14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  floating: {
    shadowColor: '#3A2A14',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

/** Motion tokens shared by every animated component. */
export const Motion = {
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  springSoft: { damping: 22, stiffness: 140, mass: 1 },
  press: { damping: 20, stiffness: 420, mass: 0.6 },
  stagger: 55,
  durationFast: 180,
  duration: 320,
} as const;
