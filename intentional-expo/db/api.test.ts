import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyAction, MetaGoal } from '@/types';
import { localDayKey, shiftDayKey } from '@/utils/dates';

vi.mock('./index', async () => import('./index.web'));

/** Deadlines relative to today so the suite never expires (the API rejects past deadlines). */
const FUTURE = shiftDayKey(localDayKey(), 90);
const FUTURE_2 = shiftDayKey(localDayKey(), 240);

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
    objective_id: null,
    days_mask: 127,
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
      task_id: null,
      objective_id: null,
    });

    await api.deleteAction(action.id);
    await api.updateFocusSessionNote(session.id, 'Drafted "scope", pricing\nSent outline');

    expect(api.getSessionHistoryList({ timeRange: 'all', goalId: 'all' })[0]).toMatchObject({
      action_name: 'Deleted habit',
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
      task_id: null,
      objective_id: null,
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
      task_id: null,
      objective_id: null,
    });

    await api.saveFocusSession({
      action_id: action.id,
      goal_id: goal.id,
      started_at: eightDaysAgo.toISOString(),
      ended_at: new Date(eightDaysAgo.getTime() + 1800000).toISOString(),
      duration_seconds: 1800,
      note: null,
      was_completed: 1,
      task_id: null,
      objective_id: null,
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
      task_id: null,
      objective_id: null,
    });

    await api.saveFocusSession({
      action_id: action.id,
      goal_id: goal.id,
      started_at: '2026-04-21T10:00:00.000Z',
      ended_at: '2026-04-21T11:00:00.000Z',
      duration_seconds: 3600,
      note: null,
      was_completed: 1,
      task_id: null,
      objective_id: null,
    });

    await api.saveFocusSession({
      action_id: action.id,
      goal_id: goal.id,
      started_at: '2026-04-23T10:00:00.000Z',
      ended_at: '2026-04-23T11:00:00.000Z',
      duration_seconds: 3600,
      note: null,
      was_completed: 1,
      task_id: null,
      objective_id: null,
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
    const today = localDayKey();
    const yesterday = shiftDayKey(today, -1);
    const twoDaysAgo = shiftDayKey(today, -2);
    const fiveDaysAgo = shiftDayKey(today, -5);

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
      task_id: null,
      objective_id: null,
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

// ─── US-055: Objectives API tests ────────────────────────────────────────────

describe('objectives (US-055)', () => {
  beforeEach(() => {
    api.deleteAllData();
  });

  function objectiveInput(pillarId: string, overrides: Partial<any> = {}) {
    return {
      pillar_id: pillarId,
      title: 'Run a half marathon',
      done_when: 'Complete 21km race',
      deadline: FUTURE,
      status: 'active' as const,
      metric_current: null,
      metric_target: null,
      metric_unit: null,
      sort_order: 0,
      ...overrides,
    };
  }

  it('creates an objective with required fields', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));

    expect(objective).toMatchObject({
      pillar_id: pillar.id,
      title: 'Run a half marathon',
      done_when: 'Complete 21km race',
      deadline: FUTURE,
      status: 'active',
      closed_at: null,
      close_note: null,
    });
    expect(typeof objective.id).toBe('string');
    expect(objective.id.length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(objective.created_at))).toBe(false);
  });

  it('enforces one-active invariant on create', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    await api.addObjective(objectiveInput(pillar.id, { status: 'active' }));

    await expect(
      api.addObjective(objectiveInput(pillar.id, { title: 'Second active goal', status: 'active' }))
    ).rejects.toThrow(api.ActiveObjectiveExistsError);
  });

  it('allows multiple planned objectives per pillar', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    await api.addObjective(objectiveInput(pillar.id, { status: 'planned', sort_order: 0 }));
    await api.addObjective(objectiveInput(pillar.id, { title: 'Second planned', status: 'planned', sort_order: 1 }));

    const objectives = await api.getObjectives(pillar.id);
    expect(objectives.filter(o => o.status === 'planned')).toHaveLength(2);
  });

  it('enforces one-active invariant on status change', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const first = await api.addObjective(objectiveInput(pillar.id, { status: 'active' }));
    const second = await api.addObjective(objectiveInput(pillar.id, { title: 'Second', status: 'planned' }));

    await expect(
      api.setObjectiveStatus(second.id, 'active')
    ).rejects.toThrow(api.ActiveObjectiveExistsError);

    // After completing first, second can become active
    await api.setObjectiveStatus(first.id, 'completed');
    await api.setObjectiveStatus(second.id, 'active');

    const active = await api.getActiveObjective(pillar.id);
    expect(active?.id).toBe(second.id);
  });

  it('validates title max 60 characters', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const longTitle = 'a'.repeat(61);

    await expect(
      api.addObjective(objectiveInput(pillar.id, { title: longTitle }))
    ).rejects.toThrow('title must be 60 characters or less');
  });

  it('validates done_when max 140 characters', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const longDoneWhen = 'a'.repeat(141);

    await expect(
      api.addObjective(objectiveInput(pillar.id, { done_when: longDoneWhen }))
    ).rejects.toThrow('done_when must be 140 characters or less');
  });

  it('validates deadline is not in the past', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));

    await expect(
      api.addObjective(objectiveInput(pillar.id, { deadline: '2020-01-01' }))
    ).rejects.toThrow('deadline must be today or later');
  });

  it('sets closed_at and close_note when completing', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));

    await api.setObjectiveStatus(objective.id, 'completed', 'Finished the race!');

    const objectives = await api.getObjectives(pillar.id);
    const completed = objectives.find(o => o.id === objective.id)!;
    expect(completed.status).toBe('completed');
    expect(typeof completed.closed_at).toBe('string');
    expect(completed.close_note).toBe('Finished the race!');
  });

  it('sets closed_at and close_note when dropping', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));

    await api.setObjectiveStatus(objective.id, 'dropped', 'Changed priorities');

    const objectives = await api.getObjectives(pillar.id);
    const dropped = objectives.find(o => o.id === objective.id)!;
    expect(dropped.status).toBe('dropped');
    expect(typeof dropped.closed_at).toBe('string');
    expect(dropped.close_note).toBe('Changed priorities');
  });

  it('updates objective fields', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));

    await api.updateObjective(objective.id, {
      title: 'Updated title',
      done_when: 'Updated done when',
      deadline: FUTURE_2,
      metric_current: 12,
      metric_target: 21,
      metric_unit: 'km',
    });

    const objectives = await api.getObjectives(pillar.id);
    const updated = objectives.find(o => o.id === objective.id)!;
    expect(updated).toMatchObject({
      title: 'Updated title',
      done_when: 'Updated done when',
      deadline: FUTURE_2,
      metric_current: 12,
      metric_target: 21,
      metric_unit: 'km',
    });
  });

  it('gets active objective for a pillar', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const active = await api.addObjective(objectiveInput(pillar.id, { status: 'active' }));
    await api.addObjective(objectiveInput(pillar.id, { title: 'Planned', status: 'planned' }));

    const result = await api.getActiveObjective(pillar.id);
    expect(result?.id).toBe(active.id);
  });

  it('returns null when no active objective exists', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const result = await api.getActiveObjective(pillar.id);
    expect(result).toBeNull();
  });

  it('gets all objectives for a pillar', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    await api.addObjective(objectiveInput(pillar.id, { status: 'active', sort_order: 0 }));
    await api.addObjective(objectiveInput(pillar.id, { title: 'Planned', status: 'planned', sort_order: 1 }));

    const objectives = await api.getObjectives(pillar.id);
    expect(objectives).toHaveLength(2);
    expect(objectives[0]!.status).toBe('active');
    expect(objectives[1]!.status).toBe('planned');
  });

  it('gets all objectives across pillars', async () => {
    const pillar1 = await api.addGoal(goalInput({ name: 'Body' }));
    const pillar2 = await api.addGoal(goalInput({ name: 'Mind', color: '#4C6FFF' }));
    await api.addObjective(objectiveInput(pillar1.id));
    await api.addObjective(objectiveInput(pillar2.id));

    const objectives = await api.getObjectives();
    expect(objectives).toHaveLength(2);
  });
});

