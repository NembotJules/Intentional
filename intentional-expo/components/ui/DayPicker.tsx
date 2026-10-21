/**
 * DayPicker — a small month grid that returns a local day key ("YYYY-MM-DD").
 * No horizontal scroll: 7 flex columns fit any width down to ~300px.
 *
 * Also exports the date helpers the goal screens share (all from local day keys,
 * never `new Date('YYYY-MM-DD')`, which parses as UTC) and the deadline chip row
 * (30 days · 90 days · 6 months · Pick a date).
 */
import { useState } from 'react';
import { View, Text } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { FontFamily, Radius, Surface } from '@/constants/design';
import { PressableScale } from '@/components/ui/motion';
import { localDayKey, localDayStart, shiftDayKey } from '@/utils/dates';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = WEEKDAYS.map((d) => d.slice(0, 3));
const HEAD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** "Sunday, November 15, 2026" — also the accessibility label of each day cell. */
export function formatDayLong(dayKey: string): string {
  const d = localDayStart(dayKey);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Deadline text: "Fri, Dec 18" (adds the year when it isn't this year). */
export function formatDeadline(dayKey: string, now: Date = new Date()): string {
  const d = localDayStart(dayKey);
  const base = `${WEEKDAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

/** Planned-day label: "Today", "Tomorrow", else "Fri 24" (or "Fri 24 Nov" beyond this month). */
export function formatPlannedDay(dayKey: string, now: Date = new Date()): string {
  const today = localDayKey(now);
  if (dayKey === today) return 'Today';
  if (dayKey === shiftDayKey(today, 1)) return 'Tomorrow';
  if (dayKey === shiftDayKey(today, -1)) return 'Yesterday';
  const d = localDayStart(dayKey);
  const sameMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}${sameMonth ? '' : ` ${MONTHS_SHORT[d.getMonth()]}`}`;
}

/** The coming Sunday (today when today is Sunday): "This week" for a task plan. */
export function endOfWeekKey(now: Date = new Date()): string {
  const today = localDayKey(now);
  return shiftDayKey(today, (7 - now.getDay()) % 7);
}

export function DayPicker({
  value,
  onChange,
  minDate,
  color = Surface.ink,
}: {
  value: string | null;
  onChange: (dayKey: string) => void;
  /** Earliest pickable day; defaults to today. */
  minDate?: string;
  color?: string;
}) {
  const min = minDate ?? localDayKey();
  const initial = localDayStart(value && value >= min ? value : min);
  const [month, setMonth] = useState({ y: initial.getFullYear(), m: initial.getMonth() });
  const minStart = localDayStart(min);
  const canGoBack = month.y > minStart.getFullYear() || (month.y === minStart.getFullYear() && month.m > minStart.getMonth());

  const first = new Date(month.y, month.m, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => localDayKey(new Date(month.y, month.m, i + 1))),
  ];
  while (cells.length % 7) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
  const today = localDayKey();

  const shiftMonth = (delta: number) => {
    const d = new Date(month.y, month.m + delta, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md, padding: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <PressableScale
          onPress={() => shiftMonth(-1)}
          disabled={!canGoBack}
          accessibilityLabel="Previous month"
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', opacity: canGoBack ? 1 : 0.25 }}
        >
          <ChevronLeft size={18} color={Surface.ink} strokeWidth={2.2} />
        </PressableScale>
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>
          {MONTHS[month.m]} {month.y}
        </Text>
        <PressableScale
          onPress={() => shiftMonth(1)}
          accessibilityLabel="Next month"
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronRight size={18} color={Surface.ink} strokeWidth={2.2} />
        </PressableScale>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {HEAD.map((h, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: Surface.faint, paddingVertical: 4 }}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((key, c) => {
            if (!key) return <View key={c} style={{ flex: 1, height: 38 }} />;
            const disabled = key < min;
            const selected = key === value;
            const isToday = key === today;
            return (
              <View key={c} style={{ flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' }}>
                <PressableScale
                  onPress={() => onChange(key)}
                  disabled={disabled}
                  scaleTo={0.9}
                  accessibilityLabel={formatDayLong(key)}
                  aria-selected={selected}
                  accessibilityState={{ selected, disabled }}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? color : 'transparent',
                    borderWidth: isToday && !selected ? 1.5 : 0,
                    borderColor: Surface.ruleStrong,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: selected ? FontFamily.bodyBold : FontFamily.bodySemiBold,
                      fontSize: 14,
                      color: selected ? Surface.surface : disabled ? Surface.ruleStrong : Surface.ink,
                    }}
                  >
                    {Number(key.slice(8))}
                  </Text>
                </PressableScale>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const DEADLINE_PRESETS = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '6 months', months: 6 },
] as const;

function presetKey(p: (typeof DEADLINE_PRESETS)[number], now: Date): string {
  if ('months' in p) {
    const d = new Date(now.getFullYear(), now.getMonth() + p.months, now.getDate());
    return localDayKey(d);
  }
  return shiftDayKey(localDayKey(now), p.days);
}

/** Deadline chips: 30 days · 90 days · 6 months · Pick a date (opens the DayPicker). */
export function DeadlinePicker({ value, onChange, color }: { value: string; onChange: (dayKey: string) => void; color: string }) {
  const now = new Date();
  const presets = DEADLINE_PRESETS.map((p) => ({ label: p.label, key: presetKey(p, now) }));
  const matchesPreset = presets.some((p) => p.key === value);
  const [picking, setPicking] = useState(!!value && !matchesPreset);
  const pickOn = picking || (!!value && !matchesPreset);

  const chip = (label: string, on: boolean, onPress: () => void, a11y: string) => (
    <PressableScale
      key={label}
      onPress={onPress}
      accessibilityLabel={a11y}
      aria-selected={on}
      accessibilityState={{ selected: on }}
      style={{ paddingHorizontal: 14, height: 40, justifyContent: 'center', borderRadius: 20, backgroundColor: on ? color : Surface.surfaceRaised }}
    >
      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: on ? Surface.surface : Surface.ink }}>{label}</Text>
    </PressableScale>
  );

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {presets.map((p) =>
          chip(p.label, !pickOn && value === p.key, () => {
            setPicking(false);
            onChange(p.key);
          }, `Deadline in ${p.label}`)
        )}
        {chip('Pick a date', pickOn, () => setPicking(true), 'Pick a date')}
      </View>
      {pickOn ? (
        <View style={{ marginTop: 10 }}>
          <DayPicker value={value || null} onChange={onChange} color={color} />
        </View>
      ) : null}
      {value ? (
        <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: Surface.muted, marginTop: 8 }}>Deadline: {formatDeadline(value)}</Text>
      ) : null}
    </View>
  );
}
