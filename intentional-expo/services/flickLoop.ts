/**
 * US-118 · Which Flick to draw: a Lottie loop (assets/lottie/flick-<mood>.json) or the SVG Mascot.
 * Pure, so it is unit-tested; components/flick/FlickAnimated.tsx renders it.
 */
export const LOOP_MOODS = ['happy', 'calm', 'worried', 'sleepy', 'focus', 'proud', 'think', 'shock', 'meditate'] as const;
export type LoopMood = (typeof LOOP_MOODS)[number];

/** The flame scale Mascot uses for an intensity (0..1). */
export function flameScale(intensity: number): number {
  const i = Math.min(1, Math.max(0, intensity));
  return i >= 0.6 ? 0.68 + 0.38 * i : 0.42 + (0.908 - 0.42) * (i / 0.6);
}

/** The loops are drawn at intensity 0.75. */
export const LOOP_INTENSITY = 0.75;

/** A loop covers a living (bob), healthy (≥ 0.45) Flick in one of its moods with the mood's own arms. */
export function usesLoop({ mood, intensity, arms, bob = true }: { mood: string; intensity: number; arms?: string; bob?: boolean }): boolean {
  return bob && !arms && (LOOP_MOODS as readonly string[]).includes(mood) && intensity >= 0.45;
}

/** How much to scale the loop so the flame matches Mascot at this intensity and stage body size. */
export function loopScale(intensity: number, stageBody = 1): number {
  return (flameScale(intensity) / flameScale(LOOP_INTENSITY)) * stageBody;
}
