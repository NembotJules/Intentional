/**
 * Blocking rules (founder feedback 2026-10-30): when the apps the person picked are blocked.
 *  - Every focus session (always; services/appBlocking.applyShields).
 *  - During habits with a start time ("During my habits", on by default; each habit can opt out).
 *  - Block hours: fixed windows on chosen days ("Mon–Fri · 9:00–12:00"), not tied to a habit.
 * Rules live in settings (JSON) and become iOS DeviceActivity windows through syncHabitBlocks; a rule's
 * window id is "rule_<id>", so the monitor extension shields it like a habit window.
 * Pure, so it's unit-tested.
 */
import { formatDaysMask, parseHHMM, type StrictBlock } from '@/services/habitSchedule';

export const BLOCK_RULES_KEY = 'block_rules_v1';
/** '0' turns off blocking during habits; anything else (or unset) keeps it on. */
export const BLOCK_DURING_HABITS_KEY = 'block_during_habits';
export const RULE_PREFIX = 'rule_';
/** iOS refuses DeviceActivity intervals shorter than this. */
export const MIN_RULE_MINUTES = 15;

export interface BlockRule {
  id: string;
  /** bit 0 = Monday … bit 6 = Sunday */
  days_mask: number;
  /** "HH:MM", local time */
  start: string;
  end: string;
  enabled: boolean;
}

export const isRuleBlockId = (id: string | null | undefined) => !!id && id.startsWith(RULE_PREFIX);

export function parseRules(raw: string | null | undefined): BlockRule[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter(
      (r): r is BlockRule =>
        !!r && typeof r.id === 'string' && typeof r.days_mask === 'number' && !!parseHHMM(r.start) && !!parseHHMM(r.end) && typeof r.enabled === 'boolean'
    );
  } catch {
    return [];
  }
}

const minutesOf = (hhmm: string) => {
  const t = parseHHMM(hhmm);
  return t ? t.hour * 60 + t.minute : null;
};

/** Why a rule can't be saved, or null when it can. */
export function ruleError(r: Pick<BlockRule, 'days_mask' | 'start' | 'end'>): string | null {
  if (!(r.days_mask & 127)) return "Tap the days it's on.";
  const s = minutesOf(r.start);
  const e = minutesOf(r.end);
  if (s === null || e === null) return 'Use the HH:MM format, like 09:00.';
  if (e <= s) return 'The end must be after the start (same day).';
  if (e - s < MIN_RULE_MINUTES) return `At least ${MIN_RULE_MINUTES} minutes.`;
  return null;
}

/** "9:00" from "09:00". */
const short = (hhmm: string) => {
  const t = parseHHMM(hhmm)!;
  return `${t.hour}:${String(t.minute).padStart(2, '0')}`;
};

/** "Mon–Fri · 9:00–12:00" */
export function describeRule(r: BlockRule): string {
  return `${formatDaysMask(r.days_mask)} · ${short(r.start)}–${short(r.end)}`;
}

/** Enabled, valid rules as the weekly windows iOS monitors (1 = Sunday … 7 = Saturday). */
export function ruleStrictBlocks(rules: BlockRule[]): StrictBlock[] {
  const out: StrictBlock[] = [];
  for (const r of rules) {
    if (!r.enabled || ruleError(r)) continue;
    const s = parseHHMM(r.start)!;
    const e = parseHHMM(r.end)!;
    const weekdays: number[] = [];
    for (let bit = 0; bit < 7; bit++) if (r.days_mask & (1 << bit)) weekdays.push(bit === 6 ? 1 : bit + 2);
    out.push({ habitId: `${RULE_PREFIX}${r.id}`, weekdays: weekdays.sort((a, b) => a - b), startHour: s.hour, startMinute: s.minute, endHour: e.hour, endMinute: e.minute });
  }
  return out;
}

/** The second line of the Focus card: "Focus sessions · 3 habits · Mon–Fri 9:00–12:00". */
export function blockingWhenSummary(o: { duringHabits: boolean; strictHabitCount: number; rules: BlockRule[] }): string {
  const parts = ['Focus sessions'];
  if (o.duringHabits && o.strictHabitCount > 0) parts.push(`${o.strictHabitCount} ${o.strictHabitCount === 1 ? 'habit' : 'habits'}`);
  const on = o.rules.filter((r) => r.enabled && !ruleError(r));
  if (on.length === 1) parts.push(describeRule(on[0]!).replace(' · ', ' '));
  else if (on.length > 1) parts.push(`${on.length} block hours`);
  return parts.join(' · ');
}
