import { describe, expect, it } from 'vitest';
import { buildLedger, stageFor } from './lifeLedger';

describe('stageFor (US-079 thresholds)', () => {
  it('maps lifetime hours to a stage, with what is left to the next', () => {
    expect(stageFor(0)).toMatchObject({ name: 'Spark', hoursToNext: 10, next: { name: 'Flame', hours: 10 } });
    expect(stageFor(9.99).name).toBe('Spark');
    expect(stageFor(10)).toMatchObject({ name: 'Flame', hoursToNext: 40 });
    expect(stageFor(13).hoursToNext).toBe(37);
    expect(stageFor(150).name).toBe('Bonfire');
    expect(stageFor(1000)).toMatchObject({ name: 'Sun', next: null, hoursToNext: null, progress: 1 });
    expect(stageFor(5000).name).toBe('Sun');
    expect(stageFor(30).progress).toBeCloseTo(0.5);
  });
});

describe('buildLedger (US-083)', () => {
  const now = new Date(2026, 9, 25, 12);
  const at = (m: number, d: number) => new Date(2026, m, d, 9).toISOString();
  const s = (goal: string, startedAt: string, mins: number, objective: string | null = null) => ({ goal_id: goal, objective_id: objective, started_at: startedAt, duration_seconds: mins * 60 });
  const pillars = [
    { id: 'body', name: 'Body', color: '#D65A31', icon: 'body' },
    { id: 'craft', name: 'Craft', color: '#A66A00', icon: 'craft' },
    { id: 'old', name: 'Old', color: '#000000', icon: 'x', is_archived: 1 },
  ];

  it('totals the whole history, per pillar and per month, from the first day', () => {
    const l = buildLedger({
      now,
      pillars,
      objectives: [],
      sessions: [s('body', at(7, 3), 60), s('body', at(9, 20), 90), s('craft', at(9, 20), 30), s('gone', at(8, 1), 30), s('body', at(9, 21), 0)],
    });
    expect(l.totalMinutes).toBe(210);
    expect(l.firstDay).toBe('2026-08-03');
    expect(l.activeDays).toBe(3);
    expect(l.sessionCount).toBe(4);
    expect(l.pillars.map((p) => [p.name, p.minutes])).toEqual([
      ['Body', 150],
      ['Craft', 30],
      ['Earlier pillars', 30],
    ]); // archived pillar with no time is left out
    expect(l.pillars[0]!.share).toBeCloseTo(150 / 210);
    expect(l.months).toHaveLength(12);
    expect(l.months[11]).toMatchObject({ key: '2026-10', minutes: 120 });
    expect(l.months[9]).toMatchObject({ key: '2026-08', minutes: 60 });
    expect(l.months[0]!.key).toBe('2025-11');
    expect(l.stage.name).toBe('Spark');
  });

  it('lists achieved goals newest first with their hours and how long they took', () => {
    const l = buildLedger({
      now,
      pillars,
      sessions: [s('craft', at(9, 5), 120, 'g1'), s('body', at(8, 5), 45, 'g2')],
      objectives: [
        { id: 'g1', title: 'Ship site', pillar_id: 'craft', status: 'completed', created_at: at(9, 1), closed_at: at(9, 15) },
        { id: 'g2', title: 'Run 10k', pillar_id: 'body', status: 'completed', created_at: at(8, 1), closed_at: at(8, 30) },
        { id: 'g3', title: 'Dropped', pillar_id: 'body', status: 'dropped', created_at: at(8, 1), closed_at: at(8, 2) },
        { id: 'g4', title: 'Active', pillar_id: 'body', status: 'active', created_at: at(8, 1), closed_at: null },
      ],
    });
    expect(l.goalsAchieved.map((g) => [g.title, g.minutes, g.days])).toEqual([
      ['Ship site', 120, 14],
      ['Run 10k', 45, 29],
    ]);
  });

  it('an empty history is calm, not broken', () => {
    const l = buildLedger({ now, pillars, objectives: [], sessions: [] });
    expect(l).toMatchObject({ totalMinutes: 0, firstDay: null, activeDays: 0, goalsAchieved: [] });
    expect(l.pillars.map((p) => p.name)).toEqual(['Body', 'Craft']);
  });
});
