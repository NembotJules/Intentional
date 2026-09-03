import { describe, expect, it } from 'vitest';
import {
  clampSessionMinutes,
  createFocusSessionDraft,
  formatCountdown,
  getShieldCopy,
  getShieldDetailCopy,
  initialFocusSessionModel,
  shouldApplyShieldsOnTransition,
  shouldRemoveShieldsOnTransition,
  transitionFocusSession,
} from './focusSessionDomain';

describe('focus session domain', () => {
  describe('session state machine', () => {
    it('transitions from idle -> preparing -> focusing -> completed', () => {
      let state = transitionFocusSession(initialFocusSessionModel, {
        type: 'select_session',
        totalSeconds: 90,
        goalId: 'goal-1',
        actionId: 'action-1',
        goalName: 'Finances',
        actionName: 'Ship proposal',
      });
      expect(state).toMatchObject({
        phase: 'preparing',
        shield: 'no_selection',
        totalSeconds: 90,
        context: {
          goalId: 'goal-1',
          actionId: 'action-1',
          goalName: 'Finances',
          actionName: 'Ship proposal',
        },
      });

      state = transitionFocusSession(state, { type: 'start' });
      expect(state).toMatchObject({ phase: 'focusing', shield: 'applying' });

      state = transitionFocusSession(state, { type: 'shield_result', shield: 'applied' });
      expect(state).toMatchObject({ phase: 'focusing', shield: 'applied' });

      state = transitionFocusSession(state, { type: 'tick', seconds: 90 });
      expect(state).toMatchObject({ phase: 'completed', elapsedSeconds: 90 });
    });

    it('handles natural completion and removes shields', () => {
      let state = transitionFocusSession(initialFocusSessionModel, {
        type: 'select_session',
        totalSeconds: 60,
        goalId: 'goal-1',
        actionId: 'action-1',
        goalName: 'Test',
        actionName: 'Test',
      });
      state = transitionFocusSession(state, { type: 'start' });
      state = transitionFocusSession(state, { type: 'shield_result', shield: 'applied' });
      state = transitionFocusSession(state, { type: 'tick', seconds: 60 });

      expect(state).toMatchObject({
        phase: 'completed',
        elapsedSeconds: 60,
      });
    });

    it('handles early end and marks as aborted', () => {
      let state = transitionFocusSession(initialFocusSessionModel, {
        type: 'select_session',
        totalSeconds: 60,
        goalId: 'goal-1',
        actionId: 'action-1',
        goalName: 'Test',
        actionName: 'Test',
      });
      state = transitionFocusSession(state, { type: 'start' });
      state = transitionFocusSession(state, { type: 'tick', seconds: 20 });
      state = transitionFocusSession(state, { type: 'abort' });

      expect(state).toMatchObject({
        phase: 'aborted',
        elapsedSeconds: 20,
        shield: 'removed',
      });
    });
  });

  describe('pause policy: Option A (pause lifts shields, resume reapplies)', () => {
    it('lifts shields when pausing', () => {
      let state = transitionFocusSession(initialFocusSessionModel, {
        type: 'select_session',
        totalSeconds: 90,
        goalId: 'goal-1',
        actionId: 'action-1',
        goalName: 'Test',
        actionName: 'Test',
      });
      state = transitionFocusSession(state, { type: 'start' });
      state = transitionFocusSession(state, { type: 'shield_result', shield: 'applied' });

      state = transitionFocusSession(state, { type: 'pause' });

      expect(state).toMatchObject({
        phase: 'paused',
        shield: 'removed',
      });
    });

    it('reapplies shields when resuming', () => {
      let state = transitionFocusSession(initialFocusSessionModel, {
        type: 'select_session',
        totalSeconds: 90,
        goalId: 'goal-1',
        actionId: 'action-1',
        goalName: 'Test',
        actionName: 'Test',
      });
      state = transitionFocusSession(state, { type: 'start' });
      state = transitionFocusSession(state, { type: 'shield_result', shield: 'applied' });
      state = transitionFocusSession(state, { type: 'pause' });

      state = transitionFocusSession(state, { type: 'resume' });

      expect(state).toMatchObject({
        phase: 'focusing',
        shield: 'applying',
      });
    });

    it('does not tick timer when paused', () => {
      let state = transitionFocusSession(initialFocusSessionModel, {
        type: 'select_session',
        totalSeconds: 90,
        goalId: 'goal-1',
        actionId: 'action-1',
        goalName: 'Test',
        actionName: 'Test',
      });
      state = transitionFocusSession(state, { type: 'start' });
      state = transitionFocusSession(state, { type: 'tick', seconds: 30 });
      state = transitionFocusSession(state, { type: 'pause' });

      const beforeTick = state.elapsedSeconds;
      state = transitionFocusSession(state, { type: 'tick', seconds: 30 });

      expect(state.elapsedSeconds).toBe(beforeTick);
    });
  });

  describe('shield states', () => {
    it('handles shield denied scenario (timer-only mode)', () => {
      let state = transitionFocusSession(initialFocusSessionModel, {
        type: 'select_session',
        totalSeconds: 60,
        goalId: 'goal-1',
        actionId: 'action-1',
        goalName: 'Test',
        actionName: 'Test',
      });
      state = transitionFocusSession(state, { type: 'start' });
      state = transitionFocusSession(state, { type: 'shield_result', shield: 'denied' });

      expect(state).toMatchObject({ phase: 'focusing', shield: 'denied' });
    });

    it('handles unsupported shields (web/Android)', () => {
      let state = transitionFocusSession(initialFocusSessionModel, {
        type: 'select_session',
        totalSeconds: 60,
        goalId: 'goal-1',
        actionId: 'action-1',
        goalName: 'Test',
        actionName: 'Test',
      });
      state = transitionFocusSession(state, { type: 'start' });
      state = transitionFocusSession(state, { type: 'shield_result', shield: 'unsupported' });

      expect(state).toMatchObject({ phase: 'focusing', shield: 'unsupported' });
    });

    it('handles no_selection state', () => {
      let state = transitionFocusSession(initialFocusSessionModel, {
        type: 'select_session',
        totalSeconds: 60,
        goalId: 'goal-1',
        actionId: 'action-1',
        goalName: 'Test',
        actionName: 'Test',
      });
      state = transitionFocusSession(state, { type: 'start' });
      state = transitionFocusSession(state, { type: 'shield_result', shield: 'no_selection' });

      expect(state).toMatchObject({ phase: 'focusing', shield: 'no_selection' });
    });
  });

  describe('shield lifecycle helpers', () => {
    it('identifies when to remove shields', () => {
      expect(shouldRemoveShieldsOnTransition('focusing', 'paused')).toBe(true);
      expect(shouldRemoveShieldsOnTransition('focusing', 'completed')).toBe(true);
      expect(shouldRemoveShieldsOnTransition('focusing', 'aborted')).toBe(true);
      expect(shouldRemoveShieldsOnTransition('focusing', 'idle')).toBe(true);
      expect(shouldRemoveShieldsOnTransition('preparing', 'focusing')).toBe(false);
    });

    it('identifies when to apply shields', () => {
      expect(shouldApplyShieldsOnTransition('preparing', 'focusing')).toBe(true);
      expect(shouldApplyShieldsOnTransition('paused', 'focusing')).toBe(true);
      expect(shouldApplyShieldsOnTransition('focusing', 'paused')).toBe(false);
      expect(shouldApplyShieldsOnTransition('idle', 'preparing')).toBe(false);
    });
  });

  describe('shield copy', () => {
    it('provides honest shield copy', () => {
      expect(getShieldCopy('applied')).toBe('Category shield');
      expect(getShieldCopy('denied')).toBe('Shield off - timer only');
      expect(getShieldCopy('unsupported')).toBe('Timer only');
      expect(getShieldCopy('no_selection')).toBe('No selection');
      expect(getShieldCopy('removed')).toBe('Shield lifted');
    });

    it('provides context-aware detail copy', () => {
      expect(getShieldDetailCopy('applied', 'Finances', false)).toContain(
        'This block is being credited to Finances'
      );
      expect(getShieldDetailCopy('denied', 'Finances', false)).toContain(
        'iOS permission is needed'
      );
      expect(getShieldDetailCopy('applied', 'Finances', true)).toContain(
        'Timer paused'
      );
    });
  });

  describe('formatting and validation', () => {
    it('formats timer values', () => {
      expect(formatCountdown(65)).toBe('1:05');
      expect(formatCountdown(3661)).toBe('1:01:01');
      expect(formatCountdown(-1)).toBe('0:00');
    });

    it('clamps custom minutes', () => {
      expect(clampSessionMinutes(Number.NaN)).toBe(1);
      expect(clampSessionMinutes(3.8)).toBe(3);
      expect(clampSessionMinutes(1200)).toBe(999);
    });
  });

  describe('session persistence', () => {
    it('creates completed session draft', () => {
      const now = new Date('2026-04-25T10:00:00.000Z');

      expect(
        createFocusSessionDraft({
          actionId: 'action-1',
          goalId: 'goal-1',
          elapsedSeconds: 1500,
          completedFullTimer: true,
          now,
        })
      ).toEqual({
        action_id: 'action-1',
        goal_id: 'goal-1',
        started_at: '2026-04-25T09:35:00.000Z',
        ended_at: '2026-04-25T10:00:00.000Z',
        duration_seconds: 1500,
        note: null,
        was_completed: 1,
      });
    });

    it('creates partial session draft', () => {
      const now = new Date('2026-04-25T10:00:00.000Z');

      expect(
        createFocusSessionDraft({
          actionId: 'action-1',
          goalId: 'goal-1',
          elapsedSeconds: 900,
          completedFullTimer: false,
          now,
        })
      ).toEqual({
        action_id: 'action-1',
        goal_id: 'goal-1',
        started_at: '2026-04-25T09:45:00.000Z',
        ended_at: '2026-04-25T10:00:00.000Z',
        duration_seconds: 900,
        note: null,
        was_completed: 0,
      });
    });
  });

  describe('navigation abandon', () => {
    it('allows abort from any active phase', () => {
      let state = transitionFocusSession(initialFocusSessionModel, {
        type: 'select_session',
        totalSeconds: 60,
        goalId: 'goal-1',
        actionId: 'action-1',
        goalName: 'Test',
        actionName: 'Test',
      });
      state = transitionFocusSession(state, { type: 'start' });
      state = transitionFocusSession(state, { type: 'tick', seconds: 15 });

      state = transitionFocusSession(state, { type: 'abort' });

      expect(state).toMatchObject({
        phase: 'aborted',
        shield: 'removed',
        elapsedSeconds: 15,
      });
    });

    it('prevents abort from idle', () => {
      const state = transitionFocusSession(initialFocusSessionModel, { type: 'abort' });
      expect(state.phase).toBe('idle');
    });
  });
});
