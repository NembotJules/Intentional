/**
 * US-118 · Which Flick to draw: a Lottie loop (assets/lottie/flick-<mood>.json) or the SVG Mascot.
 * Pure, so it is unit-tested; components/flick/FlickAnimated.tsx renders it.
 */
export const LOOP_MOODS = ['happy', 'calm', 'worried', 'sleepy', 'focus', 'proud', 'think', 'shock', 'meditate'] as const;
/** US-123 · the unlock flow's animations (always animated, whatever the flame's intensity). */
export const CLIP_MOODS = ['guard', 'deflate', 'remind', 'watch', 'victory', 'key', 'hourglass', 'cheer'] as const;
export type ClipMood = (typeof CLIP_MOODS)[number];
/** One-shot clips and the loop that follows them (null = hold the last frame). */
export const ONCE: Partial<Record<ClipMood, LoopMood | ClipMood | null>> = { deflate: null, victory: 'proud', key: 'hourglass', cheer: 'proud' };
/** The still Mascot face that stands in for a clip (Flick asleep in the app, `bob` off) and names it for screen readers. */
export const CLIP_FACE: Record<ClipMood | 'meditate', string> = { guard: 'think', deflate: 'sad', remind: 'worried', watch: 'think', victory: 'proud', key: 'worried', hourglass: 'calm', cheer: 'proud', meditate: 'calm' };
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
  if (bob && !arms && (CLIP_MOODS as readonly string[]).includes(mood)) return true;
  return bob && !arms && (LOOP_MOODS as readonly string[]).includes(mood) && intensity >= 0.45;
}

/** How much to scale the loop so the flame matches Mascot at this intensity and stage body size. */
export function loopScale(intensity: number, stageBody = 1): number {
  return (flameScale(intensity) / flameScale(LOOP_INTENSITY)) * stageBody;
}
