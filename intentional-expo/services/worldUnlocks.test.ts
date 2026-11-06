import { describe, expect, it } from 'vitest';
import { STAGES } from './lifeLedger';
import { effectiveWorld, isWorldUnlocked, unlockLabel, worldForStageHours, worldOrder, worldStatuses } from './worldUnlocks';

describe('Flick\'s worlds are earned with real hours (US-101)', () => {
  it('five worlds, in the order they are earned, each at one of Flick\'s stages', () => {
    expect(worldOrder()).toEqual(['hill', 'forest', 'beach', 'lake', 'rooftop']);
    const stageHours = STAGES.map((s) => s.hours);
    for (const s of worldStatuses(0)) expect(stageHours).toContain(s.unlockHours);
  });
  it('the hill from the start; the Forest at 10 h, the Beach at 50 h, the Lake at 150 h, the Rooftop at 500 h', () => {
    expect(worldStatuses(0).filter((w) => w.unlocked).map((w) => w.id)).toEqual(['hill']);
    expect(isWorldUnlocked('forest', 9.99)).toBe(false);
    expect(isWorldUnlocked('forest', 10)).toBe(true);
    expect(worldStatuses(60).filter((w) => w.unlocked).map((w) => w.id)).toEqual(['hill', 'forest', 'beach']);
    expect(isWorldUnlocked('rooftop', 499)).toBe(false);
    expect(isWorldUnlocked('rooftop', 500)).toBe(true);
    expect(isWorldUnlocked('nowhere', 9999)).toBe(false);
  });
  it('the hours still to give, rounded up, and the words', () => {
    const s = worldStatuses(7.2);
    expect(s.find((w) => w.id === 'forest')).toMatchObject({ unlocked: false, hoursToUnlock: 3 });
    expect(s.find((w) => w.id === 'beach')!.hoursToUnlock).toBe(43);
    expect(unlockLabel({ unlocked: false, hoursToUnlock: 1300 })).toBe('1,300 h to unlock');
    expect(unlockLabel({ unlocked: true, hoursToUnlock: 0 })).toBe('Unlocked');
  });
  it('a stage-up unlocks its world (none for Spark or Sun)', () => {
    expect(worldForStageHours(10)).toBe('forest');
    expect(worldForStageHours(50)).toBe('beach');
    expect(worldForStageHours(0)).toBeNull();
    expect(worldForStageHours(1000)).toBeNull();
  });
  it('a locked or unknown choice falls back to Flick\'s hill', () => {
    expect(effectiveWorld('beach', 60)).toBe('beach');
    expect(effectiveWorld('beach', 20)).toBe('hill');
    expect(effectiveWorld('nowhere', 600)).toBe('hill');
    expect(effectiveWorld(null, 600)).toBe('hill');
  });
});
