import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { useInsightsData } from '@/db/hooks';
import * as api from '@/db/api';
import type { FocusSession, MetaGoal, Objective, Task } from '@/types';
import { Accent, Elevation, FontFamily, Surface, Type, hexToRgba } from '@/constants/design';
import { CTA } from '@/components/onboarding/parts';
import { Mascot } from '@/components/onboarding/Mascot';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { getGoalColor } from '@/utils/goalColors';
import { hapticLight } from '@/utils/haptics';
import { PressableScale } from '@/components/ui/motion';
import { progressOf, daysLeft, paceOf, type Pace } from '@/services/goalProgress';
import { localDayStart } from '@/utils/dates';

type Range = 'week' | 'month' | 'all';

const RANGE_LABELS: Record<Range, string> = { week: 'WK', month: 'MO', all: 'ALL' };
const RANGE_A11Y: Record<Range, string> = { week: 'This week', month: 'This month', all: 'All time' };
const RANGE_PHRASE: Record<Range, string> = { week: 'this week', month: 'this month', all: 'all time' };

/** Match `(tabs)/_layout.tsx` floating tab bar so content isn’t hidden */
function tabBarOverlapPadding(insetsBottom: number) {
  const tabBarCore = 56;
  const tabBarExtra = 8;
  const gapAboveBar = 10;
  return tabBarCore + Math.max(insetsBottom, 6) + tabBarExtra + gapAboveBar;
}