// ─── US-056: Tasks API tests ─────────────────────────────────────────────────

describe('tasks (US-056)', () => {
  beforeEach(() => {
    api.deleteAllData();
  });

  function objectiveInput(pillarId: string, overrides: Partial<any> = {}) {
    return {
      pillar_id: pillarId,
      title: 'Run a half marathon',
      done_when: 'Complete 21km race',
      deadline: FUTURE,
      status: 'active' as const,
      metric_current: null,
      metric_target: null,
      metric_unit: null,
      sort_order: 0,
      ...overrides,
    };
  }

  function taskInput(objectiveId: string, overrides: Partial<any> = {}) {
    return {
      objective_id: objectiveId,
      title: 'Buy running shoes',
      estimate_minutes: 30,
      planned_date: null,
      sort_order: 0,
      ...overrides,
    };
  }

  it('creates a task with required fields', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const task = await api.addTask(taskInput(objective.id));

    expect(task).toMatchObject({
      objective_id: objective.id,
      title: 'Buy running shoes',
      estimate_minutes: 30,
      planned_date: null,
      is_done: 0,
      done_at: null,
    });
    expect(typeof task.id).toBe('string');
    expect(Number.isNaN(Date.parse(task.created_at))).toBe(false);
  });

  it('validates title max 60 characters', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const longTitle = 'a'.repeat(61);

    await expect(
      api.addTask(taskInput(objective.id, { title: longTitle }))
    ).rejects.toThrow('title must be 60 characters or less');
  });

  it('validates estimate must be greater than 0', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));

    await expect(
      api.addTask(taskInput(objective.id, { estimate_minutes: 0 }))
    ).rejects.toThrow('estimate must be greater than 0');

    await expect(
      api.addTask(taskInput(objective.id, { estimate_minutes: -5 }))
    ).rejects.toThrow('estimate must be greater than 0');
  });

  it('validates objective exists', async () => {
    await expect(
      api.addTask(taskInput('nonexistent-objective-id'))
    ).rejects.toThrow('does not exist');
  });

  it('gets all tasks for an objective', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    await api.addTask(taskInput(objective.id, { title: 'Task 1', sort_order: 0 }));
    await api.addTask(taskInput(objective.id, { title: 'Task 2', sort_order: 1 }));

    const tasks = await api.getTasks(objective.id);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]!.title).toBe('Task 1');
    expect(tasks[1]!.title).toBe('Task 2');
  });

  it('marks task as done', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const task = await api.addTask(taskInput(objective.id));

    await api.setTaskDone(task.id, true);

    const tasks = await api.getTasks(objective.id);
    const done = tasks.find(t => t.id === task.id)!;
    expect(done.is_done).toBe(1);
    expect(typeof done.done_at).toBe('string');
  });

  it('marks task as not done', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const task = await api.addTask(taskInput(objective.id));

    await api.setTaskDone(task.id, true);
    await api.setTaskDone(task.id, false);

    const tasks = await api.getTasks(objective.id);
    const notDone = tasks.find(t => t.id === task.id)!;
    expect(notDone.is_done).toBe(0);
    expect(notDone.done_at).toBeNull();
  });

  it('updates task fields', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const task = await api.addTask(taskInput(objective.id));

    await api.updateTask(task.id, {
      title: 'Updated title',
      estimate_minutes: 60,
      planned_date: '2026-12-25',
    });

    const tasks = await api.getTasks(objective.id);
    const updated = tasks.find(t => t.id === task.id)!;
    expect(updated).toMatchObject({
      title: 'Updated title',
      estimate_minutes: 60,
      planned_date: '2026-12-25',
    });
  });

  it('reorders tasks within an objective', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const task1 = await api.addTask(taskInput(objective.id, { title: 'Task 1', sort_order: 0 }));
    const task2 = await api.addTask(taskInput(objective.id, { title: 'Task 2', sort_order: 1 }));
    const task3 = await api.addTask(taskInput(objective.id, { title: 'Task 3', sort_order: 2 }));

    await api.reorderTasks(objective.id, [task3.id, task1.id, task2.id]);

    const tasks = await api.getTasks(objective.id);
    expect(tasks[0]!.title).toBe('Task 3');
    expect(tasks[1]!.title).toBe('Task 1');
    expect(tasks[2]!.title).toBe('Task 2');
  });

  it('gets next task (first not-done by sort_order)', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const task1 = await api.addTask(taskInput(objective.id, { title: 'Task 1', sort_order: 0 }));
    const task2 = await api.addTask(taskInput(objective.id, { title: 'Task 2', sort_order: 1 }));
    await api.addTask(taskInput(objective.id, { title: 'Task 3', sort_order: 2 }));

    const next = await api.getNextTask(objective.id);
    expect(next?.id).toBe(task1.id);

    await api.setTaskDone(task1.id, true);
    const next2 = await api.getNextTask(objective.id);
    expect(next2?.id).toBe(task2.id);
  });

  it('returns null when no next task exists', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const task1 = await api.addTask(taskInput(objective.id));
    const task2 = await api.addTask(taskInput(objective.id, { title: 'Task 2' }));

    await api.setTaskDone(task1.id, true);
    await api.setTaskDone(task2.id, true);

    const next = await api.getNextTask(objective.id);
    expect(next).toBeNull();
  });

  it('gets next task respects reordering', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const task1 = await api.addTask(taskInput(objective.id, { title: 'Task 1', sort_order: 0 }));
    const task2 = await api.addTask(taskInput(objective.id, { title: 'Task 2', sort_order: 1 }));

    await api.reorderTasks(objective.id, [task2.id, task1.id]);

    const next = await api.getNextTask(objective.id);
    expect(next?.title).toBe('Task 2');
  });

  it('gets tasks planned for a date', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    await api.addTask(taskInput(objective.id, { title: 'Today task', planned_date: '2026-12-25' }));
    await api.addTask(taskInput(objective.id, { title: 'Tomorrow task', planned_date: '2026-12-26' }));
    await api.addTask(taskInput(objective.id, { title: 'Unplanned task', planned_date: null }));

    const todayTasks = await api.getTasksPlannedFor('2026-12-25');
    expect(todayTasks).toHaveLength(1);
    expect(todayTasks[0]!.title).toBe('Today task');
  });
});

