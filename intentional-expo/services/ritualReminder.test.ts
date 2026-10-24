import { beforeEach, describe, expect, it, vi } from 'vitest';

const n = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
}));
vi.mock('expo-notifications', () => ({ ...n, SchedulableTriggerInputTypes: { WEEKLY: 'weekly' } }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('@/db', async () => import('@/db/index.web'));

const { syncRitualReminder } = await import('./ritualReminder');
const db = await import('@/db/index.web');

describe('syncRitualReminder (US-082)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    n.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    db.setSetting('ritual_reminder', '');
    db.setSetting('ritual_time', '');
    db.setSetting('partner', '');
  });

  it('is on by default: Sunday 18:00, opens the ritual', async () => {
    await syncRitualReminder();
    expect(n.cancelScheduledNotificationAsync).toHaveBeenCalledWith('weekly-review-sunday');
    expect(n.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'weekly-review-sunday',
      content: { title: 'Your week is ready 🔥', body: 'See where your hours went and plan next week. 3 minutes.', data: { screen: 'ritual' } },
      trigger: { type: 'weekly', weekday: 1, hour: 18, minute: 0 },
    });
  });

  it('uses the chosen time and names the partner', async () => {
    db.setSetting('ritual_time', '20:30');
    db.setSetting('partner', JSON.stringify({ name: 'Sam', phone: null, since: '2026-10-01T00:00:00.000Z', invitedAt: null }));
    await syncRitualReminder();
    const arg = n.scheduleNotificationAsync.mock.calls[0]![0];
    expect(arg.trigger).toMatchObject({ hour: 20, minute: 30 });
    expect(arg.content.body).toContain('send it to Sam');
  });

  it('turned off: cancels and schedules nothing; no permission: touches nothing (never prompts)', async () => {
    db.setSetting('ritual_reminder', '0');
    await syncRitualReminder();
    expect(n.cancelScheduledNotificationAsync).toHaveBeenCalled();
    expect(n.scheduleNotificationAsync).not.toHaveBeenCalled();
    vi.clearAllMocks();
    n.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
    await syncRitualReminder();
    expect(n.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });
});