/** 0 → "0m", 0.5 → "30m", 2.25 → "2h 15m". */
function formatHM(hours: number): string {
  const mins = Math.round(Math.max(0, hours) * 60);
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ─── Bucketed bar chart data ─────────────────────────────────────────────────

type Bucket = { label: string; byGoal: Record<string, number>; total: number };

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** week: Mon → Sun of this week · month: ~30 daily bars · all: last 12 weekly bars. */
function buildBuckets(range: Range, sessions: FocusSession[], now: Date): Bucket[] {
  const today = startOfDay(now);
  const buckets: { start: number; end: number; label: string }[] = [];
  if (range === 'week' || range === 'month') {
    const n = range === 'week' ? 7 : 30;
    const first = range === 'week' ? calendarWeekStart(now) : null;
    for (let i = n - 1; i >= 0; i -= 1) {
      const s = new Date(first ?? today);
      if (first) s.setDate(s.getDate() + (n - 1 - i));
      else s.setDate(s.getDate() - i);
      const e = new Date(s);
      e.setDate(e.getDate() + 1);
      const label = range === 'week' ? DAY_LETTERS[s.getDay()] : i % 7 === 0 ? `${s.getDate()}` : '';
      buckets.push({ start: s.getTime(), end: e.getTime(), label });
    }
  } else {
    const first = sessions.reduce((m, x) => Math.min(m, new Date(x.started_at).getTime()), now.getTime());
    const weeks = Math.min(12, Math.max(4, Math.ceil((today.getTime() - first) / (7 * 864e5)) + 1));
    for (let i = weeks - 1; i >= 0; i -= 1) {
      const e = new Date(today);
      e.setDate(e.getDate() + 1 - i * 7);
      const s = new Date(e);
      s.setDate(s.getDate() - 7);
      const label = i % Math.ceil(weeks / 4) === 0 ? s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
      buckets.push({ start: s.getTime(), end: e.getTime(), label });
    }
  }
  const out: Bucket[] = buckets.map((b) => ({ label: b.label, byGoal: {}, total: 0 }));
  for (const s of sessions) {
    const t = new Date(s.started_at).getTime();
    const idx = buckets.findIndex((b) => t >= b.start && t < b.end);
    if (idx < 0) continue;
    const h = s.duration_seconds / 3600;
    out[idx].byGoal[s.goal_id] = (out[idx].byGoal[s.goal_id] ?? 0) + h;
    out[idx].total += h;
  }
  return out;
}

/** Monday 00:00 local of the current calendar week. */
function calendarWeekStart(now: Date): Date {
  const d = startOfDay(now);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
}

/** Start of the window each range covers: week = this calendar week (Mon 00:00 → now). */
function rangeStart(range: Range, now: Date): Date {
  if (range === 'week') return calendarWeekStart(now);
  const s = new Date(now);
  if (range === 'month') s.setMonth(s.getMonth() - 1);
  else return new Date(0);
  return s;
}

/** Sessions of the selected range (week = this calendar week) + last week's total up to the same point. */
function useRangeSessions(range: Range, refreshSignal: number) {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [prevTotal, setPrevTotal] = useState<number | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const now = new Date();
      const start = rangeStart(range, now);
      const rows = await api.getSessionsBetween(start.toISOString(), now.toISOString());
      // Last week up to the same moment, for the "vs last week" line on the week view.
      let prev: number | null = null;
      if (range === 'week') {
        const pStart = new Date(start);
        pStart.setDate(pStart.getDate() - 7);
        const pEnd = new Date(now);
        pEnd.setDate(pEnd.getDate() - 7);
        const pRows = await api.getSessionsBetween(pStart.toISOString(), pEnd.toISOString());
        prev = pRows.reduce((a, s) => a + s.duration_seconds, 0) / 3600;
      }
      if (mounted) {
        setSessions(rows);
        setPrevTotal(prev);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [range, refreshSignal]);
  return { sessions, prevTotal };
}

type Split = { goal: number; maintenance: number; free: number };

/** US-071: goal work (task or goal-linked) · maintenance (habit, no goal) · free time (no habit, no task). */
function splitOf(sessions: FocusSession[]): Record<string, Split> {
  const out: Record<string, Split> = {};
  for (const s of sessions) {
    const b = out[s.goal_id] ?? (out[s.goal_id] = { goal: 0, maintenance: 0, free: 0 });
    const h = s.duration_seconds / 3600;
    if (s.objective_id || s.task_id) b.goal += h;
    else if (s.action_id) b.maintenance += h;
    else b.free += h;
  }
  return out;
}

type ObjectiveInsight = {
  objective: Objective;
  pillar: MetaGoal;
  hoursThisWeek: number;
  progress: number | null;
  daysLeft: number;
  pace: Pace;
  tasks: Task[];
};

function useActiveObjectives(refreshSignal: number): ObjectiveInsight[] {
  const [insights, setInsights] = useState<ObjectiveInsight[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const pillars = await api.getGoals();
      const results: ObjectiveInsight[] = [];
      const now = new Date();
      const weekStart = calendarWeekStart(now);

      for (const pillar of pillars) {
        const active = await api.getActiveObjective(pillar.id);
        if (!active) continue;

        const tasks = await api.getTasks(active.id);
        const weekMinutes = api.getMinutesForObjective(active.id, {
          start: weekStart.toISOString(),
          end: now.toISOString(),
        });
        results.push({
          objective: active,
          pillar,
          hoursThisWeek: weekMinutes / 60,
          progress: progressOf(active, tasks),
          daysLeft: daysLeft(active, now),
          pace: paceOf(active, tasks, now),
          tasks,
        });
      }

      if (mounted) setInsights(results);
    })();
    return () => {
      mounted = false;
    };
  }, [refreshSignal]);
  return insights;
}

const DAY_MS = 864e5;

function shortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * A real projection: with progress p after e days since the goal was set, the whole goal takes e/p days.
 * Compares that finish date with the deadline. Never guilt-trips.
 */
