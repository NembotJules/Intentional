/**
 * The Sunday ritual reminder (US-082): one weekly notification, Sunday at the chosen time (18:00 by default),
 * on by default. Synced with the habit alerts (services/habitSync) so it never needs its own prompt:
 * it is only scheduled once notifications are allowed. Uses the old weekly-review id so it replaces it.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getPartner } from '@/services/partner';
import { isRitualReminderOn, ritualReminderContent, ritualTime } from '@/services/ritual';

export const RITUAL_NOTIF_ID = 'weekly-review-sunday';

async function allowed(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.status === 'granted' || (p as { granted?: boolean }).granted === true;
  } catch {
    return false;
  }
}

export async function syncRitualReminder(): Promise<void> {
  try {
    if (!(await allowed())) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(RITUAL_NOTIF_ID);
    } catch {
      // not scheduled
    }
    if (!isRitualReminderOn()) return;
    const { hour, minute } = ritualTime();
    const { title, body } = ritualReminderContent(getPartner()?.name);
    await Notifications.scheduleNotificationAsync({
      identifier: RITUAL_NOTIF_ID,
      content: { title, body, data: { screen: 'ritual' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour, minute },
    });
  } catch {
    // never throw from a background sync
  }
}