// ─── US-057: Link habits & sessions to goals/tasks tests ─────────────────────

describe('links and rollups (US-057)', () => {
  beforeEach(() => {
    api.deleteAllData();
  });

  function objectiveInput(pillarId: string, overrides: Partial<any> = {}) {
    return {
      pillar_id: pillarId,
      title: 'Run a half marathon',
      done_when: 'Complete 21km race',
      deadline: FUTURE,
      status: 'active' as const,
      metric_current: null,
      metric_target: null,
      metric_unit: null,
      sort_order: 0,
      ...overrides,
    };
  }

  function taskInput(objectiveId: string, overrides: Partial<any> = {}) {
    return {
      objective_id: objectiveId,
      title: 'Buy running shoes',
      estimate_minutes: 30,
      planned_date: null,
      sort_order: 0,
      ...overrides,
    };
  }

  it('links habit to objective', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const habit = await api.addAction({
      goal_id: pillar.id,
      name: 'Run 30 min',
      type: 'habit',
      target_minutes: 30,
      reminder_time: '07:00',
      is_active: 1,
      sort_order: 0,
      objective_id: objective.id,
      days_mask: 127,
    });

    expect(habit.objective_id).toBe(objective.id);
    expect(habit.days_mask).toBe(127);
  });

  it('defaults days_mask to 127 (all days)', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const habit = await api.addAction({
      goal_id: pillar.id,
      name: 'Run 30 min',
      type: 'habit',
      target_minutes: 30,
      reminder_time: '07:00',
      is_active: 1,
      sort_order: 0,
      objective_id: null,
      days_mask: 127,
    });

    expect(habit.days_mask).toBe(127);
  });

  it('records session with task_id and derives objective_id', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const task = await api.addTask(taskInput(objective.id));

    const session = await api.saveFocusSession({
      action_id: 'none',
      goal_id: pillar.id,
      started_at: '2026-04-25T09:00:00.000Z',
      ended_at: '2026-04-25T09:45:00.000Z',
      duration_seconds: 2700,
      note: null,
      was_completed: 1,
      task_id: task.id,
      objective_id: null, // not passed: must be derived from the task
    });

    expect(session.task_id).toBe(task.id);
    expect(session.objective_id).toBe(objective.id);
    expect(api.getMinutesForObjective(objective.id)).toBe(45);
  });

  it('a session on a habit linked to a goal counts toward that goal (derived, not passed)', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const habit = await api.addAction({
      goal_id: pillar.id,
      name: 'Run 30 min',
      type: 'habit',
      target_minutes: 30,
      reminder_time: '07:00',
      is_active: 1,
      sort_order: 0,
      objective_id: objective.id,
      days_mask: 127,
    });

    const session = await api.saveFocusSession({
      action_id: habit.id,
      goal_id: pillar.id,
      started_at: '2026-04-25T09:00:00.000Z',
      ended_at: '2026-04-25T09:30:00.000Z',
      duration_seconds: 1800,
      note: null,
      was_completed: 1,
      task_id: null,
      objective_id: null, // not passed: derived from the habit's goal link
    });

    expect(session.task_id).toBeNull();
    expect(session.objective_id).toBe(objective.id);
  });

  it('records session with no task_id and no objective_id (free session)', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const action = await api.addAction({
      goal_id: pillar.id,
      name: 'Free session',
      type: 'session',
      target_minutes: 30,
      reminder_time: null,
      is_active: 1,
      sort_order: 0,
      objective_id: null,
      days_mask: 127,
    });

    const session = await api.saveFocusSession({
      action_id: action.id,
      goal_id: pillar.id,
      started_at: '2026-04-25T09:00:00.000Z',
      ended_at: '2026-04-25T09:30:00.000Z',
      duration_seconds: 1800,
      note: null,
      was_completed: 1,
      task_id: null,
      objective_id: null,
    });

    expect(session.task_id).toBeNull();
    expect(session.objective_id).toBeNull();
  });

  it('getMinutesForTask calculates total minutes', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const task = await api.addTask(taskInput(objective.id));

    await api.saveFocusSession({
      action_id: 'none',
      goal_id: pillar.id,
      started_at: '2026-04-25T09:00:00.000Z',
      ended_at: '2026-04-25T09:45:00.000Z',
      duration_seconds: 2700,
      note: null,
      was_completed: 1,
      task_id: task.id,
      objective_id: objective.id,
    });

    await api.saveFocusSession({
      action_id: 'none',
      goal_id: pillar.id,
      started_at: '2026-04-25T10:00:00.000Z',
      ended_at: '2026-04-25T10:30:00.000Z',
      duration_seconds: 1800,
      note: null,
      was_completed: 1,
      task_id: task.id,
      objective_id: objective.id,
    });

    expect(api.getMinutesForTask(task.id)).toBe(75);
  });

  it('getMinutesForObjective calculates total minutes', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const task1 = await api.addTask(taskInput(objective.id, { title: 'Task 1' }));
    const task2 = await api.addTask(taskInput(objective.id, { title: 'Task 2' }));

    await api.saveFocusSession({
      action_id: 'none',
      goal_id: pillar.id,
      started_at: '2026-04-25T09:00:00.000Z',
      ended_at: '2026-04-25T09:45:00.000Z',
      duration_seconds: 2700,
      note: null,
      was_completed: 1,
      task_id: task1.id,
      objective_id: objective.id,
    });

    await api.saveFocusSession({
      action_id: 'none',
      goal_id: pillar.id,
      started_at: '2026-04-25T10:00:00.000Z',
      ended_at: '2026-04-25T10:30:00.000Z',
      duration_seconds: 1800,
      note: null,
      was_completed: 1,
      task_id: task2.id,
      objective_id: objective.id,
    });

    expect(api.getMinutesForObjective(objective.id)).toBe(75);
  });

  it('getMinutesForObjective with range filters sessions', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));

    await api.saveFocusSession({
      action_id: 'none',
      goal_id: pillar.id,
      started_at: '2026-04-25T09:00:00.000Z',
      ended_at: '2026-04-25T09:45:00.000Z',
      duration_seconds: 2700,
      note: null,
      was_completed: 1,
      task_id: null,
      objective_id: objective.id,
    });

    await api.saveFocusSession({
      action_id: 'none',
      goal_id: pillar.id,
      started_at: '2026-04-26T09:00:00.000Z',
      ended_at: '2026-04-26T09:30:00.000Z',
      duration_seconds: 1800,
      note: null,
      was_completed: 1,
      task_id: null,
      objective_id: objective.id,
    });

    const minutes = api.getMinutesForObjective(objective.id, {
      start: '2026-04-25T00:00:00.000Z',
      end: '2026-04-25T23:59:59.999Z',
    });
    expect(minutes).toBe(45);
  });

  it('getMinutesForPillar calculates total minutes', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));

    await api.saveFocusSession({
      action_id: 'none',
      goal_id: pillar.id,
      started_at: '2026-04-25T09:00:00.000Z',
      ended_at: '2026-04-25T09:45:00.000Z',
      duration_seconds: 2700,
      note: null,
      was_completed: 1,
      task_id: null,
      objective_id: objective.id,
    });

    await api.saveFocusSession({
      action_id: 'none',
      goal_id: pillar.id,
      started_at: '2026-04-26T09:00:00.000Z',
      ended_at: '2026-04-26T09:30:00.000Z',
      duration_seconds: 1800,
      note: null,
      was_completed: 1,
      task_id: null,
      objective_id: null,
    });

    expect(api.getMinutesForPillar(pillar.id)).toBe(75);
  });

  it('getMinutesForPillar with range filters sessions', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));

    await api.saveFocusSession({
      action_id: 'none',
      goal_id: pillar.id,
      started_at: '2026-04-25T09:00:00.000Z',
      ended_at: '2026-04-25T09:45:00.000Z',
      duration_seconds: 2700,
      note: null,
      was_completed: 1,
      task_id: null,
      objective_id: null,
    });

    await api.saveFocusSession({
      action_id: 'none',
      goal_id: pillar.id,
      started_at: '2026-04-26T09:00:00.000Z',
      ended_at: '2026-04-26T09:30:00.000Z',
      duration_seconds: 1800,
      note: null,
      was_completed: 1,
      task_id: null,
      objective_id: null,
    });

    const minutes = api.getMinutesForPillar(pillar.id, {
      start: '2026-04-25T00:00:00.000Z',
      end: '2026-04-25T23:59:59.999Z',
    });
    expect(minutes).toBe(45);
  });
});

