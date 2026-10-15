import type { TextStyle } from 'react-native';

/**
 * Intentional design tokens — "Spark" (the onboarding look, app-wide).
 * Bright warm paper, filled sand cards, bold sans type, one ink pill CTA,
 * a single blue accent, and Flick the flame as the emotional read-out.
 * Focus: warm charcoal shell (the onboarding's commit screen).
 */

export const Surface = {
  canvas: '#FFFCF7',
  surface: '#FFFFFF',
  surfaceRaised: '#F5F0E8',
  hill: '#F1EBE2',
  ink: '#171411',
  muted: '#6F665C',
  faint: '#A69685',
  rule: '#E7DFD4',
  ruleStrong: '#D6CBBC',

  focusCanvas: '#1F1C1A',
  focusSurface: '#2B2826',
  focusRule: '#3D3734',
  focusText: '#FFF8EE',
  focusMuted: '#B8AEA4',
  focusFaint: '#7D746C',

  // Legacy aliases kept while screens migrate.
  lowest: '#1F1C1A',
  base: '#FFFCF7',
  low: '#F5F0E8',
  container: '#FFFFFF',
  high: '#F5F0E8',
  highest: '#D6CBBC',
} as const;

/** The few loud colours. Blue is the one accent; red/green/orange only carry meaning. */
export const Accent = {
  blue: '#3E6BFF',
  blueSoft: '#E6ECFF',
  red: '#E5484D',
  redSoft: '#FDE4E4',
  green: '#22A35A',
  greenSoft: '#DDF5E6',
  orange: '#F27B2E',
  orangeSoft: '#FDEBDD',
  sky: '#CFE8FF',
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

  accentBlue: Accent.blue,
  accentSuccess: Accent.green,
  accentWarning: Accent.orange,
  accentDanger: Accent.red,

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
  md: 16,
  lg: 20,
  xl: 28,
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
 * Type presets — bold, friendly sans everywhere (the onboarding voice).
 * The serif is retired; monospace stays reserved for the focus timer.
 */
export const Type: Record<'hero' | 'title' | 'heading' | 'body' | 'meta' | 'eyebrow' | 'accent' | 'number', TextStyle> = {
  hero: { fontFamily: FontFamily.bodyBold, fontSize: 56, lineHeight: 62, color: Surface.ink, letterSpacing: -1.5 },
  title: { fontFamily: FontFamily.bodyBold, fontSize: 28, lineHeight: 34, color: Surface.ink, letterSpacing: -0.3 },
  heading: { fontFamily: FontFamily.bodyBold, fontSize: 17, lineHeight: 22, color: Surface.ink },
  body: { fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22, color: Surface.muted },
  meta: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, lineHeight: 17, color: Surface.muted },
  eyebrow: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, lineHeight: 18, color: Surface.muted },
  accent: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, lineHeight: 21, color: Accent.blue },
  number: { fontFamily: FontFamily.bodyBold, fontSize: 13, lineHeight: 17, color: Surface.muted, fontVariant: ['tabular-nums'] },
};

/** The one primary button: ink pill, 58 tall. */
export const CTA = { height: 58, radius: 29 } as const;

/** Soft paper shadow for raised cards. */
export const Elevation = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
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
