/**
 * One call keeps the OS in step with the person's habits (US-075 → US-077):
 *   - habit start notifications (+ heads-ups) for the next 7 days (services/notifications.ts)
 *   - strict-mode app blocking windows (services/appBlocking.ts)
 * Call it after anything that changes what should fire: habit created/edited/paused/archived,
 * a session saved, a habit checked/skipped, app start and app foreground.
 */
import { syncHabitAlerts } from '@/services/notifications';
import { syncHabitBlocks } from '@/services/appBlocking';

let running: Promise<void> | null = null;
let again = false;

export function syncHabits(): Promise<void> {
  // Coalesce bursts of calls into at most one extra run.
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await Promise.allSettled([syncHabitAlerts(), syncHabitBlocks()]);
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}
