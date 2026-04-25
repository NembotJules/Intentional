import type { FocusSession } from '@/types';

export type FocusPhase = 'idle' | 'preparing' | 'focusing' | 'paused' | 'completed' | 'aborted';
export type ShieldState = 'unsupported' | 'no_selection' | 'denied' | 'applying' | 'applied' | 'removed';

export interface FocusSessionModel {
  phase: FocusPhase;
  shield: ShieldState;
  elapsedSeconds: number;
  totalSeconds: number;
}

export type FocusSessionEvent =
  | { type: 'select_session'; totalSeconds: number }
  | { type: 'start'; shield: ShieldState }
  | { type: 'shield_applied' }
  | { type: 'shield_denied' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'tick'; seconds?: number }
  | { type: 'complete' }
  | { type: 'abort' }
  | { type: 'remove_shield' }
  | { type: 'reset' };

export const initialFocusSessionModel: FocusSessionModel = {
  phase: 'idle',
  shield: 'no_selection',
  elapsedSeconds: 0,
  totalSeconds: 0,
};

export function transitionFocusSession(
  state: FocusSessionModel,
  event: FocusSessionEvent,
): FocusSessionModel {
  switch (event.type) {
    case 'select_session':
      return {
        phase: 'preparing',
        shield: 'no_selection',
        elapsedSeconds: 0,
        totalSeconds: Math.max(0, event.totalSeconds),
      };
    case 'start':
      if (state.phase !== 'preparing') return state;
      return { ...state, phase: 'focusing', shield: event.shield };
    case 'shield_applied':
      return state.phase === 'focusing' ? { ...state, shield: 'applied' } : state;
    case 'shield_denied':
      return state.phase === 'focusing' ? { ...state, shield: 'denied' } : state;
    case 'pause':
      return state.phase === 'focusing' ? { ...state, phase: 'paused' } : state;
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'focusing' } : state;
    case 'tick': {
      if (state.phase !== 'focusing') return state;
      const elapsedSeconds = Math.min(
        state.totalSeconds,
        state.elapsedSeconds + Math.max(1, event.seconds ?? 1),
      );
      return {
        ...state,
        elapsedSeconds,
        phase: elapsedSeconds >= state.totalSeconds ? 'completed' : 'focusing',
      };
    }
    case 'complete':
      return { ...state, elapsedSeconds: state.totalSeconds, phase: 'completed' };
    case 'abort':
      return state.phase === 'idle' ? state : { ...state, phase: 'aborted' };
    case 'remove_shield':
      return { ...state, shield: 'removed' };
    case 'reset':
      return initialFocusSessionModel;
  }
}

export function formatCountdown(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function clampSessionMinutes(value: number): number {
  if (Number.isNaN(value) || value < 1) return 1;
  return Math.min(999, Math.floor(value));
}

export function createFocusSessionDraft({
  actionId,
  goalId,
  elapsedSeconds,
  completedFullTimer,
  now = new Date(),
}: {
  actionId: string;
  goalId: string;
  elapsedSeconds: number;
  completedFullTimer: boolean;
  now?: Date;
}): Omit<FocusSession, 'id'> {
  const durationSeconds = Math.max(0, Math.floor(elapsedSeconds));
  return {
    action_id: actionId,
    goal_id: goalId,
    started_at: new Date(now.getTime() - durationSeconds * 1000).toISOString(),
    ended_at: now.toISOString(),
    duration_seconds: durationSeconds,
    note: null,
    was_completed: completedFullTimer ? 1 : 0,
  };
}
