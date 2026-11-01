import { describe, expect, it } from 'vitest';
import type { Objective, Task } from '@/types';
import { buildSessionReward, formatGiven } from './sessionReward';

const H = 3600;
const objective = (over: Partial<Objective> = {}): Objective => ({
  id: 'o1',
  pillar_id: 'p1',
  title: 'Half marathon',
  done_when: '',
  deadline: '2999-01-01',
  status: 'active',
  metric_current: null,
  metric_target: null,
  metric_unit: null,
  metric_start: null,
  sort_order: 0,
  created_at: new Date().toISOString(),
  closed_at: null,
  close_note: null,
  ...over,
});
const task = (id: string, done: 0 | 1): Task =>
  ({ id, objective_id: 'o1', title: id, estimate_minutes: 30, planned_date: null, is_done: done, done_at: null, sort_order: 0, created_at: '' }) as Task;

describe('buildSessionReward (US-084)', () => {
  it('minutes added and the stage bar moving toward the next stage', () => {
    // 20h → 21h: Flame (10–50h), 0.25 → 0.275, 29h to Torch.
    const r = buildSessionReward({ sessionSeconds: 3600, lifetimeSecondsAfter: 21 * H, seenStageIndex: 1 });
    expect(r.minutes).toBe(60);
    expect(r.stage).toMatchObject({ name: 'Flame', index: 1, stagedUp: false, toNextLabel: '29h to Torch' });
    expect(r.stage.from).toBeCloseTo(0.25);
    expect(r.stage.to).toBeCloseTo(0.275);
    expect(r.goal).toBeNull();
  });

  it('crossing a stage: stagedUp, the bar starts over on the new stage', () => {
    const r = buildSessionReward({ sessionSeconds: 30 * 60, lifetimeSecondsAfter: 10 * H + 15 * 60, seenStageIndex: 0 });
    expect(r.stage).toMatchObject({ name: 'Flame', index: 1, stagedUp: true, from: 0 });
    expect(r.stage.to).toBeCloseTo(0.25 / 40);
  });

  it('a stage already celebrated is not a stage-up again', () => {
    const r = buildSessionReward({ sessionSeconds: 30 * 60, lifetimeSecondsAfter: 10 * H + 15 * 60, seenStageIndex: 1 });
    expect(r.stage.stagedUp).toBe(false);
  });

  it('never demotes Flick when sessions were deleted (seen stage above the hours)', () => {
    const r = buildSessionReward({ sessionSeconds: 600, lifetimeSecondsAfter: 40 * H, seenStageIndex: 2 });
    expect(r.stage).toMatchObject({ name: 'Torch', index: 2, stagedUp: false, from: 0, to: 0 });
    expect(r.stage.toNextLabel).toBe('110h to Bonfire');
  });

  it('Sun: the brightest stage, a full bar', () => {
    const r = buildSessionReward({ sessionSeconds: 600, lifetimeSecondsAfter: 1200 * H, seenStageIndex: 5 });
    expect(r.stage).toMatchObject({ name: 'Sun', to: 1, toNextLabel: 'the brightest stage' });
  });

  it('Flick rises: ends brighter than it starts, blazing after a full 25 minutes', () => {
    const long = buildSessionReward({ sessionSeconds: 50 * 60, lifetimeSecondsAfter: 50 * 60 });
    expect(long.flick.to).toBe(1);
    expect(long.flick.from).toBeLessThan(long.flick.to);
    const short = buildSessionReward({ sessionSeconds: 60, lifetimeSecondsAfter: 60 });
    expect(short.flick.to).toBeGreaterThanOrEqual(0.8);
    expect(short.flick.from).toBeLessThan(short.flick.to);
  });

  it('goal: hours before and after, task progress', () => {
    const r = buildSessionReward({
      sessionSeconds: 45 * 60,
      lifetimeSecondsAfter: 10 * H,
      goal: { objective: objective(), tasks: [task('a', 1), task('b', 0), task('c', 0), task('d', 0)], secondsAfter: 3 * H },
    });
    expect(r.goal).toEqual({ id: 'o1', title: 'Half marathon', minutesBefore: 135, minutesAfter: 180, progress: 0.25 });
  });

  it('goal with nothing to measure: no bar (progress null)', () => {
    const r = buildSessionReward({ sessionSeconds: 60, lifetimeSecondsAfter: 60, goal: { objective: objective(), tasks: [], secondsAfter: 60 } });
    expect(r.goal).toMatchObject({ minutesBefore: 0, minutesAfter: 1, progress: null });
  });

  it('a zero-length or negative input never goes below zero', () => {
    const r = buildSessionReward({ sessionSeconds: -5, lifetimeSecondsAfter: 0 });
    expect(r.minutes).toBe(0);
    expect(r.stage).toMatchObject({ name: 'Spark', from: 0, to: 0, stagedUp: false });
  });
});

describe('formatGiven', () => {
  it.each([
    [0, '0m'],
    [30, '30m'],
    [60, '1h'],
    [65, '1h 05m'],
    [750, '12h 30m'],
  ])('%i → %s', (m, out) => expect(formatGiven(m)).toBe(out));
});