describe('audit fixes (2026-10-21)', () => {
  beforeEach(() => {
    api.deleteAllData();
  });

  function objectiveInput(pillarId: string) {
    return {
      pillar_id: pillarId,
      title: 'Run a half marathon',
      done_when: 'Complete 21km race',
      deadline: FUTURE,
      status: 'active' as const,
      metric_current: null,
      metric_target: null,
      metric_unit: null,
      sort_order: 0,
    };
  }
  it('orders 12 tasks numerically (2 before 10) and the next task is right after two are done', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Craft' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const tasks = [];
    for (let i = 0; i < 12; i++) tasks.push(await api.addTask({ objective_id: objective.id, title: `T${i}` }));
    expect((await api.getTasks(objective.id)).map((t) => t.title)).toEqual(tasks.map((t) => t.title));
    await api.setTaskDone(tasks[0]!.id, true);
    await api.setTaskDone(tasks[1]!.id, true);
    expect((await api.getNextTask(objective.id))?.title).toBe('T2');
  });

  it('addTask defaults the estimate to 30 and appends to the end', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Craft' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const a = await api.addTask({ objective_id: objective.id, title: 'First' });
    const b = await api.addTask({ objective_id: objective.id, title: 'Second' });
    expect(a.estimate_minutes).toBe(30);
    expect(b.sort_order).toBeGreaterThan(a.sort_order);
  });

  it('rejects empty titles, NaN estimates and malformed dates', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Craft' }));
    await expect(api.addObjective({ ...objectiveInput(pillar.id), title: '   ' })).rejects.toThrow(/required/);
    await expect(api.addObjective({ ...objectiveInput(pillar.id), deadline: '2026-1-5' })).rejects.toThrow(/date/);
    await expect(api.addObjective({ ...objectiveInput(pillar.id), deadline: 'abc' })).rejects.toThrow(/date/);
    const objective = await api.addObjective(objectiveInput(pillar.id));
    await expect(api.addTask({ objective_id: objective.id, title: '' })).rejects.toThrow(/required/);
    await expect(api.addTask({ objective_id: objective.id, title: 'x', estimate_minutes: Number.NaN })).rejects.toThrow(/estimate/);
    await expect(api.addTask({ objective_id: objective.id, title: 'x', planned_date: '2026-02-30' })).rejects.toThrow(/date/);
  });

  it('accepts today as a deadline (local day) but not yesterday', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Craft' }));
    await expect(api.addObjective({ ...objectiveInput(pillar.id), deadline: localDayKey() })).resolves.toBeTruthy();
    const other = await api.addGoal(goalInput({ name: 'Body' }));
    await expect(api.addObjective({ ...objectiveInput(other.id), deadline: shiftDayKey(localDayKey(), -1) })).rejects.toThrow(/today or later/);
  });

  it('deleteTask removes the task (it is not marked done)', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Craft' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const t = await api.addTask({ objective_id: objective.id, title: 'Gone' });
    await api.deleteTask(t.id);
    expect(await api.getTasks(objective.id)).toEqual([]);
  });

  it('reorderTasks of open tasks keeps done tasks after them with no colliding order numbers', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Craft' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const [a, b, c] = [await api.addTask({ objective_id: objective.id, title: 'A' }), await api.addTask({ objective_id: objective.id, title: 'B' }), await api.addTask({ objective_id: objective.id, title: 'C' })];
    await api.setTaskDone(a!.id, true);
    await api.reorderTasks(objective.id, [c!.id, b!.id]);
    const order = (await api.getTasks(objective.id)).map((t) => t.title);
    expect(order).toEqual(['C', 'B', 'A']);
    const nums = (await api.getTasks(objective.id)).map((t) => t.sort_order);
    expect(new Set(nums).size).toBe(nums.length);
  });

  it('planned-task queries skip done tasks and tasks of goals that are not active', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Craft' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    const today = localDayKey();
    const open = await api.addTask({ objective_id: objective.id, title: 'Open', planned_date: today });
    const done = await api.addTask({ objective_id: objective.id, title: 'Done', planned_date: today });
    const late = await api.addTask({ objective_id: objective.id, title: 'Late', planned_date: shiftDayKey(today, -2) });
    await api.setTaskDone(done.id, true);
    expect((await api.getTasksPlannedFor(today)).map((t) => t.id)).toEqual([open.id]);
    expect((await api.getOpenPlannedTasks()).map((t) => t.id)).toEqual([late.id, open.id]);
    await api.setObjectiveStatus(objective.id, 'dropped', 'changed course');
    expect(await api.getOpenPlannedTasks()).toEqual([]);
  });

  it('reopening a goal keeps its closing history; status changes through updateObjective stamp closed_at', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Craft' }));
    const objective = await api.addObjective(objectiveInput(pillar.id));
    await api.updateObjective(objective.id, { status: 'completed' });
    let row = (await api.getObjectives(pillar.id))[0]!;
    expect(typeof row.closed_at).toBe('string');
    await api.updateObjective(objective.id, { close_note: 'Ran every morning' });
    await api.setObjectiveStatus(objective.id, 'active');
    row = (await api.getObjectives(pillar.id))[0]!;
    expect(row.status).toBe('active');
    expect(row.close_note).toBe('Ran every morning');
  });

  it('metric_start is captured on create so counting-down goals start at 0%', async () => {
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const objective = await api.addObjective({ ...objectiveInput(pillar.id), metric_current: 90, metric_target: 70, metric_unit: 'kg' });
    expect(objective.metric_start).toBe(90);
  });

  it('updating an unknown goal or task throws instead of silently doing nothing', async () => {
    await expect(api.updateObjective('nope', { title: 'x' })).rejects.toThrow(/does not exist/);
    await expect(api.updateTask('nope', { title: 'x' })).rejects.toThrow(/does not exist/);
  });
});

