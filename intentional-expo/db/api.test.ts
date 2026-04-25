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
});
