/**
 * "Something worth celebrating may have happened": a session was saved, a goal achieved.
 * `CelebrationHost` (mounted once in the root layout) listens and checks for a stage-up (US-079).
 *
 * US-084: the end-of-session reward holds celebrations while it plays (`holdCelebrations`), then hands off
 * (`releaseCelebrations`): the stage-up or milestone shows after the reward, not over it. While held, nothing is
 * checked (so nothing is consumed); a release always runs one check.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let holds = 0;
let pending = false;

export function onCelebrationCheck(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function celebrationsHeld(): boolean {
  return holds > 0;
}

export function requestCelebrationCheck(): void {
  if (holds > 0) {
    pending = true;
    return;
  }
  pending = false;
  for (const fn of [...listeners]) fn();
}

/** Returns its release; releasing twice is a no-op. */
export function holdCelebrations(): () => void {
  holds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
    if (holds === 0) {
      pending = false;
      for (const fn of [...listeners]) fn();
    }
  };
}

/** Test-only: whether a check was asked for while held. */
export function _celebrationPending(): boolean {
  return pending;
}

/**
 * US-101 · Each stage-up is a full-colour screen in its stage's colour (Spark is never celebrated: it's the start).
 * Flame orange, Torch amber, Bonfire ember red, Beacon violet, Sun gold.
 */
export const STAGE_COLORS = ['#FF7A3A', '#FF6B35', '#E8890C', '#D9480F', '#7048E8', '#E8A100'] as const;

export function stageCelebrationColor(stageIndex: number): string {
  return STAGE_COLORS[Math.max(0, Math.min(STAGE_COLORS.length - 1, Math.round(stageIndex)))]!;
}
