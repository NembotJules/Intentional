/**
 * US-103 · "Blocking now" on the Block tab: one card per way apps get blocked, each with a status pill.
 *   Focus sessions · Always
 *   Bedtime / Work hours / block hours · Active | Unlocked · until 18:05 | Next at 9:00 | Next Mon 9:00
 *   During my habits · Active | Next at 18:00 (Gym) | Off
 * Pure: the clock, the rules and the habits come in; the phone's own state (an unlock running) too.
 */
import { parseHHMM } from '@/services/habitSchedule';
import { ruleError } from '@/services/blockRules';
import { type PresetRule } from '@/services/blockPresets';
import { blockerWhen, blockersFromRules, groupKey } from '@/services/blockers';

export type PillTone = 'active' | 'unlocked' | 'next' | 'always' | 'off';

export interface BlockCard {
  id: string;
  title: string;
  sub: string;
  pill: { text: string; tone: PillTone };
  /** US-107: the card's sticker (components/ui/Sticker key). */
  sticker: string;
  /** US-107: the blocker this card edits (services/blockers), when it's one. */
  blockerId?: string;
}

export interface StrictHabit {
  id: string;
  name: string;
  reminder_time: string | null;
  target_minutes: number;
  days_mask: number;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const bitOf = (d: Date) => (d.getDay() === 0 ? 6 : d.getDay() - 1);
const mins = (hhmm: string) => {
  const t = parseHHMM(hhmm);
  return t ? t.hour * 60 + t.minute : null;
};
const clock = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
export const untilLabel = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

interface Window {
  days_mask: number;
  start: number;
  end: number;
}

/** Is `now` inside one of the windows? */
function activeNow(windows: Window[], now: Date): boolean {
  const m = now.getHours() * 60 + now.getMinutes();
  const bit = bitOf(now);
  return windows.some((w) => !!(w.days_mask & (1 << bit)) && m >= w.start && m < w.end);
}

/** The next start from now, within a week: "at 9:00" today, "Mon 9:00" another day. */
function nextStart(windows: Window[], now: Date): string | null {
  const m = now.getHours() * 60 + now.getMinutes();
  for (let ahead = 0; ahead < 8; ahead++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);
    const bit = bitOf(day);
    const starts = windows
      .filter((w) => !!(w.days_mask & (1 << bit)) && (ahead > 0 || w.start > m))
      .map((w) => w.start)
      .sort((a, b) => a - b);
    if (starts.length) return ahead === 0 ? `at ${clock(starts[0]!)}` : `${DAY_NAMES[bit]} ${clock(starts[0]!)}`;
  }
  return null;
}

function pillFor(windows: Window[], now: Date, unlockUntil: number | null): BlockCard['pill'] {
  if (activeNow(windows, now)) {
    if (unlockUntil && unlockUntil > now.getTime()) return { text: `Unlocked · until ${untilLabel(unlockUntil)}`, tone: 'unlocked' };
    return { text: 'Active', tone: 'active' };
  }
  const next = nextStart(windows, now);
  return next ? { text: `Next ${next}`, tone: 'next' } : { text: 'Off', tone: 'off' };
}

export function blockingNow(o: {
  now: Date;
  rules: PresetRule[];
  duringHabits: boolean;
  strictHabits: StrictHabit[];
  /** ms the current unlock ends (US-096), or null. */
  unlockUntil: number | null;
}): BlockCard[] {
  const cards: BlockCard[] = [{ id: 'focus', title: 'Focus sessions', sub: 'While a session runs', pill: { text: 'Always', tone: 'always' }, sticker: 'stopwatch' }];

  // US-107: one card per blocker (a preset or the person's own), in the order they were added; paused ones say so.
  for (const b of blockersFromRules(o.rules)) {
    const mine = o.rules.filter((r) => groupKey(r) === b.id && r.enabled && !ruleError(r));
    const w = mine.map((r) => ({ days_mask: r.days_mask, start: mins(r.start)!, end: mins(r.end)! }));
    cards.push({
      id: b.preset && b.id === `preset:${b.preset}` ? `preset_${b.preset}` : `rule_${b.id}`,
      title: b.name,
      sub: blockerWhen(b),
      pill: b.enabled && w.length ? pillFor(w, o.now, o.unlockUntil) : { text: 'Paused', tone: 'off' },
      sticker: b.sticker,
      blockerId: b.id,
    });
  }

  const timed = o.strictHabits.filter((h) => mins(h.reminder_time ?? '') !== null && h.target_minutes > 0);
  if (o.duringHabits && timed.length) {
    const w = timed.map((h) => {
      const s = mins(h.reminder_time!)!;
      return { days_mask: h.days_mask, start: s, end: Math.min(24 * 60, s + h.target_minutes) };
    });
    cards.push({
      id: 'habits',
      title: 'During my habits',
      sub: `${timed.length} ${timed.length === 1 ? 'habit' : 'habits'} with a start time`,
      pill: pillFor(w, o.now, o.unlockUntil),
      sticker: 'repeat',
    });
  }
  return cards;
}
