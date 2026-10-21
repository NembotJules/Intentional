/**
 * US-074: "Set a goal" nudges for goal-less pillars. Dismissed per pillar for 14 days; never shown for
 * pillars marked "runs on habits" (api.getMaintenancePillars). Shared by Today and the Goals tab.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@intentional/goalNudgeDismissed';
export const NUDGE_SNOOZE_DAYS = 14;

/** pillarId → ISO time it was dismissed */
export async function getDismissedNudges(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function dismissNudge(pillarId: string, now: Date = new Date()): Promise<void> {
  const all = await getDismissedNudges();
  all[pillarId] = now.toISOString();
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

/** True while a dismissal is younger than 14 days. */
export function isNudgeSnoozed(dismissed: Record<string, string>, pillarId: string, now: Date = new Date()): boolean {
  const at = dismissed[pillarId];
  if (!at) return false;
  return now.getTime() - Date.parse(at) < NUDGE_SNOOZE_DAYS * 24 * 60 * 60 * 1000;
}