function projectionLine(o: ObjectiveInsight, now: Date = new Date()): string {
  const { objective, progress, hoursThisWeek } = o;
  const title = objective.title;
  if (progress !== null && progress >= 1) return `${title} is done. Time to mark it achieved.`;
  if (progress === null || progress <= 0) {
    return hoursThisWeek > 0
      ? `${title} got ${formatHM(hoursThisWeek)} this week. Finish a task and you'll see when you'll get there.`
      : `Give ${title} its first hour this week.`;
  }
  const created = new Date(objective.created_at);
  const elapsedDays = Math.max(1, (now.getTime() - created.getTime()) / DAY_MS);
  const finish = new Date(created.getTime() + (elapsedDays / progress) * DAY_MS);
  const deadline = localDayStart(objective.deadline);
  const finishDay = startOfDay(finish);
  const early = Math.round((deadline.getTime() - finishDay.getTime()) / DAY_MS);
  const head = `At this pace you'll reach ${title} around ${shortDate(finishDay)}`;
  if (early > 0) return `${head}, ${early} ${early === 1 ? 'day' : 'days'} before your deadline.`;
  if (early === 0) return `${head}, right on your deadline.`;
  // Within the pace tolerance band the goal reads "on track": don't contradict it with "after your deadline".
  if (o.pace !== 'behind') return `${title} is on track for ${shortDate(deadline)}. Keep giving it hours every week.`;
  return `${head}, a little after your deadline. One more hour a week closes the gap.`;
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function RangePills({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {(['week', 'month', 'all'] as const).map((r) => {
        const active = range === r;
        return (
          <Pressable
            key={r}
            onPress={() => {
              hapticLight();
              onChange(r);
            }}
            accessibilityRole="button"
            accessibilityLabel={RANGE_A11Y[r]}
            accessibilityState={{ selected: active }}
            style={{
              height: 40,
              paddingHorizontal: 18,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? Surface.ink : Surface.surfaceRaised,
            }}
          >
            <Text style={{ color: active ? Surface.surface : Surface.muted, fontFamily: FontFamily.bodyBold, fontSize: 14, letterSpacing: 0.3 }}>
              {RANGE_LABELS[r]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StackedBars({ buckets, goals, range }: { buckets: Bucket[]; goals: MetaGoal[]; range: Range }) {
  const H = 132;
  const max = Math.max(0.5, ...buckets.map((b) => b.total));
  const gap = range === 'month' ? 3 : 7;
  return (
    <View accessibilityRole="image" accessibilityLabel={`Hours per ${range === 'all' ? 'week' : 'day'}, stacked by pillar`}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap, height: H }}>
        {buckets.map((b, i) => (
          <View key={i} style={{ flex: 1, height: H, justifyContent: 'flex-end', gap: 2 }}>
            {b.total <= 0 ? (
              <View style={{ height: 4, borderRadius: 2, backgroundColor: Surface.rule }} />
            ) : (
              goals
                .filter((g) => (b.byGoal[g.id] ?? 0) > 0)
                .map((g) => (
                  <View
                    key={g.id}
                    style={{
                      height: Math.max(3, ((b.byGoal[g.id] ?? 0) / max) * (H - 8)),
                      borderRadius: range === 'month' ? 2 : 4,
                      backgroundColor: getGoalColor(g),
                    }}
                  />
                ))
            )}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap, marginTop: 8 }}>
        {buckets.map((b, i) => (
          <Text
            key={i}
            numberOfLines={1}
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: FontFamily.bodySemiBold,
              fontSize: 11,
              color: Surface.faint,
              overflow: 'visible',
              minWidth: range === 'week' ? undefined : 0,
            }}
          >
            {b.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Pillar balance radar — each spoke is a pillar, scaled to the leading pillar. */
function BalanceRadar({ items }: { items: { name: string; hours: number; color: string }[] }) {
  const W = 320;
  const size = 236;
  const c = size / 2;
  const cx = W / 2;
  const R = 80;
  const n = items.length;
  const max = Math.max(1e-6, ...items.map((x) => x.hours));
  const pt = (i: number, f: number) => {
    const a = (-Math.PI / 2) + (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * R * f, y: c + Math.sin(a) * R * f };
  };
  const ring = (f: number) => items.map((_, i) => pt(i, f)).map((p) => `${p.x},${p.y}`).join(' ');
  const shape = items.map((x, i) => pt(i, Math.max(0.04, x.hours / max))).map((p) => `${p.x},${p.y}`).join(' ');
  return (
    <View style={{ alignItems: 'center' }} accessibilityRole="image" accessibilityLabel="Pillar balance chart">
      <Svg width="100%" height={size} viewBox={`0 0 ${W} ${size}`}>
        {[0.33, 0.66, 1].map((f) => (
          <Polygon key={f} points={ring(f)} fill="none" stroke={Surface.ruleStrong} strokeWidth={1} />
        ))}
        {items.map((_, i) => {
          const p = pt(i, 1);
          return <Line key={i} x1={cx} y1={c} x2={p.x} y2={p.y} stroke={Surface.rule} strokeWidth={1} />;
        })}
        <Polygon points={shape} fill={hexToRgba(Accent.blue, 0.16)} stroke={Accent.blue} strokeWidth={2.5} strokeLinejoin="round" />
        {items.map((x, i) => {
          const p = pt(i, Math.max(0.04, x.hours / max));
          return <Circle key={`d${i}`} cx={p.x} cy={p.y} r={4.5} fill={x.color} stroke={Surface.surface} strokeWidth={2} />;
        })}
        {items.map((x, i) => {
          const p = pt(i, 1.2);
          const anchor = Math.abs(p.x - cx) < 8 ? 'middle' : p.x > cx ? 'start' : 'end';
          const label = x.name.length > 12 ? `${x.name.slice(0, 11)}…` : x.name;
          return (
            <SvgText key={`l${i}`} x={p.x} y={p.y + 4} fontSize={13} fontFamily={FontFamily.bodyBold} fontWeight="700" fill={Surface.ink} textAnchor={anchor}>
              {label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

function SectionTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 }}>
      <Text style={{ ...Type.title, fontSize: 22, lineHeight: 28 }}>{title}</Text>
      {meta ? <Text style={Type.meta}>{meta}</Text> : null}
    </View>
  );
}

function LinkRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 58,
        paddingHorizontal: 18,
        borderRadius: 16,
        backgroundColor: Surface.surfaceRaised,
        opacity: 1,
      }}
    >
      <Ionicons name={icon} size={21} color={Surface.ink} />
      <Text style={{ flex: 1, color: Surface.ink, fontFamily: FontFamily.bodySemiBold, fontSize: 17 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Surface.faint} />
    </Pressable>
  );
}

const PACE_LABEL: Record<Exclude<Pace, 'unknown'>, string> = { ahead: 'ahead', on_track: 'on track', behind: 'behind' };

function paceColor(pace: Pace): string {
  if (pace === 'ahead') return Accent.green;
  if (pace === 'behind') return Accent.amber;
  return Surface.muted;
}

function daysLeftLabel(days: number): string {
  if (days > 1) return `${days} days left`;
  if (days === 1) return '1 day left';
  if (days === 0) return 'Due today';
  return 'Deadline passed';
}

function GoalsSection({ objectives, onObjectivePress }: { objectives: ObjectiveInsight[]; onObjectivePress: (id: string) => void }) {
  if (objectives.length === 0) return null;
  const now = new Date();

  return (
    <>
      <SectionTitle title="Goals" meta="since Monday" />
      <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: 20, padding: 16, gap: 18 }}>
        {objectives.map((o) => {
          const { objective, pillar, hoursThisWeek, progress, daysLeft: days, pace } = o;
          const tone = getGoalColor(pillar);
          const progressPct = progress !== null ? Math.round(progress * 100) : null;
          const paceText = pace === 'unknown' ? null : PACE_LABEL[pace];
          return (
            <PressableScale
              key={objective.id}
              onPress={() => onObjectivePress(objective.id)}
              accessibilityRole="button"
              accessibilityLabel={`${objective.title}, ${formatHM(hoursThisWeek)} this week, ${daysLeftLabel(days)}${paceText ? `, ${paceText}` : ''}`}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <PillarIcon icon={pillar.icon} name={pillar.name} color={tone} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 16, marginBottom: 4 }} numberOfLines={2}>
                    {objective.title}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 13 }}>{daysLeftLabel(days)}</Text>
                    {paceText ? (
                      <>
                        <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: Surface.faint }} />
                        <Text style={{ color: paceColor(pace), fontFamily: FontFamily.bodyBold, fontSize: 13 }}>{paceText}</Text>
                      </>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: Surface.rule }}>
                      {progressPct !== null && <View style={{ height: 6, borderRadius: 3, width: `${progressPct}%`, backgroundColor: tone }} />}
                    </View>
                    <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 14, minWidth: 48, textAlign: 'right' }}>
                      {formatHM(hoursThisWeek)}
                    </Text>
                  </View>
                  {progressPct !== null && (
                    <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 12, marginTop: 6 }}>{progressPct}% complete</Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <View style={{ width: 3, borderRadius: 2, backgroundColor: Accent.blue }} />
                    <Text style={{ ...Type.body, fontSize: 15, lineHeight: 21, color: Surface.ink, flex: 1 }}>{projectionLine(o, now)}</Text>
                  </View>
                </View>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </>
  );
}

/** Three-part bar: goal work (full tone) · maintenance (softer) · free time (softest). */
function SplitBar({ split, widthPct, tone }: { split: Split; widthPct: number; tone: string }) {
  const total = split.goal + split.maintenance + split.free;
  const parts = [
    { key: 'goal', h: split.goal, color: tone },
    { key: 'maintenance', h: split.maintenance, color: hexToRgba(tone, 0.5) },
    { key: 'free', h: split.free, color: hexToRgba(tone, 0.22) },
  ].filter((p) => p.h > 0);
  return (
    <View style={{ height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: Surface.rule }}>
      <View style={{ height: 8, width: `${widthPct}%`, flexDirection: 'row', borderRadius: 4, overflow: 'hidden' }}>
        {total > 0 ? parts.map((p) => <View key={p.key} style={{ height: 8, flex: p.h, backgroundColor: p.color }} />) : null}
      </View>
    </View>
  );
}

function SplitLabels({ split, tone }: { split: Split; tone: string }) {
  const items = [
    { label: 'Goal work', h: split.goal, color: tone },
    { label: 'Maintenance', h: split.maintenance, color: hexToRgba(tone, 0.5) },
    { label: 'Free time', h: split.free, color: hexToRgba(tone, 0.22) },
  ].filter((x) => x.h > 0);
  if (!items.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginTop: 7 }}>
      {items.map((x) => (
        <View key={x.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: x.color }} />
          <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 12 }}>
            {x.label} {formatHM(x.h)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<Range>('week');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const insights = useInsightsData(range, refreshSignal);
  const { streaks, showInsightsEmpty } = insights;
  const { sessions, prevTotal } = useRangeSessions(range, refreshSignal);
  const activeObjectives = useActiveObjectives(refreshSignal);

  // Hours per pillar over the same window as the chart (week = this calendar week, Monday → now).
  const goalHours = useMemo(() => {
    const byGoal: Record<string, number> = {};
    for (const s of sessions) byGoal[s.goal_id] = (byGoal[s.goal_id] ?? 0) + s.duration_seconds / 3600;
    return insights.goalHours.map(({ goal }) => ({ goal, hours: byGoal[goal.id] ?? 0 }));
  }, [sessions, insights.goalHours]);
  const totalHours = useMemo(() => goalHours.reduce((a, x) => a + x.hours, 0), [goalHours]);
  const split = useMemo(() => splitOf(sessions), [sessions]);
  const dailyAverage = useMemo(() => {
    if (range === 'week') {
      const elapsed = Math.floor((startOfDay(new Date()).getTime() - calendarWeekStart(new Date()).getTime()) / DAY_MS) + 1;
      return totalHours / Math.max(1, Math.min(7, elapsed));
    }
    if (range === 'month') return totalHours / 30;
    return insights.dailyAverage;
  }, [range, totalHours, insights.dailyAverage]);

  useFocusEffect(
    useCallback(() => {
      setRefreshSignal((v) => v + 1);
    }, [])
  );

  /** US-031: max goal = 100% bar width; US-010: preserve goal list order */
  const maxHours = useMemo(() => Math.max(1e-6, ...goalHours.map((x) => x.hours)), [goalHours]);
  const goals = useMemo(() => goalHours.map((x) => x.goal), [goalHours]);
  const buckets = useMemo(() => buildBuckets(range, sessions, new Date()), [range, sessions]);

  /** Flick burns brighter the more hours a week go to pillars (~15h/week ≈ blazing). */
  const flameIntensity = useMemo(() => {
    const weekly = range === 'week' ? totalHours : dailyAverage * 7;
    return Math.min(1, 0.12 + weekly / 15);
  }, [range, totalHours, dailyAverage]);

  const delta = useMemo(() => {
    if (range !== 'week' || prevTotal === null) return null;
    const d = totalHours - prevTotal;
    if (Math.abs(d) < 1 / 60) return { text: 'Same as last week', color: Surface.muted, icon: 'remove' as const };
    return d > 0
      ? { text: `${formatHM(d)} more than last week`, color: Accent.green, icon: 'arrow-up' as const }
      : { text: `${formatHM(-d)} less than last week`, color: Accent.orange, icon: 'arrow-down' as const };
  }, [range, prevTotal, totalHours]);

  const bottomPad = tabBarOverlapPadding(insets.bottom) + 16;
  const insightSentence = useMemo(() => {
    const nonZero = goalHours.filter((entry) => entry.hours > 0).sort((a, b) => b.hours - a.hours);
    if (!nonZero.length) return 'Nothing logged in this stretch yet. One session and it starts to fill in.';

    const [first, second, ...rest] = nonZero;
    const total = nonZero.reduce((sum, entry) => sum + entry.hours, 0);
    const firstPct = (first.hours / total) * 100;

    // Very dominant single pillar (>50%)
    if (firstPct > 50) {
      const pillarsCount = goalHours.length;
      if (pillarsCount === 1) {
        return `${first.goal.name} is the only pillar with time so far.`;
      }
      return `${first.goal.name} got most of your hours. ${
        second ? `${second.goal.name} could use a little more.` : 'Your other pillars are waiting.'
      }`;
    }

    // Balanced across multiple pillars
    if (nonZero.length >= 3 && firstPct < 40) {
      return `Your hours are spread across your pillars. ${first.goal.name} leads, but nothing is forgotten.`;
    }

    // Two pillars with reasonable balance
    if (second && firstPct < 60) {
      return `${first.goal.name} and ${second.goal.name} are both getting time. ${
        rest.length > 0
          ? `${rest.length} other ${rest.length === 1 ? 'pillar needs' : 'pillars need'} some hours.`
          : 'A good balance.'
      }`;
    }

    return `${first.goal.name} is doing most of the work. If that's on purpose, keep going. If not, give one hour elsewhere.`;
  }, [goalHours]);

  const activeStreaks = streaks.filter(({ current }) => current > 0).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: bottomPad }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <Text style={Type.title} accessibilityRole="header">Insights</Text>
          <RangePills range={range} onChange={setRange} />
        </View>

        {showInsightsEmpty ? (
          <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: 20, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 22, alignItems: 'center', marginTop: 12 }}>
            <Mascot mood="wave" size={120} intensity={0.45} />
            <Text style={{ ...Type.title, textAlign: 'center', marginTop: 14 }}>No hours yet</Text>
            <Text style={{ ...Type.body, fontSize: 17, lineHeight: 24, textAlign: 'center', marginTop: 8, marginBottom: 24 }}>
              Give one focus session to a pillar and you'll see where your week went.
            </Text>
            <View style={{ alignSelf: 'stretch' }}>
              <CTA label="Start your first session" onPress={() => router.push('/(tabs)/focus')} />
            </View>
          </View>
        ) : null}
        {showInsightsEmpty ? (
          <GoalsSection objectives={activeObjectives} onObjectivePress={(id) => router.push(`/objective/${id}`)} />
        ) : (
          <>
            {/* Hero: total hours + stacked pillar bars */}
            <View style={{ backgroundColor: Surface.surface, borderRadius: 20, padding: 20, ...Elevation.card }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text
                    style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 48, lineHeight: 54, letterSpacing: -1.2 }}
                    accessibilityLabel={`${formatHM(totalHours)} given to your pillars ${RANGE_PHRASE[range]}`}
                  >
                    {formatHM(totalHours)}
                  </Text>
                  <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodySemiBold, fontSize: 17, lineHeight: 22 }}>
                    given to your pillars {RANGE_PHRASE[range]}
                  </Text>
                  {delta ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                      <Ionicons name={delta.icon} size={14} color={delta.color} />
                      <Text style={{ color: delta.color, fontFamily: FontFamily.bodyBold, fontSize: 14 }}>{delta.text}</Text>
                    </View>
                  ) : (
                    <Text style={{ ...Type.meta, marginTop: 8 }}>
                      {dailyAverage > 0 ? `${formatHM(dailyAverage)} a day on average` : 'No time logged yet'}
                    </Text>
                  )}
                </View>
                <Mascot mood={flameIntensity > 0.8 ? 'proud' : flameIntensity < 0.3 ? 'calm' : 'happy'} size={76} intensity={flameIntensity} />
              </View>
              <View style={{ marginTop: 20 }}>
                <StackedBars buckets={buckets} goals={goals} range={range} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
                {goals.map((g) => (
                  <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: getGoalColor(g) }} />
                    <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 13 }}>{g.name}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, paddingHorizontal: 4 }}>
              <View style={{ width: 3, borderRadius: 2, backgroundColor: Accent.blue }} />
              <Text style={{ ...Type.body, color: Surface.ink, flex: 1 }}>{insightSentence}</Text>
            </View>

            {/* Goals */}
            <GoalsSection objectives={activeObjectives} onObjectivePress={(id) => router.push(`/objective/${id}`)} />

            {/* Per-pillar rows */}
            <SectionTitle title="Where it went" meta={dailyAverage > 0 ? `${formatHM(dailyAverage)}/day avg` : 'No data'} />
            <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: 20, padding: 16, gap: 16 }}>
              {goalHours.map(({ goal, hours }) => {
                const wPct = maxHours > 0 ? (hours / maxHours) * 100 : 0;
                const tone = getGoalColor(goal);
                const showSliver = hours > 0 && wPct < 6;
                const share = totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0;
                const parts = split[goal.id] ?? { goal: 0, maintenance: 0, free: 0 };
                return (
                  <View key={goal.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <PillarIcon icon={goal.icon} name={goal.name} color={tone} size={40} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 7 }}>
                        <Text style={{ flex: 1, color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 16, paddingRight: 8 }} numberOfLines={1}>
                          {goal.name}
                        </Text>
                        <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 16 }}>{formatHM(hours)}</Text>
                        <Text style={{ color: Surface.faint, fontFamily: FontFamily.bodySemiBold, fontSize: 13, width: 42, textAlign: 'right' }}>{share}%</Text>
                      </View>
                      <SplitBar split={parts} widthPct={showSliver ? 6 : wPct} tone={tone} />
                      <SplitLabels split={parts} tone={tone} />
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Balance radar */}
            {goalHours.length >= 3 ? (
              <>
                <SectionTitle title="Balance" meta="vs. your top pillar" />
                <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: 20, paddingVertical: 12 }}>
                  <BalanceRadar items={goalHours.map(({ goal, hours }) => ({ name: goal.name, hours, color: getGoalColor(goal) }))} />
                </View>
              </>
            ) : null}

            {/* Streaks */}
            <SectionTitle title="Streaks" meta={`${activeStreaks} active`} />
            {streaks.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {streaks.map(({ action, goal, current, best }) => {
                  const tone = getGoalColor(goal);
                  const live = current > 0;
                  return (
                    <View
                      key={action.id}
                      style={{ width: '48.5%', flexGrow: 1, backgroundColor: Surface.surfaceRaised, borderRadius: 18, padding: 14 }}
                      accessible
                      accessibilityLabel={`${action.name}, ${goal.name}: ${current} day streak, best ${best}`}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name={live ? 'flame' : 'flame-outline'} size={20} color={live ? Accent.orange : Surface.faint} />
                        <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 30, lineHeight: 34 }}>{live ? current : 0}</Text>
                        <Text style={{ ...Type.meta, marginLeft: 'auto' }}>best {best}</Text>
                      </View>
                      <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 15, lineHeight: 20, marginTop: 8 }} numberOfLines={2}>
                        {action.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
                        <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 13 }} numberOfLines={1}>
                          {goal.name}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: 18, padding: 16 }}>
                <Text style={Type.body}>Streaks show up once you repeat a habit a few days in a row.</Text>
              </View>
            )}

            <SectionTitle title="Look back" />
            <View style={{ gap: 10 }}>
              <LinkRow icon="create-outline" label="Weekly review" onPress={() => router.push('/weekly-review')} />
              <LinkRow icon="time-outline" label="Session history" onPress={() => router.push('/session-history')} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
