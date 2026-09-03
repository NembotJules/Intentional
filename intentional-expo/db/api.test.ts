import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyAction, MetaGoal } from '@/types';

vi.mock('./index', async () => import('./index.web'));

const api = await import('./api');

function goalInput(overrides: Partial<Omit<MetaGoal, 'id' | 'is_archived'>> = {}) {
  return {
    name: 'Mind',
    color: '#4C6FFF',
    icon: 'book',
    sort_order: 0,
    why_statement: 'Read before reacting.',
    ...overrides,
  };
}

function actionInput(goalId: string, overrides: Partial<Omit<DailyAction, 'id'>> = {}) {
  return {
    goal_id: goalId,
    name: 'Read for 30 minutes',
    type: 'session' as const,
    target_minutes: 30,
    reminder_time: null,
    is_active: 1,
    sort_order: 0,
    ...overrides,
  };
}

describe('db api core behavior', () => {
  beforeEach(() => {
    api.deleteAllData();
  });

  it('creates, updates, orders, and archives goals without deleting history', async () => {
    const first = await api.addGoal(goalInput({ name: 'Mind', sort_order: 1 }));
    const second = await api.addGoal(goalInput({ name: 'Body', sort_order: 0, color: '#D65A31' }));

    expect((await api.getGoals()).map((goal) => goal.name)).toEqual(['Body', 'Mind']);

    await api.updateGoal(first.id, { name: 'Calm Mind' });
    expect(await api.getGoalById(first.id)).toMatchObject({ name: 'Calm Mind' });

    await api.reorderGoals([first.id, second.id]);
    expect((await api.getGoals()).map((goal) => goal.id)).toEqual([first.id, second.id]);

    await api.archiveGoal(first.id);
    expect(await api.getGoalById(first.id)).toBeNull();
    expect(api.getTotalFocusSecondsForGoal(first.id)).toBe(0);
  });

  it('keeps deleted action sessions readable in history and CSV export', async () => {
    const goal = await api.addGoal(goalInput({ name: 'Finances' }));
    const action = await api.addAction(actionInput(goal.id, { name: 'Client proposal' }));
    const session = await api.saveFocusSession({
      action_id: action.id,
      goal_id: goal.id,
      started_at: '2026-04-25T09:00:00.000Z',
      ended_at: '2026-04-25T09:25:00.000Z',
      duration_seconds: 1500,
      note: 'Drafted "scope", pricing',
      was_completed: 1,
    });

    await api.deleteAction(action.id);
    await api.updateFocusSessionNote(session.id, 'Drafted "scope", pricing\nSent outline');

    expect(api.getSessionHistoryList({ timeRange: 'all', goalId: 'all' })[0]).toMatchObject({
      action_name: 'Deleted action',
      goal_name: 'Finances',
      duration_seconds: 1500,
    });
    expect(api.buildCsvString(api.getAllSessionsCsvRows())).toContain('"Drafted ""scope"", pricing\nSent outline"');
  });

  it('tracks habits idempotently for a single day', async () => {
    const goal = await api.addGoal(goalInput({ name: 'Body' }));
    const action = await api.addAction(actionInput(goal.id, { type: 'habit', name: 'Walk outside' }));

    await api.setHabitCompletion(action.id, '2026-04-25', true);
    await api.setHabitCompletion(action.id, '2026-04-25', true);

    expect(await api.getHabitCompletionsForDate('2026-04-25')).toHaveLength(1);

    await api.setHabitCompletion(action.id, '2026-04-25', false);
    expect(await api.getHabitCompletionsForDate('2026-04-25')).toHaveLength(0);
  });

  it('calculates consecutive day streak helpers', () => {
    expect(api.getBestConsecutiveDayStreak(['2026-04-20', '2026-04-21', '2026-04-23'])).toBe(2);
    expect(api.getBestConsecutiveDayStreak([])).toBe(0);
  });

  it('preserves archived goal sessions in history and CSV export', async () => {
    const goal = await api.addGoal(goalInput({ name: 'Mind' }));
    const action = await api.addAction(actionInput(goal.id, { name: 'Meditate' }));
    await api.saveFocusSession({
      action_id: action.id,
      goal_id: goal.id,
      started_at: '2026-04-25T08:00:00.000Z',
      ended_at: '2026-04-25T08:30:00.000Z',
      duration_seconds: 1800,
      note: 'Morning meditation',
      was_completed: 1,
    });

    await api.archiveGoal(goal.id);

    expect(api.getSessionHistoryList({ timeRange: 'all', goalId: 'all' })).toHaveLength(1);
    expect(api.getSessionHistoryList({ timeRange: 'all', goalId: 'all' })[0]).toMatchObject({
      goal_name: 'Mind',
      action_name: 'Meditate',
      duration_seconds: 1800,
    });
    expect(api.getTotalFocusSecondsForGoal(goal.id)).toBe(1800);
    expect(api.getAllSessionsCsvRows()).toHaveLength(1);
  });

  it('deactivates actions and filters them from active queries', async () => {
    const goal = await api.addGoal(goalInput({ name: 'Body' }));
    const action = await api.addAction(actionInput(goal.id, { name: 'Run' }));

    expect(await api.getActionsByGoal(goal.id, false)).toHaveLength(1);
    expect(await api.getAllActions()).toHaveLength(1);

    await api.updateAction(action.id, { is_active: 0 });

    expect(await api.getActionsByGoal(goal.id, false)).toHaveLength(0);
    expect(await api.getActionsByGoal(goal.id, true)).toHaveLength(1);
    expect(await api.getAllActions()).toHaveLength(0);
  });

  it('calculates weekly seconds by goal', async () => {
    const goal = await api.addGoal(goalInput({ name: 'Work' }));
    const action = await api.addAction(actionInput(goal.id, { name: 'Code' }));

    const now = new Date();
    const fourDaysAgo = new Date(now.getTime() - 4 * 86400000);
    const eightDaysAgo = new Date(now.getTime() - 8 * 86400000);

    await api.saveFocusSession({
      action_id: action.id,
      goal_id: goal.id,
      started_at: fourDaysAgo.toISOString(),
      ended_at: new Date(fourDaysAgo.getTime() + 3600000).toISOString(),
      duration_seconds: 3600,
      note: null,
      was_completed: 1,
    });

    await api.saveFocusSession({
      action_id: action.id,
      goal_id: goal.id,
      started_at: eightDaysAgo.toISOString(),
      ended_at: new Date(eightDaysAgo.getTime() + 1800000).toISOString(),
      duration_seconds: 1800,
      note: null,
      was_completed: 1,
    });

    expect(await api.getWeeklySecondsByGoal(goal.id)).toBe(3600);
  });

  it('calculates action streak metrics for session actions', async () => {
    const goal = await api.addGoal(goalInput({ name: 'Learning' }));
    const action = await api.addAction(actionInput(goal.id, { name: 'Study', type: 'session' }));

    await api.saveFocusSession({
      action_id: action.id,
      goal_id: goal.id,
      started_at: '2026-04-20T10:00:00.000Z',
      ended_at: '2026-04-20T11:00:00.000Z',
      duration_seconds: 3600,
      note: null,
      was_completed: 1,
    });

    await api.saveFocusSession({
      action_id: action.id,
      goal_id: goal.id,
      started_at: '2026-04-21T10:00:00.000Z',
      ended_at: '2026-04-21T11:00:00.000Z',
      duration_seconds: 3600,
      note: null,
      was_completed: 1,
    });

    await api.saveFocusSession({
      action_id: action.id,
      goal_id: goal.id,
      started_at: '2026-04-23T10:00:00.000Z',
      ended_at: '2026-04-23T11:00:00.000Z',
      duration_seconds: 3600,
      note: null,
      was_completed: 1,
    });

    const metrics = api.getActionStreakMetrics(action.id, 'session');
    expect(metrics.best).toBe(2);
  });

  it('calculates action streak metrics for habit actions', async () => {
    const goal = await api.addGoal(goalInput({ name: 'Health' }));
    const action = await api.addAction(actionInput(goal.id, { name: 'Walk', type: 'habit' }));

    await api.setHabitCompletion(action.id, '2026-04-20', true);
    await api.setHabitCompletion(action.id, '2026-04-21', true);
    await api.setHabitCompletion(action.id, '2026-04-22', true);
    await api.setHabitCompletion(action.id, '2026-04-24', true);

    const metrics = api.getActionStreakMetrics(action.id, 'habit');
    expect(metrics.best).toBe(3);
  });

  it('calculates current consecutive day streak', () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);

    expect(api.getCurrentConsecutiveDayStreak(new Set([today, yesterday, twoDaysAgo]))).toBe(3);
    expect(api.getCurrentConsecutiveDayStreak(new Set([yesterday, twoDaysAgo]))).toBe(2);
    expect(api.getCurrentConsecutiveDayStreak(new Set([fiveDaysAgo]))).toBe(0);
    expect(api.getCurrentConsecutiveDayStreak(new Set())).toBe(0);
  });

  it('escapes CSV values with commas, quotes, and newlines', () => {
    const rows = [
      {
        date: '2026-04-25',
        goal: 'Work, LLC',
        action: 'Write "proposal"',
        duration_minutes: 30,
        completed: 'yes',
        note: 'Line 1\nLine 2',
      },
      {
        date: '2026-04-26',
        goal: 'Simple',
        action: 'Task',
        duration_minutes: 60,
        completed: 'no',
        note: '',
      },
    ];

    const csv = api.buildCsvString(rows);

    expect(csv).toContain('date,goal,action,duration_minutes,completed,note');
    expect(csv).toContain('"Work, LLC"');
    expect(csv).toContain('"Write ""proposal"""');
    expect(csv).toContain('"Line 1\nLine 2"');
    expect(csv).toContain('2026-04-26,Simple,Task,60,no,');
  });

  it('saves and updates focus session notes', async () => {
    const goal = await api.addGoal(goalInput({ name: 'Projects' }));
    const action = await api.addAction(actionInput(goal.id, { name: 'Design' }));

    const session = await api.saveFocusSession({
      action_id: action.id,
      goal_id: goal.id,
      started_at: '2026-04-25T14:00:00.000Z',
      ended_at: '2026-04-25T15:00:00.000Z',
      duration_seconds: 3600,
      note: null,
      was_completed: 1,
    });

    expect(session.note).toBeNull();

    await api.updateFocusSessionNote(session.id, 'Created mockups');
    const sessions = await api.getSessionsBetween('2026-04-25T00:00:00.000Z', '2026-04-25T23:59:59.999Z');

    expect(sessions[0].note).toBe('Created mockups');

    await api.updateFocusSessionNote(session.id, null);
    const updated = await api.getSessionsBetween('2026-04-25T00:00:00.000Z', '2026-04-25T23:59:59.999Z');

    expect(updated[0].note).toBeNull();
  });
});
