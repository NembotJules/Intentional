import type { FocusSession } from '@/types';

export type SessionPhase = 'idle' | 'preparing' | 'focusing' | 'paused' | 'completed' | 'aborted';
export type ShieldState = 'unsupported' | 'no_selection' | 'denied' | 'applying' | 'applied' | 'removed';

export interface FocusSessionContext {
  goalId: string | null;
  actionId: string | null;
  goalName: string | null;
  actionName: string | null;
}

export interface FocusSessionModel {
  phase: SessionPhase;
  shield: ShieldState;
  elapsedSeconds: number;
  totalSeconds: number;
  context: FocusSessionContext;
}

export type FocusSessionEvent =
  | { type: 'select_session'; totalSeconds: number; goalId: string; actionId: string; goalName: string; actionName: string }
  | { type: 'start' }
  | { type: 'shield_result'; shield: ShieldState }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'tick'; seconds?: number }
  | { type: 'complete' }
  | { type: 'abort' }
  | { type: 'reset' };

export const initialFocusSessionModel: FocusSessionModel = {
  phase: 'idle',
  shield: 'no_selection',
  elapsedSeconds: 0,
  totalSeconds: 0,
  context: {
    goalId: null,
    actionId: null,
    goalName: null,
    actionName: null,
  },
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
        context: {
          goalId: event.goalId,
          actionId: event.actionId,
          goalName: event.goalName,
          actionName: event.actionName,
        },
      };
    case 'start':
      if (state.phase !== 'preparing') return state;
      return { ...state, phase: 'focusing', shield: 'applying' };
    case 'shield_result':
      return state.phase === 'focusing' || state.phase === 'paused'
        ? { ...state, shield: event.shield }
        : state;
    case 'pause':
      if (state.phase !== 'focusing') return state;
      return { ...state, phase: 'paused', shield: 'removed' };
    case 'resume':
      if (state.phase !== 'paused') return state;
      return { ...state, phase: 'focusing', shield: 'applying' };
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
      return state.phase === 'focusing' ? { ...state, elapsedSeconds: state.totalSeconds, phase: 'completed', shield: 'removed' } : state;
    case 'abort':
      return state.phase === 'idle' ? state : { ...state, phase: 'aborted', shield: 'removed' };
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

export function getShieldCopy(shield: ShieldState): string {
  switch (shield) {
    case 'applied':
      return 'Category shield';
    case 'applying':
      return 'Applying...';
    case 'denied':
      return 'Shield off - timer only';
    case 'unsupported':
      return 'Timer only';
    case 'no_selection':
      return 'No selection';
    case 'removed':
      return 'Shield lifted';
  }
}

export function getShieldDetailCopy(shield: ShieldState, goalName: string | null, isPaused: boolean): string {
  if (isPaused) {
    return 'Timer paused. Resume when this is still the block you mean to credit.';
  }
  
  switch (shield) {
    case 'applied':
      return `This block is being credited to ${goalName ?? 'your goal'}. Social and Games are shielded until you stop.`;
    case 'applying':
      return 'Applying shields...';
    case 'denied':
      return 'iOS permission is needed for category shields. You can still log focus time honestly.';
    case 'unsupported':
      return 'Category shields are not available on this device.';
    case 'no_selection':
      return 'No apps selected for shielding. Configure shields in Settings.';
    case 'removed':
      return 'Shields have been removed.';
  }
}

export function shouldRemoveShieldsOnTransition(from: SessionPhase, to: SessionPhase): boolean {
  if (to === 'paused') return true;
  if (to === 'completed' || to === 'aborted' || to === 'idle') return true;
  return false;
}

export function shouldApplyShieldsOnTransition(from: SessionPhase, to: SessionPhase): boolean {
  if (from === 'preparing' && to === 'focusing') return true;
  if (from === 'paused' && to === 'focusing') return true;
  return false;
}

export type FocusPhase = SessionPhase;
