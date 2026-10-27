/**
 * "Something worth celebrating may have happened": a session was saved, a goal achieved.
 * `CelebrationHost` (mounted once in the root layout) listens and checks for a stage-up (US-079).
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function onCelebrationCheck(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function requestCelebrationCheck(): void {
  for (const fn of [...listeners]) fn();
}
