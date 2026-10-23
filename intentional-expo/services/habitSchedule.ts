/**
 * Habit-time scheduling (US-075 → US-077), pure functions only (no Expo, no DB) so every rule is unit-tested.
 *
 * - buildHabitAlerts: the next N days of habit start alerts (and optional 10-min heads-ups) as one-off
 *   notifications. A rolling window, rebuilt whenever habits/sessions change, so "already done today",
 *   "Skip today", archived pillars and the iOS 64-pending-notifications cap are all respected.
 * - intentFromResponse: what tapping a notification (or one of its buttons) should do.
 * - buildStrictBlocks: the weekly windows during which distracting apps are blocked automatically (strict mode).
 */
import { isScheduledOn, localDayKey, localDayStart, shiftDayKey } from '@/utils/dates';

export const HABIT_CATEGORY = 'habit-start';
export const ACTION_START = 'start-now';
export const ACTION_SNOOZE = 'snooze-10';
export const ACTION_SKIP = 'skip-today';
/** Opening the app later than this after the start time shows the habit instead of auto-starting it. */
export const AUTOSTART_WINDOW_MIN = 30;
export const SNOOZE_MIN = 10;
export const HEADS_UP_MIN = 10;
/** iOS keeps at most 64 pending local notifications per app; leave room for the weekly review and snoozes. */
export const MAX_PENDING = 56;

export interface HabitForSchedule {
  id: string;
  name: string;
  pillarName: string;
  target_minutes: number;
  reminder_time: string | null;
  days_mask: number;
  is_active: number;
  strict?: number;
}

export interface HabitAlert {
  /** Stable notification identifier: habit-<id>-<day>-<kind> */
  id: string;
  habitId: string;
  kind: 'start' | 'headsup';
  dayKey: string;
  fireAt: Date;
  title: string;
  body: string;
  data: { actionId: string; kind: 'start' | 'headsup'; scheduledAt: string };
}

