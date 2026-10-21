import { describe, expect, it } from 'vitest';
import { progressOf, daysLeft, paceOf, type Pace } from './goalProgress';
import type { Objective, Task } from '@/types';

function objective(overrides: Partial<Objective> = {}): Objective {
  return {
    id: 'obj-1',
    pillar_id: 'pillar-1',
    title: 'Run a half marathon',
    done_when: 'Complete 21km race',
    deadline: '2026-12-31',
    status: 'active',
    metric_current: null,
    metric_target: null,
    metric_unit: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    closed_at: null,
    close_note: null,
    ...overrides,
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    objective_id: 'obj-1',
    title: 'Buy running shoes',
    estimate_minutes: 30,
    planned_date: null,
    is_done: 0,
    done_at: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('goalProgress', () => {
  describe('progressOf', () => {
    it('returns null when no metric and no tasks', () => {
      const obj = objective();
      expect(progressOf(obj, [])).toBeNull();
    });

    it('returns 0 when no tasks are done', () => {
      const obj = objective();
      const tasks = [task(), task({ id: 'task-2' })];
      expect(progressOf(obj, tasks)).toBe(0);
    });

    it('returns fraction of done tasks', () => {
      const obj = objective();
      const tasks = [
        task({ is_done: 1 }),
        task({ id: 'task-2', is_done: 0 }),
        task({ id: 'task-3', is_done: 1 }),
        task({ id: 'task-4', is_done: 0 }),
      ];
      expect(progressOf(obj, tasks)).toBe(0.5);
    });

    it('returns 1.0 when all tasks are done', () => {
      const obj = objective();
      const tasks = [
        task({ is_done: 1 }),
        task({ id: 'task-2', is_done: 1 }),
      ];
      expect(progressOf(obj, tasks)).toBe(1.0);
    });

    it('uses metric when metric_target is set (counting up)', () => {
      const obj = objective({
        metric_current: 3000,
        metric_target: 5000,
        metric_unit: 'euros',
      });
      // Current is 3000, target is 5000 (counting up)
      // Progress = current / target = 3000 / 5000 = 0.6
      expect(progressOf(obj, [])).toBe(0.6);
    });

    it('counting down measures from where the metric started (90 → 70 kg)', () => {
      expect(progressOf(objective({ metric_start: 90, metric_current: 90, metric_target: 70, metric_unit: 'kg' }), [])).toBe(0);
      expect(progressOf(objective({ metric_start: 90, metric_current: 80, metric_target: 70, metric_unit: 'kg' }), [])).toBeCloseTo(0.5, 5);
      expect(progressOf(objective({ metric_start: 90, metric_current: 68, metric_target: 70, metric_unit: 'kg' }), [])).toBe(1);
    });

    it('counting down without a known start falls back to tasks (no fake 78%)', () => {
      const obj = objective({ metric_current: 90, metric_target: 70, metric_unit: 'kg' });
      expect(progressOf(obj, [])).toBeNull();
      expect(progressOf(obj, [task({ is_done: 1 }), task({ is_done: 0 })])).toBe(0.5);
    });

    it('paying a debt down to 0 shows partial progress', () => {
      expect(progressOf(objective({ metric_start: 1000, metric_current: 250, metric_target: 0 }), [])).toBeCloseTo(0.75, 5);
    });

    it('overshooting a count-up target counts as done, not 83%', () => {
      expect(progressOf(objective({ metric_start: 0, metric_current: 6000, metric_target: 5000 }), [])).toBe(1);
    });

    it('returns 1.0 when metric current equals target', () => {
      const obj = objective({
        metric_current: 5000,
        metric_target: 5000,
        metric_unit: 'euros',
      });
      expect(progressOf(obj, [])).toBe(1.0);
    });

    it('prefers metric over task count when both exist (values differ so the source is visible)', () => {
      const obj = objective({
        metric_current: 2500,
        metric_target: 5000,
        metric_unit: 'euros',
      });
      // tasks alone would say 1/4 = 0.25; the metric says 2500/5000 = 0.5
      const tasks = [task({ is_done: 1 }), task({ id: 'task-2', is_done: 0 }), task({ id: 'task-3', is_done: 0 }), task({ id: 'task-4', is_done: 0 })];
      expect(progressOf(obj, tasks)).toBe(0.5);
    });
  });

  describe('daysLeft', () => {
    it('returns positive days when deadline is in future', () => {
      const obj = objective({ deadline: '2026-12-31' });
      const today = new Date('2026-12-01T10:00:00.000Z');
      expect(daysLeft(obj, today)).toBe(30);
    });

    it('returns 0 when today is the deadline', () => {
      const obj = objective({ deadline: '2026-12-31' });
      const today = new Date('2026-12-31T15:30:00.000Z');
      expect(daysLeft(obj, today)).toBe(0);
    });

    it('returns negative days when deadline has passed', () => {
      const obj = objective({ deadline: '2026-12-31' });
      const today = new Date('2027-01-05T10:00:00.000Z');
      expect(daysLeft(obj, today)).toBe(-5);
    });

    it('handles same-day deadline', () => {
      const obj = objective({
        created_at: '2026-12-31T00:00:00.000Z',
        deadline: '2026-12-31',
      });
      const today = new Date('2026-12-31T12:00:00.000Z');
      expect(daysLeft(obj, today)).toBe(0);
    });
  });

  describe('paceOf', () => {
    it('a goal past its deadline and not done is behind, however close it is', () => {
      const created = new Date(2026, 0, 1);
      const obj = objective({ created_at: created.toISOString(), deadline: '2026-03-01' });
      const tasks = Array.from({ length: 20 }, (_, i) => task({ id: 't' + i, is_done: i < 19 ? 1 : 0 })); // 95%
      expect(paceOf(obj, tasks, new Date(2026, 6, 1))).toBe('behind');
    });

    it('band edges: exactly elapsed ± 10% is on track, beyond is ahead/behind', () => {
      const created = new Date(2026, 0, 1, 0, 0, 0);
      const obj = objective({ created_at: created.toISOString(), deadline: '2026-01-10' });
      const halfway = new Date(created.getTime() + (new Date(2026, 0, 10, 23, 59, 59).getTime() - created.getTime()) / 2);
      const of = (done: number) => Array.from({ length: 100 }, (_, i) => task({ id: 't' + i, is_done: i < done ? 1 : 0 }));
      expect(paceOf(obj, of(45), halfway)).toBe('on_track');
      expect(paceOf(obj, of(55), halfway)).toBe('on_track');
      expect(paceOf(obj, of(65), halfway)).toBe('ahead');
      expect(paceOf(obj, of(35), halfway)).toBe('behind');
    });

    it('returns unknown when progress is null', () => {
      const obj = objective();
      expect(paceOf(obj, [], new Date('2026-06-15T10:00:00.000Z'))).toBe('unknown');
    });

    it('returns on_track when progress matches elapsed time', () => {
      // Created Jan 1, deadline Dec 31 (365 days)
      // Today is July 2 (halfway through year = ~182 days)
      // 2 of 4 tasks done = 50% progress
      const obj = objective({
        created_at: '2026-01-01T00:00:00.000Z',
        deadline: '2026-12-31',
      });
      const tasks = [
        task({ is_done: 1 }),
        task({ id: 'task-2', is_done: 1 }),
        task({ id: 'task-3', is_done: 0 }),
        task({ id: 'task-4', is_done: 0 }),
      ];
      const today = new Date('2026-07-02T10:00:00.000Z');
      expect(paceOf(obj, tasks, today)).toBe('on_track');
    });

    it('returns ahead when progress exceeds elapsed time', () => {
      // Created Jan 1, deadline Dec 31 (365 days)
      // Today is April 1 (25% through year = ~90 days)
      // 3 of 4 tasks done = 75% progress (way ahead)
      const obj = objective({
        created_at: '2026-01-01T00:00:00.000Z',
        deadline: '2026-12-31',
      });
      const tasks = [
        task({ is_done: 1 }),
        task({ id: 'task-2', is_done: 1 }),
        task({ id: 'task-3', is_done: 1 }),
        task({ id: 'task-4', is_done: 0 }),
      ];
      const today = new Date('2026-04-01T10:00:00.000Z');
      expect(paceOf(obj, tasks, today)).toBe('ahead');
    });

    it('returns behind when progress lags elapsed time', () => {
      // Created Jan 1, deadline Dec 31 (365 days)
      // Today is Oct 1 (75% through year = ~273 days)
      // 1 of 4 tasks done = 25% progress (way behind)
      const obj = objective({
        created_at: '2026-01-01T00:00:00.000Z',
        deadline: '2026-12-31',
      });
      const tasks = [
        task({ is_done: 1 }),
        task({ id: 'task-2', is_done: 0 }),
        task({ id: 'task-3', is_done: 0 }),
        task({ id: 'task-4', is_done: 0 }),
      ];
      const today = new Date('2026-10-01T10:00:00.000Z');
      expect(paceOf(obj, tasks, today)).toBe('behind');
    });

    it('handles ±10% tolerance band correctly', () => {
      // Created Jan 1, deadline Dec 31
      // Today is July 2 (50% through year)
      // Progress at 55% should be on_track (within 50% ± 10%)
      const obj = objective({
        created_at: '2026-01-01T00:00:00.000Z',
        deadline: '2026-12-31',
      });
      const tasks = [
        task({ is_done: 1 }),
        task({ id: 'task-2', is_done: 1 }),
        task({ id: 'task-3', is_done: 0 }),
        task({ id: 'task-4', is_done: 0 }),
        task({ id: 'task-5', is_done: 0 }),
        task({ id: 'task-6', is_done: 0 }),
        task({ id: 'task-7', is_done: 0 }),
        task({ id: 'task-8', is_done: 0 }),
        task({ id: 'task-9', is_done: 0 }),
        task({ id: 'task-10', is_done: 0 }),
        task({ id: 'task-11', is_done: 0 }),
      ];
      // 2 of 11 tasks = 18.2% (should be behind at 50% elapsed)
      const today = new Date('2026-07-02T10:00:00.000Z');
      expect(paceOf(obj, tasks, today)).toBe('behind');
    });

    it('returns on_track when past deadline but complete', () => {
      const obj = objective({
        created_at: '2026-01-01T00:00:00.000Z',
        deadline: '2026-12-31',
      });
      const tasks = [
        task({ is_done: 1 }),
        task({ id: 'task-2', is_done: 1 }),
      ];
      const today = new Date('2027-01-15T10:00:00.000Z');
      // Progress is 100%, elapsed is >100% (late but complete), within ±10% tolerance
      expect(paceOf(obj, tasks, today)).toBe('on_track');
    });

    it('handles same-day deadline with no progress', () => {
      const obj = objective({
        created_at: '2026-12-31T00:00:00.000Z',
        deadline: '2026-12-31',
      });
      const tasks = [task()];
      const today = new Date('2026-12-31T12:00:00.000Z');
      // 0% progress, ~50% elapsed (noon), should be behind
      expect(paceOf(obj, tasks, today)).toBe('behind');
    });

    it('handles same-day deadline with complete progress', () => {
      const obj = objective({
        created_at: '2026-12-31T00:00:00.000Z',
        deadline: '2026-12-31',
      });
      const tasks = [task({ is_done: 1 })];
      const today = new Date('2026-12-31T12:00:00.000Z');
      // 100% progress, ~50% elapsed, should be ahead
      expect(paceOf(obj, tasks, today)).toBe('ahead');
    });

    it('uses metric progress when available', () => {
      const obj = objective({
        created_at: '2026-01-01T00:00:00.000Z',
        deadline: '2026-12-31',
        metric_current: 2500,
        metric_target: 5000,
        metric_unit: 'euros',
      });
      const today = new Date('2026-07-02T10:00:00.000Z');
      // Metric progress: current=2500, target=5000, so 50% progress
      // Elapsed: ~50%
      // Should be on_track
      expect(paceOf(obj, [], today)).toBe('on_track');
    });
  });
});
