/**
 * US-077 strict mode: the JS half of scheduled app blocking (the native module is mocked; the
 * DeviceActivityMonitor extension itself needs a device build, see README "Strict mode").
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

let platformOS = 'ios';
vi.mock('react-native', () => ({
  Platform: { get OS() { return platformOS; } },
}));

const settings = vi.hoisted(() => new Map<string, string>());
const habits = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

vi.mock('@/db/api', () => ({
  getSetting: (k: string) => settings.get(k) ?? null,
  getAllActionsWithGoal: () => habits.rows,
}));
vi.mock('@/db', () => ({
  setSetting: (k: string, v: string) => void settings.set(k, v),
}));

const fc = vi.hoisted(() => ({
  getAuthorizationStatus: vi.fn(),
  requestAuthorization: vi.fn(),
  applyShields: vi.fn(),
  removeShields: vi.fn(),
  presentActivityPicker: vi.fn(),
  setSharedSelection: vi.fn(),
  scheduleHabitBlocks: vi.fn(),
  clearHabitBlocks: vi.fn(),
  getActiveHabitBlock: vi.fn(),
  endActiveHabitBlock: vi.fn(),
}));
vi.mock('../modules/family-controls/index', () => fc);

const blocking = await import('./appBlocking');

function habit(over: Record<string, unknown> = {}) {
  return {
    id: 'h1',
    goal_id: 'g1',
    goal_name: 'Health',
    goal_color: 'blue',
    goal_icon: 'run',
    name: 'Run',
    type: 'session',
    target_minutes: 30,
    reminder_time: '07:00',
    is_active: 1,
    sort_order: 0,
    objective_id: null,
    days_mask: 127,
    strict: 1,
    ...over,
  };
}

// days_mask: bit 0 = Monday … bit 6 = Sunday
const MON = 1, WED = 1 << 2, SUN = 1 << 6;

describe('toHabitBlocks', () => {
  it('turns an every-day habit into one daily block (weekday null)', () => {
    const { blocks, dropped } = blocking.toHabitBlocks([{ habitId: 'h1', weekdays: [1, 2, 3, 4, 5, 6, 7], startHour: 7, startMinute: 0, endHour: 7, endMinute: 30 }]);
    expect(blocks).toEqual([{ id: 'h1', weekday: null, startHour: 7, startMinute: 0, endHour: 7, endMinute: 30 }]);
    expect(dropped).toBe(0);
  });

  it('flattens a weekday habit into one block per weekday (1 = Sunday … 7 = Saturday)', () => {
    const { blocks } = blocking.toHabitBlocks([{ habitId: 'h1', weekdays: [4, 2], startHour: 18, startMinute: 15, endHour: 19, endMinute: 0 }]);
    expect(blocks).toEqual([
      { id: 'h1', weekday: 2, startHour: 18, startMinute: 15, endHour: 19, endMinute: 0 },
      { id: 'h1', weekday: 4, startHour: 18, startMinute: 15, endHour: 19, endMinute: 0 },
    ]);
  });

  it('lengthens windows shorter than the 15-min iOS minimum, ending at 23:59 at the latest', () => {
    const short = blocking.toHabitBlocks([{ habitId: 'a', weekdays: [1], startHour: 9, startMinute: 50, endHour: 9, endMinute: 55 }]).blocks[0];
    expect(short).toMatchObject({ startHour: 9, startMinute: 50, endHour: 10, endMinute: 5 });
    const late = blocking.toHabitBlocks([{ habitId: 'b', weekdays: [1], startHour: 23, startMinute: 50, endHour: 23, endMinute: 59 }]).blocks[0];
    expect(late).toMatchObject({ startHour: 23, startMinute: 44, endHour: 23, endMinute: 59 });
  });

  it('caps at 20 monitored activities and reports the rest as dropped', () => {
    const many = Array.from({ length: 4 }, (_, i) => ({ habitId: `h${i}`, weekdays: [1, 2, 3, 4, 5, 6], startHour: 8, startMinute: 0, endHour: 9, endMinute: 0 }));
    const { blocks, dropped } = blocking.toHabitBlocks(many);
    expect(blocks).toHaveLength(20);
    expect(dropped).toBe(4);
    expect(blocks.at(-1)).toMatchObject({ id: 'h3', weekday: 2 }); // h3 keeps its first two days (Sun, Mon)
  });
});

describe('syncHabitBlocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformOS = 'ios';
    settings.clear();
    settings.set('fc_selection', 'c2VsZWN0aW9u');
    habits.rows = [habit()];
    fc.getAuthorizationStatus.mockReturnValue('approved');
    fc.scheduleHabitBlocks.mockImplementation(async (b: unknown[]) => ({ scheduled: b.length, requested: b.length }));
  });

  it('schedules strict habits per weekday, mirrors the selection and sets the flag to 1', async () => {
    habits.rows = [
      habit({ id: 'run', reminder_time: '07:00', target_minutes: 30, days_mask: MON | WED }),
      habit({ id: 'read', reminder_time: '21:30', target_minutes: 20, days_mask: 127 }),
      habit({ id: 'loose', strict: 0, days_mask: SUN }), // strict off: never blocked
      habit({ id: 'anytime', reminder_time: null }), // no start time: nothing to schedule
      habit({ id: 'paused', is_active: 0 }),
    ];
    await blocking.syncHabitBlocks();
    expect(fc.setSharedSelection).toHaveBeenCalledWith('c2VsZWN0aW9u');
    expect(fc.scheduleHabitBlocks).toHaveBeenCalledTimes(1);
    expect(fc.scheduleHabitBlocks.mock.calls[0][0]).toEqual([
      { id: 'run', weekday: 2, startHour: 7, startMinute: 0, endHour: 7, endMinute: 30 },
      { id: 'run', weekday: 4, startHour: 7, startMinute: 0, endHour: 7, endMinute: 30 },
      { id: 'read', weekday: null, startHour: 21, startMinute: 30, endHour: 21, endMinute: 50 },
    ]);
    expect(fc.clearHabitBlocks).not.toHaveBeenCalled();
    expect(settings.get('strict_autoblock_active')).toBe('1');
  });

  it('with no app selection: clears every window and sets the flag to 0', async () => {
    settings.delete('fc_selection');
    settings.set('strict_autoblock_active', '1');
    await blocking.syncHabitBlocks();
    expect(fc.setSharedSelection).toHaveBeenCalledWith(null);
    expect(fc.clearHabitBlocks).toHaveBeenCalledTimes(1);
    expect(fc.scheduleHabitBlocks).not.toHaveBeenCalled();
    expect(settings.get('strict_autoblock_active')).toBe('0');
  });

  it('without Screen Time permission: clears and sets the flag to 0 (never prompts from a sync)', async () => {
    fc.getAuthorizationStatus.mockReturnValue('notDetermined');
    await blocking.syncHabitBlocks();
    expect(fc.requestAuthorization).not.toHaveBeenCalled();
    expect(fc.clearHabitBlocks).toHaveBeenCalledTimes(1);
    expect(fc.scheduleHabitBlocks).not.toHaveBeenCalled();
    expect(settings.get('strict_autoblock_active')).toBe('0');
  });

  it('when every strict habit is turned off: clears and sets the flag to 0', async () => {
    habits.rows = [habit({ strict: 0 })];
    settings.set('strict_autoblock_active', '1');
    await blocking.syncHabitBlocks();
    expect(fc.clearHabitBlocks).toHaveBeenCalledTimes(1);
    expect(fc.scheduleHabitBlocks).not.toHaveBeenCalled();
    expect(settings.get('strict_autoblock_active')).toBe('0');
  });

  it('where blocking is unavailable (Expo Go / old build): flag 0 and no native calls', async () => {
    fc.getAuthorizationStatus.mockReturnValue('unsupported');
    settings.set('strict_autoblock_active', '1');
    await blocking.syncHabitBlocks();
    expect(fc.scheduleHabitBlocks).not.toHaveBeenCalled();
    expect(fc.setSharedSelection).not.toHaveBeenCalled();
    expect(settings.get('strict_autoblock_active')).toBe('0');
  });

  it('on Android / web: flag 0 and no native calls', async () => {
    platformOS = 'android';
    await blocking.syncHabitBlocks();
    expect(fc.getAuthorizationStatus).not.toHaveBeenCalled();
    expect(fc.scheduleHabitBlocks).not.toHaveBeenCalled();
    expect(settings.get('strict_autoblock_active')).toBe('0');
  });

  it('when iOS refuses a schedule (e.g. excessiveActivities): flag 0, no throw', async () => {
    fc.scheduleHabitBlocks.mockResolvedValue({ scheduled: 0, requested: 1, error: 'excessiveActivities' });
    await expect(blocking.syncHabitBlocks()).resolves.toBeUndefined();
    expect(settings.get('strict_autoblock_active')).toBe('0');
  });

  it('when the native call throws: flag 0, no throw', async () => {
    fc.scheduleHabitBlocks.mockRejectedValue(new Error('boom'));
    settings.set('strict_autoblock_active', '1');
    await expect(blocking.syncHabitBlocks()).resolves.toBeUndefined();
    expect(settings.get('strict_autoblock_active')).toBe('0');
  });

  it('when some windows were dropped over the 20-activity cap: flag 0 (copy must not promise a block)', async () => {
    habits.rows = Array.from({ length: 4 }, (_, i) => habit({ id: `h${i}`, days_mask: 127 & ~SUN }));
    await blocking.syncHabitBlocks();
    expect(fc.scheduleHabitBlocks.mock.calls[0][0]).toHaveLength(20);
    expect(settings.get('strict_autoblock_active')).toBe('0');
  });
});

describe('selection and lifting a block', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformOS = 'ios';
    settings.clear();
  });

  it('saving a selection also mirrors it to the App Group for the extension', () => {
    blocking.saveSelection('bmV3');
    expect(settings.get('fc_selection')).toBe('bmV3');
    expect(fc.setSharedSelection).toHaveBeenCalledWith('bmV3');
  });

  it('endActiveHabitBlock passes the habit through to the native module', () => {
    blocking.endActiveHabitBlock('h1');
    expect(fc.endActiveHabitBlock).toHaveBeenCalledWith('h1');
  });

  it('endActiveHabitBlock is a no-op off iOS', () => {
    platformOS = 'web';
    blocking.endActiveHabitBlock('h1');
    expect(fc.endActiveHabitBlock).not.toHaveBeenCalled();
  });
});
