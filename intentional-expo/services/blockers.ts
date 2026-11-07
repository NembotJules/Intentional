/**
 * US-107 · Blockers: what the Block tab shows as one card ("Bedtime", "Work hours", "Study"…), each made of the
 * ordinary block-hour rules iOS watches (services/blockRules). A blocker has a name, a sticker, days, and either
 * "All day" or a time window. A window that crosses midnight (22:00–7:00) is stored as two same-day rules,
 * because iOS windows can't cross midnight. "All day" is 00:00–23:59 (the last minute stays open, like Bedtime's).
 * Pure, so it's unit-tested.
 */
import { formatDaysMask, parseHHMM } from '@/services/habitSchedule';
import { ruleError } from '@/services/blockRules';
import { presetById, type PresetRule } from '@/services/blockPresets';

export interface Blocker {
  /** The group key: a preset's "preset:<id>", or the id the person's blocker was saved with. */
  id: string;
  name: string;
  sticker: string;
  allDay: boolean;
  /** "HH:MM"; for a window across midnight, start > end. */
  start: string;
  end: string;
  days_mask: number;
  enabled: boolean;
  preset?: string;
}

export const DEFAULT_BLOCKER_NAME = 'Block hours';
export const DEFAULT_BLOCKER_STICKER = 'lock';
/** Stickers offered in the blocker sheet (components/ui/Sticker keys). */
export const BLOCKER_STICKERS = ['lock', 'moon', 'bed', 'sunrise', 'briefcase', 'book', 'teacup', 'utensils', 'dumbbell', 'brain', 'laptop', 'users', 'music', 'graduation', 'tree', 'nophone'] as const;

const END_OF_DAY = '23:59';
const START_OF_DAY = '00:00';

export const groupKey = (r: PresetRule) => r.group ?? (r.preset ? `preset:${r.preset}` : r.id);

const short = (hhmm: string) => {
  const t = parseHHMM(hhmm);
  return t ? `${t.hour}:${String(t.minute).padStart(2, '0')}` : hhmm;
};

/** "All day", "Mon–Fri · All day", "Every day · 22:00–7:00". */
export function blockerWhen(b: Pick<Blocker, 'allDay' | 'start' | 'end' | 'days_mask'>): string {
  const days = formatDaysMask(b.days_mask);
  if (b.allDay) return (b.days_mask & 127) === 127 ? 'All day' : `${days} · All day`;
  return `${days} · ${short(b.start)}–${short(b.end)}`;
}

/** The person's rules as blockers, in the order they were added. */
export function blockersFromRules(rules: PresetRule[]): Blocker[] {
  const groups = new Map<string, PresetRule[]>();
  for (const r of rules) {
    const k = groupKey(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.entries()].map(([id, rs]) => {
    const first = rs[0]!;
    const p = first.preset ? presetById(first.preset) : null;
    const late = rs.find((r) => r.end === END_OF_DAY && r.start !== START_OF_DAY);
    const early = rs.find((r) => r.start === START_OF_DAY && r.end !== END_OF_DAY);
    const crosses = rs.length === 2 && !!late && !!early;
    const allDay = rs.length === 1 && first.start === START_OF_DAY && first.end === END_OF_DAY;
    return {
      id,
      name: first.name?.trim() || p?.name || DEFAULT_BLOCKER_NAME,
      sticker: first.sticker || p?.sticker || DEFAULT_BLOCKER_STICKER,
      allDay,
      start: crosses ? late!.start : first.start,
      end: crosses ? early!.end : first.end,
      days_mask: first.days_mask,
      enabled: rs.every((r) => r.enabled),
      ...(first.preset ? { preset: first.preset } : {}),
    };
  });
}

/** The same-day rules a blocker becomes (one, or two across midnight). */
export function rulesForBlocker(b: Blocker, makeId: (k: number) => string): PresetRule[] {
  const meta = { group: b.id, name: b.name.trim() || DEFAULT_BLOCKER_NAME, sticker: b.sticker, enabled: true, days_mask: b.days_mask & 127, ...(b.preset ? { preset: b.preset } : {}) };
  if (b.allDay) return [{ id: makeId(0), ...meta, start: START_OF_DAY, end: END_OF_DAY }];
  if (b.end > b.start) return [{ id: makeId(0), ...meta, start: b.start, end: b.end }];
  const parts = [{ start: b.start, end: END_OF_DAY }, ...(b.end === START_OF_DAY ? [] : [{ start: START_OF_DAY, end: b.end }])];
  return parts.map((t, k) => ({ id: makeId(k), ...meta, ...t }));
}

/** Why it can't be saved, or null. */
export function blockerError(b: Blocker): string | null {
  if (!(b.days_mask & 127)) return "Tap the days it's on.";
  if (b.allDay) return null;
  if (!parseHHMM(b.start) || !parseHHMM(b.end)) return 'Use the HH:MM format, like 09:00.';
  if (b.start === b.end) return 'Pick an end time.';
  for (const r of rulesForBlocker(b, (k) => String(k))) {
    const e = ruleError(r);
    if (e) return e.replace(' (same day)', '');
  }
  return null;
}

/** Saves a new or edited blocker (its old rules are replaced, in place). */
export function upsertBlocker(rules: PresetRule[], b: Blocker, makeId: (k: number) => string): PresetRule[] {
  const fresh = rulesForBlocker(b, makeId);
  const at = rules.findIndex((r) => groupKey(r) === b.id);
  const rest = rules.filter((r) => groupKey(r) !== b.id);
  if (at < 0) return [...rest, ...fresh];
  const before = rules.slice(0, at).filter((r) => groupKey(r) !== b.id);
  return [...before, ...fresh, ...rest.slice(before.length)];
}

export function removeBlocker(rules: PresetRule[], id: string): PresetRule[] {
  return rules.filter((r) => groupKey(r) !== id);
}

/** A new blocker's starting values. */
export function newBlocker(id: string): Blocker {
  return { id, name: '', sticker: DEFAULT_BLOCKER_STICKER, allDay: false, start: '09:00', end: '12:00', days_mask: 127, enabled: true };
}
