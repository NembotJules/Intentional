import { describe, expect, it } from 'vitest';
import {
  clampSessionMinutes,
  createFocusSessionDraft,
  formatCountdown,
  initialFocusSessionModel,
  transitionFocusSession,
} from './focusSessionDomain';

describe('focus session domain', () => {
  it('models the core session transitions', () => {
    let state = transitionFocusSession(initialFocusSessionModel, {
      type: 'select_session',
      totalSeconds: 90,
    });
    expect(state).toMatchObject({ phase: 'preparing', shield: 'no_selection', totalSeconds: 90 });

    state = transitionFocusSession(state, { type: 'start', shield: 'applying' });
    state = transitionFocusSession(state, { type: 'shield_applied' });
    expect(state).toMatchObject({ phase: 'focusing', shield: 'applied' });

    state = transitionFocusSession(state, { type: 'tick', seconds: 30 });
    state = transitionFocusSession(state, { type: 'pause' });
    expect(state).toMatchObject({ phase: 'paused', elapsedSeconds: 30 });

    expect(transitionFocusSession(state, { type: 'tick', seconds: 30 })).toEqual(state);

    state = transitionFocusSession(state, { type: 'resume' });
    state = transitionFocusSession(state, { type: 'tick', seconds: 60 });
    expect(state).toMatchObject({ phase: 'completed', elapsedSeconds: 90 });
  });

  it('keeps denied shields as timer-only focus instead of blocking the session', () => {
    let state = transitionFocusSession(initialFocusSessionModel, {
      type: 'select_session',
      totalSeconds: 60,
    });
    state = transitionFocusSession(state, { type: 'start', shield: 'applying' });
    state = transitionFocusSession(state, { type: 'shield_denied' });

    expect(state).toMatchObject({ phase: 'focusing', shield: 'denied' });
  });

  it('formats timer values and clamps custom minutes', () => {
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(3661)).toBe('1:01:01');
    expect(formatCountdown(-1)).toBe('0:00');
    expect(clampSessionMinutes(Number.NaN)).toBe(1);
    expect(clampSessionMinutes(3.8)).toBe(3);
    expect(clampSessionMinutes(1200)).toBe(999);
  });

  it('creates completed and partial session rows from elapsed time', () => {
    const now = new Date('2026-04-25T10:00:00.000Z');

    expect(createFocusSessionDraft({
      actionId: 'action-1',
      goalId: 'goal-1',
      elapsedSeconds: 1500,
      completedFullTimer: false,
      now,
    })).toEqual({
      action_id: 'action-1',
      goal_id: 'goal-1',
      started_at: '2026-04-25T09:35:00.000Z',
      ended_at: '2026-04-25T10:00:00.000Z',
      duration_seconds: 1500,
      note: null,
      was_completed: 0,
    });
  });
});