export function parseHHMM(raw: string | null): { hour: number; minute: number } | null {
  if (!raw) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function at(dayKey: string, hour: number, minute: number): Date {
  const d = localDayStart(dayKey);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Notification copy for a habit's start time. `autoBlock` = strict mode is really active on this device. */
export function startAlertContent(h: HabitForSchedule, opts: { blockingAvailable: boolean; autoBlock: boolean }): { title: string; body: string } {
  const mins = Math.max(1, Math.round(h.target_minutes));
  const title = `🔥 ${h.name} · ${h.pillarName}`;
  const strict = (h.strict ?? 1) === 1;
  if (strict && opts.autoBlock) return { title, body: `Apps blocked. Tap to start your ${mins} min.` };
  if (opts.blockingAvailable) return { title, body: `Time to start. ${mins} min, apps blocked.` };
  return { title, body: `Time to start. ${mins} min.` };
}

export function headsUpContent(h: HabitForSchedule): { title: string; body: string } {
  return { title: `${h.name} in ${HEADS_UP_MIN} min`, body: `Get ready: ${Math.max(1, Math.round(h.target_minutes))} min for ${h.pillarName}.` };
}

export function buildHabitAlerts(
  habits: HabitForSchedule[],
  opts: {
    now: Date;
    days?: number;
    doneToday?: Set<string>;
    skippedToday?: Set<string>;
    headsUp?: boolean;
    blockingAvailable?: boolean;
    autoBlock?: boolean;
    max?: number;
  }
): HabitAlert[] {
  const { now, days = 7, doneToday = new Set(), skippedToday = new Set(), headsUp = false, blockingAvailable = false, autoBlock = false, max = MAX_PENDING } = opts;
  const today = localDayKey(now);
  const out: HabitAlert[] = [];
  for (let i = 0; i < days; i++) {
    const day = shiftDayKey(today, i);
    for (const h of habits) {
      if (!h.is_active) continue;
      const t = parseHHMM(h.reminder_time);
      if (!t) continue;
      const mask = (h.days_mask ?? 127) & 127;
      if (!mask || !isScheduledOn(mask, day)) continue;
      if (day === today && (doneToday.has(h.id) || skippedToday.has(h.id))) continue;
      const start = at(day, t.hour, t.minute);
      const data = { actionId: h.id, scheduledAt: start.toISOString() };
      if (start.getTime() > now.getTime()) {
        out.push({ id: `habit-${h.id}-${day}-start`, habitId: h.id, kind: 'start', dayKey: day, fireAt: start, ...startAlertContent(h, { blockingAvailable, autoBlock }), data: { ...data, kind: 'start' } });
      }
      if (headsUp) {
        const early = new Date(start.getTime() - HEADS_UP_MIN * 60_000);
        if (early.getTime() > now.getTime()) {
          out.push({ id: `habit-${h.id}-${day}-headsup`, habitId: h.id, kind: 'headsup', dayKey: day, fireAt: early, ...headsUpContent(h), data: { ...data, kind: 'headsup' } });
        }
      }
    }
  }
  // Soonest first; when over the cap, drop heads-ups before start alerts, then the furthest days.
  out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  if (out.length <= max) return out;
  const starts = out.filter((a) => a.kind === 'start');
  if (starts.length >= max) return starts.slice(0, max);
  const room = max - starts.length;
  const keepHeads = new Set(out.filter((a) => a.kind === 'headsup').slice(0, room).map((a) => a.id));
  return out.filter((a) => a.kind === 'start' || keepHeads.has(a.id));
}

export type NotificationIntent =
  | { type: 'start'; actionId: string; autostart: boolean }
  | { type: 'snooze'; actionId: string }
  | { type: 'skip'; actionId: string }
  | { type: 'open-review' }
  | { type: 'open-today' };

/**
 * Maps a notification response to what the app should do.
 * Tapping the body or "Start now" starts the habit's session, unless the person opens it more than
 * 30 minutes after the start time: then the habit is only preselected.
 */
export function intentFromResponse(r: { actionIdentifier: string; data: Record<string, unknown> | undefined; now: Date }): NotificationIntent {
  const data = r.data ?? {};
  const actionId = typeof data.actionId === 'string' ? data.actionId : null;
  if (data.screen === 'weekly-review') return { type: 'open-review' };
  if (!actionId) return { type: 'open-today' };
  if (r.actionIdentifier === ACTION_SNOOZE) return { type: 'snooze', actionId };
  if (r.actionIdentifier === ACTION_SKIP) return { type: 'skip', actionId };
  const scheduledAt = typeof data.scheduledAt === 'string' ? Date.parse(data.scheduledAt) : NaN;
  // A heads-up tap opens the habit without starting it early; old reminders (no scheduledAt) never auto-start.
  const lateMin = (r.now.getTime() - scheduledAt) / 60_000;
  const autostart = data.kind !== 'headsup' && Number.isFinite(scheduledAt) && lateMin >= -1 && lateMin <= AUTOSTART_WINDOW_MIN;
  return { type: 'start', actionId, autostart };
}

export interface StrictBlock {
  habitId: string;
  /** Expo/Apple weekday numbers: 1 = Sunday … 7 = Saturday */
  weekdays: number[];
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

/** Weekly windows for strict-mode habits (start → start + duration, clipped at 23:59 so it never spans midnight). */
export function buildStrictBlocks(habits: HabitForSchedule[]): StrictBlock[] {
  const out: StrictBlock[] = [];
  for (const h of habits) {
    if (!h.is_active || (h.strict ?? 1) !== 1) continue;
    const t = parseHHMM(h.reminder_time);
    if (!t) continue;
    const mask = (h.days_mask ?? 127) & 127;
    if (!mask) continue;
    const weekdays: number[] = [];
    for (let bit = 0; bit < 7; bit++) if (mask & (1 << bit)) weekdays.push(bit === 6 ? 1 : bit + 2);
    const startMin = t.hour * 60 + t.minute;
    const endMin = Math.min(23 * 60 + 59, startMin + Math.max(5, Math.round(h.target_minutes)));
    out.push({ habitId: h.id, weekdays: weekdays.sort((a, b) => a - b), startHour: t.hour, startMinute: t.minute, endHour: Math.floor(endMin / 60), endMinute: endMin % 60 });
  }
  return out;
}
