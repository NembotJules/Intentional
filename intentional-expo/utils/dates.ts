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

/**
 * US-069: Check if a habit is scheduled for today based on its days_mask.
 * days_mask is a 7-bit field where bit 0 = Monday, bit 1 = Tuesday, ..., bit 6 = Sunday.
 */
export function isDueToday(daysMask: number, today: Date = new Date()): boolean {
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const bit = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to bit index (0 = Monday, 6 = Sunday)
  return (daysMask & (1 << bit)) !== 0;
}

/**
 * US-069: Parse a time string (HH:MM) into minutes since midnight for sorting.
 * Returns 9999 for "Anytime" (null/empty) so they sort to the end.
 */
export function timeToMinutes(time: string | null): number {
  if (!time) return 9999;
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return 9999;
  return h * 60 + m;
}
