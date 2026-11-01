/**
 * US-084 · The end-of-session reward.
 *
 * Pure: the lifetime minutes before and after the session, plus the goal it counted toward (if any),
 * → what the end screen animates: Flick's brightness rising, "+30m to Body" counting up, the stage bar
 * moving toward the next stage ("12h to Torch"), the goal's hours and progress bar.
 *
 * Goal progress is task- or metric-based (US-058); a session's time doesn't move it by itself. So the
 * goal bar moves only when the session finishes the task ("Is this task done? Yes" → the screen recomputes).
 * The goal's hours always count up.
 */
import type { Objective, Task } from '@/types';
import { progressOf } from '@/services/goalProgress';
import { STAGES, stageFor, stageToNextLabel, type StageName } from '@/services/lifeLedger';

export interface RewardInput {
  /** The session's length, in seconds. */
  sessionSeconds: number;
  /** Every second ever given, including this session. */
  lifetimeSecondsAfter: number;
  /** Flick's highest stage reached before this session (the `flick_stage_seen` setting), if known. */
  seenStageIndex?: number | null;
  /** The goal the session counted toward, with its tasks and its total seconds (this session included). */
  goal?: { objective: Objective; tasks: Task[]; secondsAfter: number } | null;
}

export interface StageReward {
  name: StageName;
  index: number;
  /** Bar toward the next stage, before and after (0..1). After a stage-up, `from` is 0 on the new stage. */
  from: number;
  to: number;
  /** "12h to Torch", or "the brightest stage". */
  toNextLabel: string;
  /** The session crossed into a new stage: Flick's stage-up celebration follows (hand-off). */
  stagedUp: boolean;
}

export interface GoalReward {
  id: string;
  title: string;
  minutesBefore: number;
  minutesAfter: number;
  /** Progress (0..1) as it stands; null when the goal has nothing to measure (no metric, no tasks). */
  progress: number | null;
}

export interface SessionReward {
  /** Minutes added (whole minutes, at least 0). */
  minutes: number;
  /** Flick's brightness rises from `from` to `to` (0..1) while the minutes count up. */
  flick: { from: number; to: number };
  stage: StageReward;
  goal: GoalReward | null;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function buildSessionReward(input: RewardInput): SessionReward {
  const sessionSeconds = Math.max(0, input.sessionSeconds);
  const afterH = Math.max(0, input.lifetimeSecondsAfter) / 3600;
  const beforeH = Math.max(0, afterH - sessionSeconds / 3600);
  const before = stageFor(beforeH);
  const after = stageFor(afterH);
  const seen = input.seenStageIndex ?? null;
  // Stages never go down: show the highest one reached (deleted sessions don't demote Flick).
  const kept = seen !== null && seen > after.index && STAGES[seen] ? seen : after.index;
  const shown = kept === after.index ? after : { ...stageFor(STAGES[kept]!.hours), hoursToNext: null as number | null };
  const keptNext = STAGES[kept + 1];
  const hoursToNext = keptNext ? Math.max(0, keptNext.hours - afterH) : null;
  const stagedUp = after.index > before.index && after.index > (seen ?? before.index);
  const to = kept === after.index ? after.progress : 0;
  const from = stagedUp || kept !== after.index ? 0 : Math.min(before.progress, to);

  // Flick flares up: never below a healthy flame at the end; longer sessions start dimmer, so the rise shows.
  const minutes = Math.floor(sessionSeconds / 60);
  const flickTo = minutes >= 25 ? 1 : 0.8 + 0.2 * (minutes / 25);
  const flickFrom = Math.max(0.3, flickTo - 0.25 - 0.2 * Math.min(1, minutes / 60));

  let goal: GoalReward | null = null;
  if (input.goal) {
    const { objective, tasks, secondsAfter } = input.goal;
    const minutesAfter = Math.floor(Math.max(0, secondsAfter) / 60);
    goal = {
      id: objective.id,
      title: objective.title,
      minutesAfter,
      minutesBefore: Math.max(0, Math.floor((Math.max(0, secondsAfter) - sessionSeconds) / 60)),
      progress: progressOf(objective, tasks),
    };
  }

  return {
    minutes,
    flick: { from: clamp01(flickFrom), to: clamp01(flickTo) },
    stage: {
      name: shown.name,
      index: kept,
      from: clamp01(from),
      to: clamp01(to),
      toNextLabel: stageToNextLabel({ next: keptNext ? { name: keptNext.name } : null, hoursToNext }),
      stagedUp,
    },
    goal,
  };
}

/** "30m", "1h 05m", "12h". */
export function formatGiven(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  if (h === 0) return `${m}m`;
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${String(r).padStart(2, '0')}m`;
}