describe('schedule-aware streaks (US-069)', () => {
  // 2026-10-19 is a Monday.
  const MWF = 0b0010101;
  it('a Mon/Wed/Fri habit does not break on Tue/Thu/weekend', () => {
    const done = new Set(['2026-10-12', '2026-10-14', '2026-10-16', '2026-10-19']); // Mon Wed Fri Mon
    expect(api.scheduledStreaks(done, MWF, '2026-10-20')).toEqual({ current: 4, best: 4 }); // Tuesday
  });
  it('missing a scheduled day breaks it; today being open does not', () => {
    const done = new Set(['2026-10-12', '2026-10-16', '2026-10-19']); // missed Wed 14
    expect(api.scheduledStreaks(done, MWF, '2026-10-21').current).toBe(2); // Wed 21 still open → Fri+Mon
    expect(api.scheduledStreaks(done, MWF, '2026-10-21').best).toBe(2);
  });
  it('every-day habits behave like before; no day scheduled means no streak', () => {
    expect(api.scheduledStreaks(new Set(['2026-10-19', '2026-10-20']), 127, '2026-10-20')).toEqual({ current: 2, best: 2 });
    expect(api.scheduledStreaks(new Set(['2026-10-19']), 0, '2026-10-20')).toEqual({ current: 0, best: 0 });
  });
  it('a habit cannot be saved with no scheduled day', async () => {
    api.deleteAllData();
    const pillar = await api.addGoal(goalInput({ name: 'Body' }));
    const habit = await api.addAction(actionInput(pillar.id));
    await expect(api.updateAction(habit.id, { days_mask: 0 })).rejects.toThrow(/at least one day/);
  });
  it('session history labels task sessions by task title and pillar-only sessions "Free time"', async () => {
    api.deleteAllData();
    const pillar = await api.addGoal(goalInput({ name: 'Craft' }));
    const objective = await api.addObjective({ pillar_id: pillar.id, title: 'Ship MVP', done_when: '', deadline: FUTURE, status: 'active', metric_current: null, metric_target: null, metric_unit: null, sort_order: 0 });
    const task = await api.addTask({ objective_id: objective.id, title: 'Landing page' });
    const now = new Date().toISOString();
    await api.saveFocusSession({ action_id: null as unknown as string, goal_id: pillar.id, started_at: now, ended_at: now, duration_seconds: 600, note: null, was_completed: 1, task_id: task.id, objective_id: null });
    await api.saveFocusSession({ action_id: null as unknown as string, goal_id: pillar.id, started_at: now, ended_at: now, duration_seconds: 300, note: null, was_completed: 1, task_id: null, objective_id: null });
    const labels = api.getSessionHistoryList({ goalId: 'all', timeRange: 'all' }).map((r) => r.action_name).sort();
    expect(labels).toEqual(['Free time', 'Landing page']);
    expect(api.getSessionsForObjective(objective.id).map((r) => r.label)).toEqual(['Landing page']);
  });
});
