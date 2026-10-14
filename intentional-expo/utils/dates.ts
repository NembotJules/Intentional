/**
 * Calendar-day helpers in the device's local timezone.
 *
 * "Today", streak days, habit dates and week starts must follow the user's
 * wall clock — slicing toISOString() buckets by UTC, which shifts anything
 * logged between local midnight and the UTC offset onto the wrong day.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD for the local calendar day containing `d`. */
export function localDayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local calendar day of an ISO timestamp. */
export function localDayKeyFromIso(iso: string): string {
  return localDayKey(new Date(iso));
}

/** Local midnight of a YYYY-MM-DD day key. */
export function localDayStart(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** ISO bounds [start, end] covering one local calendar day. */
export function localDayRangeIso(dayKey: string): { start: string; end: string } {
  const start = localDayStart(dayKey);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: new Date(end.getTime() - 1).toISOString() };
}

/** Day key `n` calendar days before/after `dayKey` (DST-safe). */
export function shiftDayKey(dayKey: string, n: number): string {
  const d = localDayStart(dayKey);
  d.setDate(d.getDate() + n);
  return localDayKey(d);
}

/** Whole calendar days between two day keys (b - a). */
export function dayKeyDiff(a: string, b: string): number {
  const utc = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(b) - utc(a)) / 86400000);
}
