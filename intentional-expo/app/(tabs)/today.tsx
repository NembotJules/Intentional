import { useCallback, useState, useEffect, useMemo } from 'react';
import { View, Text, Platform, Modal, Pressable, RefreshControl } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Check, ChevronDown, ChevronRight, EyeOff, Moon, Play, Plus, Timer } from 'lucide-react-native';
import { Card, Num, PillButton, splitUnit } from '@/components/ui/kit';
import { FlickWorld } from '@/components/world/FlickWorld';
import { Sticker, type StickerName } from '@/components/ui/Sticker';
import { getSelectedWorld, onWorldChange } from '@/services/worldChoice';
import { skyPhase, worldLook, worldWarmth } from '@/services/world';
import { currentDayStreak } from '@/services/dayStreak';
import { pickUpNext, upNextWhen, type OpenHabit, type NextStep } from '@/services/upNext';
import { ActionRow } from '@/components/ActionRow';
import { PrimaryButton } from '@/components/PrimaryButton';
import { PressableScale, ProgressBar, enter } from '@/components/ui/motion';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { Accent, Camp, Elevation, FontFamily, Radius, Surface, Type, hexToRgba, stomp } from '@/constants/design';
import { Mascot } from '@/components/onboarding/Mascot';
import { flickLines, flickMoodOfDay } from '@/services/flickLife';
import { stageToNextLabel } from '@/services/lifeLedger';
import { storyYear, yearHours } from '@/services/yearInHours';
import * as api from '@/db/api';
import * as goalProgress from '@/services/goalProgress';
import type { MetaGoal, DailyAction, Objective, Task } from '@/types';
import { getGoalColor } from '@/utils/goalColors';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { syncHabits } from '@/services/habitSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDayKey, localDayStart, timeToMinutes } from '@/utils/dates';
import { confirmAsync } from '@/utils/confirm';
import * as AppBlocking from '@/services/appBlocking';
import { AUTOSTART_WINDOW_MIN } from '@/services/habitSchedule';
import { getPartner, isPartnerPromptSnoozed, isWeekSent, reportWeek, snoozePartnerPrompt, type Partner } from '@/services/partner';
import { isRitualDue } from '@/services/ritual';
import { WeekShareSheet } from '@/components/share/WeekShareSheet';

/** US-111: text that stands on Flick's ground (white on the world's earth colour): only the big number now. */
const OnGround = { sub: 'rgba(255,255,255,0.78)' } as const;
/** US-115: everything under the big number sits on the Campfire cream sheet. */
const campHeading = { fontFamily: FontFamily.bodyBlack, fontSize: 21, lineHeight: 26, color: Camp.bark, marginBottom: 10, letterSpacing: -0.3 } as const;
const campCard = { backgroundColor: Camp.card, borderRadius: Radius.card, ...stomp() } as const;

function CampTile({ sticker, value, label, accessibilityLabel }: { sticker: StickerName; value: string; label: string; accessibilityLabel: string }) {
  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={{ flex: 1, alignItems: 'center', paddingVertical: 14, ...campCard, borderRadius: 22 }}>
      <Sticker name={sticker} size={38} />
      <Text style={{ marginTop: 6, fontFamily: FontFamily.bodyBlack, fontSize: 26, lineHeight: 30, color: Camp.bark, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: Camp.barkFaint }}>
        {label}
      </Text>
    </View>
  );
}

function todayStr() {
  return localDayKey();
}

function formatMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.floor(totalMinutes));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function daysLeftLabel(days: number): string {
  if (days < 0) return 'Deadline passed';
  if (days === 0) return 'Due today';
  return days === 1 ? '1 day left' : `${days} days left`;
}

/** US-098: pillars the person opened on Today (pillar id → open). Pillars start closed: Today shows one thing at a time. */
const OPEN_KEY = '@intentional/todayOpen';

type PillarSection = { goal: MetaGoal; habits: DailyAction[] };

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState(false);
  const [pillars, setPillars] = useState<MetaGoal[]>([]);
  const [sections, setSections] = useState<PillarSection[]>([]);
  const [habitDones, setHabitDones] = useState<Record<string, boolean>>({});
  /** pillar id → minutes given today, from every session (habits, tasks, free time) */
  const [pillarMinutes, setPillarMinutes] = useState<Record<string, number>>({});
  const [sessionMins, setSessionMins] = useState<Record<string, number>>({});
  /** Current streak per habit (scheduled days only). */
  const [actionStreaks, setActionStreaks] = useState<Record<string, number>>({});
  /** US-065: the active goal per pillar and all its tasks (progress, pace, next task). */
  const [objectives, setObjectives] = useState<Record<string, Objective | null>>({});
  const [objectiveTasks, setObjectiveTasks] = useState<Record<string, Task[]>>({});
  /** US-068: goal lookup for habit tags. */
  const [objectiveById, setObjectiveById] = useState<Record<string, Objective>>({});
  /** US-098: sessions given today (any pillar). */
  const [sessionsToday, setSessionsToday] = useState(0);
  /** US-111: days in a row you gave your pillars time (the flame in the header). */
  const [dayStreak, setDayStreak] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  // US-079: Flick's lifetime stage + this week's brightness.
  const [flick, setFlick] = useState(() => api.getFlickState());
  // US-101: the world Flick lives in (earned with hours, chosen in app/worlds.tsx).
  const [worldId, setWorldId] = useState(() => getSelectedWorld());
  useEffect(() => onWorldChange(() => setWorldId(getSelectedWorld())), []);
  const [yearReady, setYearReady] = useState<{ year: number; minutes: number } | null>(null);
  /** US-078: habits skipped today (rest days). */
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  /** Long-press options for a habit (Skip today / Hide). */
  const [optionsFor, setOptionsFor] = useState<DailyAction | null>(null);
  /** US-082 + partner: "Your week is ready" (Sunday/Monday) or "Who sees your week?" (once there's some history). */
  const [weekCard, setWeekCard] = useState<'ritual' | 'partner' | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [partnerSent, setPartnerSent] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  /** US-098: which pillar rows are open (remembered). */
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showDone, setShowDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    void AsyncStorage.getItem(OPEN_KEY)
      .then((raw) => {
        if (raw) setOpen(JSON.parse(raw) as Record<string, boolean>);
      })
      .catch(() => {});
  }, []);
  const toggleOpen = (goalId: string, current: boolean) => {
    hapticLight();
    setOpen((f) => {
      const next = { ...f, [goalId]: !current };
      void AsyncStorage.setItem(OPEN_KEY, JSON.stringify(next));
      return next;
    });
  };

  const load = useCallback(async () => {
    const date = todayStr();
    // Every habit belongs to a goal: habits left without one join their pillar's active goal (also older data).
    if (api.adoptWaitingHabits() > 0) void syncHabits();
    setFlick(api.getFlickState());
    setWorldId(getSelectedWorld());
    // US-086: Dec 1 → Jan 15, the year's story until it's opened once.
    const story = storyYear(new Date());
    const yearMins = story.final && !api.isYearStorySeen(story.year) ? api.getYearSummary(story.year).totalMinutes : 0;
    setYearReady(yearMins > 0 ? { year: story.year, minutes: yearMins } : null);
    setPillarMinutes(api.getMinutesByPillarForDay(date));
    setDayStreak(currentDayStreak(api.getGivenDays(), date));
    const goals = await api.getGoals();
    const dayStart = localDayStart(date);
    setSessionsToday((await api.getSessionsBetween(dayStart.toISOString(), new Date(dayStart.getTime() + 86400000 - 1).toISOString())).length);
    const nextSections: PillarSection[] = [];
    const nextHabit: Record<string, boolean> = {};
    const nextMins: Record<string, number> = {};
    const nextStreaks: Record<string, number> = {};
    const nextObjectives: Record<string, Objective | null> = {};
    const nextTasks: Record<string, Task[]> = {};
    const nextObjectiveById: Record<string, Objective> = {};

    for (const goal of goals) {
      const obj = await api.getActiveObjective(goal.id);
      nextObjectives[goal.id] = obj;
      const all = await api.getObjectives(goal.id);
      for (const o of all) if (o.status === 'active' || o.status === 'planned') nextObjectiveById[o.id] = o;
      if (obj) nextTasks[goal.id] = await api.getTasks(obj.id);

      // US-069: only habits scheduled today, in time order.
      const habits = (await api.getActionsByGoal(goal.id))
        .filter((a) => api.isScheduledOn(a.days_mask ?? 127, date))
        .sort((a, b) => timeToMinutes(a.reminder_time) - timeToMinutes(b.reminder_time) || a.sort_order - b.sort_order);
      for (const a of habits) {
        if (a.type === 'habit') nextHabit[a.id] = await api.isHabitDoneToday(a.id);
        else {
          const sessions = await api.getSessionsForActionToday(a.id, date);
          nextMins[a.id] = Math.floor(sessions.reduce((s, x) => s + x.duration_seconds, 0) / 60);
        }
        nextStreaks[a.id] = api.getActionStreakMetrics(a.id, a.type).current;
      }
      // US-098: every pillar has a row on Today (goal nudges live on the Goals tab).
      nextSections.push({ goal, habits });
    }
    setPillars(goals);
    setSections(nextSections);
    setHabitDones(nextHabit);
    setSessionMins(nextMins);
    setActionStreaks(nextStreaks);
    setObjectives(nextObjectives);
    setObjectiveTasks(nextTasks);
    setObjectiveById(nextObjectiveById);
    setSkippedIds(api.getSkippedHabits(date));
    const p = getPartner();
    setPartner(p);
    setPartnerSent(isWeekSent(reportWeek().weekStart));
    setWeekCard(
      goals.length === 0
        ? null
        : isRitualDue()
          ? 'ritual'
          : !p && !isPartnerPromptSnoozed() && api.getSessionCount() >= 3
            ? 'partner'
            : null
    );
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onHabitToggle = useCallback(
    async (actionId: string, done: boolean) => {
      done ? hapticMedium() : hapticLight();
      setHabitDones((prev) => ({ ...prev, [actionId]: done }));
      await api.setHabitCompletion(actionId, todayStr(), done);
      void syncHabits(); // US-075: done today → no alert today; unticked → it comes back
      await load();
    },
    [load]
  );

  const onStartSession = useCallback(
    (goal: MetaGoal, action: DailyAction) => {
      router.push(`/(tabs)/focus?goalId=${encodeURIComponent(goal.id)}&actionId=${encodeURIComponent(action.id)}`);
    },
    [router]
  );

  const confirmDeactivateAction = useCallback(
    async (action: DailyAction) => {
      const yes = await confirmAsync({
        title: 'Hide this habit?',
        message: `"${action.name}" will disappear from Today. Open Goals, tap the pillar, then tap Restore on the paused habit.`,
        confirmLabel: 'Hide',
      });
      if (!yes) return;
      await api.updateAction(action.id, { is_active: 0 });
      void syncHabits();
      await load();
    },
    [load]
  );

  /** US-078: "Skip today" = a rest day (keeps the streak once a week), lifts a strict-mode block, silences today's alert. */
  const onSkipHabit = useCallback(
    async (action: DailyAction) => {
      hapticLight();
      setOptionsFor(null);
      api.skipHabit(action.id);
      AppBlocking.endActiveHabitBlock(action.id);
      void syncHabits();
      await load();
    },
    [load]
  );

  const onUnskipHabit = useCallback(
    async (action: DailyAction) => {
      hapticLight();
      api.unskipHabit(action.id);
      void syncHabits();
      await load();
    },
    [load]
  );

  const [userName, setUserName] = useState('');
  useFocusEffect(
    useCallback(() => {
      setUserName(api.getSetting('user_name')?.trim() ?? '');
    }, [])
  );

  const isHabitDone = (a: DailyAction) =>
    a.type === 'session' ? a.target_minutes > 0 && (sessionMins[a.id] ?? 0) >= a.target_minutes : !!habitDones[a.id];

  /**
   * One definition of "today" for a pillar, used by the header, the badges, the fold and "N done":
   * the habits due today. Tasks live inside their goal (founder 2026-10-30), so Today shows only the goal line.
   */
  const today = todayStr();
  const dayOf = (goal: MetaGoal, habits: DailyAction[]) => {
    const obj = objectives[goal.id] ?? null;
    const tasks = obj ? objectiveTasks[goal.id] ?? [] : [];
    // US-078: a habit skipped today is a rest day: not open, not counted.
    const restHabits = habits.filter((a) => skippedIds.has(a.id) && !isHabitDone(a));
    const openHabits = habits.filter((a) => !isHabitDone(a) && !skippedIds.has(a.id));
    const doneHabits = habits.filter(isHabitDone);
    const total = habits.length - restHabits.length;
    const done = doneHabits.length;
    return { obj, tasks, openHabits, doneHabits, restHabits, total, done };
  };

  const visibleSections = sections;
  const days = visibleSections.map((s) => ({ ...s, day: dayOf(s.goal, s.habits) }));
  const totalVisibleActions = days.reduce((acc, s) => acc + s.day.total, 0);
  const completedVisibleActions = days.reduce((acc, s) => acc + s.day.done, 0);
  const hasAnyActions = totalVisibleActions > 0;
  const allDone = hasAnyActions && completedVisibleActions === totalVisibleActions;
  // Every session counts toward "given to your pillars": habits, tasks and free time.
  const creditedMinutes = visibleSections.reduce((total, section) => total + (pillarMinutes[section.goal.id] ?? 0), 0);
  const dayProgress = hasAnyActions ? completedVisibleActions / totalVisibleActions : 0;
  const nothingLogged = creditedMinutes === 0 && completedVisibleActions === 0;
  const truthLine = allDone
    ? 'Every pillar got its time today.'
    : creditedMinutes > 0
      ? 'Nice. Give the next hour to a pillar too.'
      : completedVisibleActions > 0
        ? 'Habits ticked. Now give an hour to a pillar.'
        : 'Give your first hour to a pillar.';
  // US-097: Flick's mood follows the day (sleepy at night, worried by the evening with nothing given…), and he talks when tapped.
  const flickHour = new Date().getHours();
  const flickMood = flickMoodOfDay({ hour: flickHour, minutesToday: nothingLogged ? 0 : Math.max(creditedMinutes, 1), allDone });
  const flickIntensity = flick.brightness;
  const nextOpenHabit = (() => {
    const hhmm = `${String(flickHour).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    const open = days.flatMap((d) => d.day.openHabits);
    const timed = open.filter((h) => h.reminder_time && h.reminder_time >= hhmm).sort((a, b) => (a.reminder_time! < b.reminder_time! ? -1 : 1));
    const h = timed[0] ?? open.find((x) => !x.reminder_time) ?? null;
    return h ? { name: h.name, time: h.reminder_time ?? null } : null;
  })();
  const flickSays = flickLines({
    hour: flickHour,
    userName,
    minutesToday: creditedMinutes,
    allDone,
    pillarsAtZero: visibleSections.filter((sec) => !(pillarMinutes[sec.goal.id] ?? 0)).map((sec) => sec.goal.name),
    nextHabit: nextOpenHabit,
    stageName: flick.stage.name,
    toNextStage: flick.stage.next ? stageToNextLabel(flick.stage) : null,
  });

  // US-069: "in 25 min" only on the single next habit that starts within two hours.
  const nowDate = new Date();
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  let upcoming: { id: string; inMin: number } | null = null;
  for (const s of days) {
    for (const a of s.day.openHabits) {
      const start = timeToMinutes(a.reminder_time);
      if (start === 9999) continue;
      const diff = start - nowMinutes;
      if (diff > 0 && diff <= 120 && (!upcoming || diff < upcoming.inMin)) upcoming = { id: a.id, inMin: diff };
    }
  }

  const greeting = (() => {
    const h = new Date().getHours();
    const base = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return userName ? `${base}, ${userName}` : base;
  })();
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const [refreshing, setRefreshing] = useState(false);
  const onPullRefresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, [load]);

  // US-098: today's plan = the minutes of today's timed habits; the world warms as it's given.
  const planMinutes = days.reduce((sum, s) => sum + s.habits.filter((a) => a.type === 'session' && !skippedIds.has(a.id)).reduce((m, a) => m + (a.target_minutes || 0), 0), 0);
  const warmth = worldWarmth(creditedMinutes, planMinutes);
  const pillarsFed = sections.filter((sec) => (pillarMinutes[sec.goal.id] ?? 0) > 0).length;

  // US-098: the ONE thing Today puts forward.
  const openHabits: OpenHabit[] = days.flatMap((d) =>
    d.day.openHabits.map((a) => ({ id: a.id, name: a.name, pillarId: d.goal.id, time: a.reminder_time ?? null, type: a.type === 'habit' ? ('habit' as const) : ('session' as const), minutes: a.target_minutes }))
  );
  const nextSteps: NextStep[] = days.flatMap((d) => {
    const obj = d.day.obj;
    const t = d.day.tasks.filter((x) => x.is_done === 0).sort((a, b) => a.sort_order - b.sort_order)[0];
    return obj && t ? [{ taskId: t.id, title: t.title, pillarId: d.goal.id, goalTitle: obj.title, minutes: t.estimate_minutes }] : [];
  });
  const upNext = pickUpNext(openHabits, nextSteps, nowMinutes);
  const upPillar = upNext ? pillars.find((p) => p.id === (upNext.kind === 'habit' ? upNext.habit.pillarId : upNext.step.pillarId)) ?? null : null;
  const upAction = upNext?.kind === 'habit' ? sections.flatMap((x) => x.habits).find((a) => a.id === upNext.habit.id) ?? null : null;
  const startUpNext = () => {
    if (!upNext || !upPillar) return;
    if (upNext.kind === 'step') {
      router.push(`/(tabs)/focus?goalId=${encodeURIComponent(upPillar.id)}&taskId=${encodeURIComponent(upNext.step.taskId)}`);
      return;
    }
    if (!upAction) return;
    if (upAction.type === 'habit') void onHabitToggle(upAction.id, true);
    else onStartSession(upPillar, upAction);
  };

  let enterIndex = 0;
  const fullWorldNow = loaded && pillars.length > 0;
  // US-111: the ground Flick stands on is the colour of the whole page under the scene.
  const ground = worldLook({ hour: nowDate.getHours(), minute: nowDate.getMinutes(), warmth, themeId: worldId }).ground;

  // US-111: the header floats on Flick's sky: Flick's worlds (left), the greeting (centre), the day streak and the gear (right).
  const headerRow = (onDark: boolean) => {
    const fg = onDark ? Surface.focusText : Surface.ink;
    const roundBtn = { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', ...Elevation.card } as const;
    return (
      <View style={{ flex: 1, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {fullWorldNow ? (
          <PressableScale onPress={() => router.push('/worlds')} accessibilityRole="button" accessibilityLabel="Flick's worlds" hitSlop={6} style={roundBtn}>
            <Sticker name="picture" size={26} />
          </PressableScale>
        ) : null}
        <View style={{ flex: 1, minWidth: 0, alignItems: fullWorldNow ? 'center' : 'flex-start' }}>
          <Text style={[Type.eyebrow, { fontSize: 13, lineHeight: 16, color: onDark ? 'rgba(255,248,238,0.8)' : 'rgba(23,20,17,0.6)' }]}>{dateStr}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: FontFamily.bodyBlack, fontSize: greeting.length > 22 ? 16 : greeting.length > 17 ? 18 : 22, lineHeight: 26, color: fg, letterSpacing: -0.3 }}>
            {greeting}
          </Text>
        </View>
        {fullWorldNow ? (
          <PressableScale
            onPress={() => router.push('/streak')}
            accessibilityRole="button"
            accessibilityLabel={`Day streak: ${dayStreak} ${dayStreak === 1 ? 'day' : 'days'}`}
            hitSlop={6}
            style={{ alignItems: 'center', justifyContent: 'center', width: 42 }}
          >
            <Sticker name="flame" size={34} />
            <Text style={{ marginTop: -6, fontFamily: FontFamily.bodyBlack, fontSize: 13, lineHeight: 15, color: fg }}>{dayStreak}</Text>
          </PressableScale>
        ) : null}
        <PressableScale onPress={() => router.push('/settings')} accessibilityLabel="Settings" hitSlop={8} style={roundBtn}>
          <Sticker name="gear" size={26} />
        </PressableScale>
      </View>
    );
  };
  const fullWorld = fullWorldNow;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={fullWorld ? [] : ['top']} style={fullWorld ? { backgroundColor: ground } : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      {fullWorld ? <StatusBar style={skyPhase(nowDate.getHours()) === 'day' ? 'dark' : 'light'} /> : null}
      <ScrollView
        className="flex-1"
        contentContainerStyle={fullWorld ? { flexGrow: 1 } : { paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={Surface.muted} />}
      >
        {/* 1 · date + greeting (only before the first pillar; then it floats on the world) */}
        {!fullWorld ? <View style={{ height: 64, marginTop: 6 }}>{headerRow(false)}</View> : null}

        {!loaded ? null : pillars.length === 0 ? (
          <Animated.View entering={enter(enterIndex++)} style={{ alignItems: 'center', marginTop: 28, paddingHorizontal: 20 }}>
            <Mascot mood="wave" size={132} intensity={0.55} />
            <Text style={[Type.title, { marginTop: 18, textAlign: 'center' }]}>Give your first hour to a pillar.</Text>
            <Text style={[Type.body, { marginTop: 10, textAlign: 'center', paddingHorizontal: 12 }]}>
              Pick what matters to you (body, mind, craft, etc.) and add one habit. Every minute you focus gets given to it.
            </Text>
            <View style={{ marginTop: 28, gap: 10, alignSelf: 'stretch' }}>
              <PrimaryButton title="Add a pillar" appearance="filled" onPress={() => router.push('/(tabs)/goals?create=1')} showArrow={false} />
            </View>
          </Animated.View>
        ) : (
          <>
            {/* 2 · Flick's world, edge to edge (US-106) */}
            <View>
              <FlickWorld
                fullBleed
                topInset={insets.top}
                header={headerRow}
                hour={nowDate.getHours()}
                minute={nowDate.getMinutes()}
                warmth={warmth}
                mood={flickMood}
                flickIntensity={Math.max(flickIntensity, 0.35 + 0.6 * warmth)}
                stage={flick.stage.index}
                stageLabel={`${flick.stage.name} · ${stageToNextLabel(flick.stage)}`}
                stageA11y={`Flick is a ${flick.stage.name}, ${stageToNextLabel(flick.stage)}`}
                onStagePress={() => router.push('/life')}
                lines={flickSays}
                pulseKey={completedVisibleActions}
                flickLabel={allDone ? 'Flick is proud' : `Flick, ${flickMood}`}
                themeId={worldId}
              />
            </View>

            {/* US-111: the big number stands on Flick's ground; US-115: the rest on the Campfire cream sheet */}
            <View style={{ backgroundColor: ground, paddingTop: 2, flexGrow: 1 }}>
            {/* 3 · one big number, white on the ground, with a thick bar */}
            <Animated.View
              entering={enter(enterIndex++)}
              accessible
              accessibilityLabel={`${formatMinutes(creditedMinutes)} given today${planMinutes > 0 ? ` of a ${formatMinutes(planMinutes)} plan` : ''}`}
              style={{ paddingHorizontal: 20, marginTop: 4, alignItems: 'center' }}
            >
              <Num {...splitUnit(formatMinutes(creditedMinutes))} size={64} color="#FFFFFF" />
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: OnGround.sub, marginTop: -2 }}>
                {planMinutes > 0 ? `given today · plan ${formatMinutes(planMinutes)}` : 'given to your pillars today'}
              </Text>
              <View style={{ alignSelf: 'stretch', marginTop: 14 }}>
                <ProgressBar progress={planMinutes > 0 ? Math.min(1, creditedMinutes / planMinutes) : creditedMinutes > 0 ? 1 : 0} color={Camp.gold} trackColor="rgba(255,255,255,0.22)" height={14} />
              </View>
            </Animated.View>

            {/* US-115: the cream sheet rises out of the ground */}
            <View style={{ flexGrow: 1, marginTop: 24, paddingTop: 22, paddingBottom: 150, backgroundColor: Camp.canvas, borderTopLeftRadius: 30, borderTopRightRadius: 30 }}>
            {/* 4 · three tiles */}
            <Animated.View entering={enter(enterIndex++)} style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20 }}>
              <CampTile sticker="check" value={`${completedVisibleActions}/${totalVisibleActions}`} label="Habits done" accessibilityLabel={`Habits done: ${completedVisibleActions} of ${totalVisibleActions}`} />
              <CampTile sticker="stopwatch" value={String(sessionsToday)} label={sessionsToday === 1 ? 'Session' : 'Sessions'} accessibilityLabel={`Sessions today: ${sessionsToday}`} />
              <CampTile sticker="target" value={`${pillarsFed}/${sections.length}`} label="Pillars fed" accessibilityLabel={`Pillars given time today: ${pillarsFed} of ${sections.length}`} />
            </Animated.View>

            {/* 5 · up next: a peach card with the ember play button */}
            <Animated.View entering={enter(enterIndex++)} style={{ paddingHorizontal: 20, marginTop: 26 }}>
              <Text style={campHeading}>Up next</Text>
              {upNext && upPillar ? (
                <View
                  accessible={false}
                  accessibilityLabel={`Up next: ${upNext.kind === 'habit' ? upNext.habit.name : upNext.step.title}, ${upNextWhen(upNext)}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: Radius.card, backgroundColor: Camp.container, ...stomp('#EFCDBD') }}
                >
                  <PillarIcon icon={upPillar.icon} name={upPillar.name} color={getGoalColor(upPillar)} size={48} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBlack, fontSize: 19, lineHeight: 24, color: Camp.bark }}>
                      {upNext.kind === 'habit' ? upNext.habit.name : upNext.step.title}
                    </Text>
                    <Text numberOfLines={1} style={[Type.meta, { marginTop: 2, color: upNext.kind === 'habit' && upNext.when === 'missed' ? Camp.emberText : Camp.barkSoft }]}>
                      {upPillar.name} · {upNextWhen(upNext)}
                    </Text>
                  </View>
                  <PressableScale
                    onPress={startUpNext}
                    accessibilityRole="button"
                    accessibilityLabel={upAction?.type === 'habit' ? `Complete ${upAction.name}` : `Start up next: ${upNext.kind === 'habit' ? upNext.habit.name : upNext.step.title}`}
                    style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: Camp.ember, alignItems: 'center', justifyContent: 'center', ...stomp(Camp.emberDeep) }}
                  >
                    {upAction?.type === 'habit' ? <Check size={22} color="#FFFFFF" strokeWidth={3} /> : <Play size={20} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />}
                  </PressableScale>
                </View>
              ) : (
                <View accessibilityLabel="Up next: nothing planned" style={{ padding: 16, borderRadius: Radius.card, backgroundColor: Camp.container, ...stomp('#EFCDBD') }}>
                  <Text style={[Type.heading, { fontSize: 17, color: Camp.bark }]}>{allDone ? 'Everything planned is done.' : 'Nothing planned right now.'}</Text>
                </View>
              )}
              {/* US-070: free session → pick a pillar first (in-app, every platform). */}
              <PressableScale
                onPress={() => setPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Free session"
                style={{ alignSelf: 'flex-start', marginTop: 12, height: 40, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, ...campCard, borderRadius: 20, borderBottomWidth: 3 }}
              >
                <Timer size={16} color={Camp.ember} strokeWidth={2.6} />
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Camp.bark }}>Free session</Text>
              </PressableScale>
            </Animated.View>

            {yearReady ? (
              <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
                <Animated.View entering={FadeIn.duration(220)} style={{ padding: 16, borderRadius: Radius.card, backgroundColor: Surface.ink }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Mascot mood="proud" size={54} intensity={1} bob={false} stage={flick.stage.index} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 18, lineHeight: 23, color: Surface.surface }}>Your {yearReady.year} in hours</Text>
                      <Text style={{ fontFamily: FontFamily.body, fontSize: 14, lineHeight: 19, color: Surface.focusMuted, marginTop: 2 }}>
                        {yearHours(yearReady.minutes)} given this year. See where it went.
                      </Text>
                    </View>
                  </View>
                  <PillButton label="Open your year" variant="inverse" accessibilityLabel={`Open your ${yearReady.year} in hours`} onPress={() => router.push('/year')} style={{ marginTop: 14 }} />
                </Animated.View>
              </View>
            ) : null}

            {weekCard ? (
              <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
                {/* US-082: Sunday ritual / accountability partner (at most one card) */}
                {weekCard === 'ritual' ? (
                  <Animated.View entering={FadeIn.duration(220)} style={{ padding: 16, borderRadius: Radius.card, backgroundColor: Surface.ink }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Mascot mood="wave" size={54} intensity={0.8} bob={false} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 18, lineHeight: 23, color: Surface.surface }}>Your week is ready</Text>
                        <Text style={{ fontFamily: FontFamily.body, fontSize: 14, lineHeight: 19, color: Surface.focusMuted, marginTop: 2 }}>
                          {partner && !partnerSent ? `Look back, plan next week, send it to ${partner.name}.` : 'Look back and plan next week. 3 minutes.'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                      <PillButton label="Open your week" variant="inverse" onPress={() => router.push('/ritual')} style={{ flex: 1 }} />
                      {partner && !partnerSent ? (
                        <PillButton label={`Send to ${partner.name}`} onPress={() => setShareOpen(true)} style={{ backgroundColor: Surface.focusSurface }} />
                      ) : null}
                    </View>
                  </Animated.View>
                ) : weekCard === 'partner' ? (
                  <Animated.View entering={FadeIn.duration(220)} style={{ padding: 16, ...campCard }}>
                    <Text style={{ fontFamily: FontFamily.bodyBlack, fontSize: 17, lineHeight: 22, color: Camp.bark }}>Who sees your week?</Text>
                    <Text style={[Type.body, { fontSize: 15, lineHeight: 21, marginTop: 4, color: Camp.barkSoft }]}>Pick one person to get your hours each Sunday.</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                      <PillButton label="Choose someone" accessibilityLabel="Choose a partner" size="sm" color={Camp.ember} onPress={() => router.push('/partner')} />
                      <PressableScale
                        onPress={() => {
                          snoozePartnerPrompt();
                          setWeekCard(null);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Not now, partner"
                        style={{ height: 36, paddingHorizontal: 12, borderRadius: Radius.full, justifyContent: 'center' }}
                      >
                        <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Surface.muted }}>Not now</Text>
                      </PressableScale>
                    </View>
                  </Animated.View>
                ) : null}
              </View>
            ) : null}

            {/* 6 · the pillars, one row each; a row opens to its goal and today's habits */}
            <Animated.View entering={enter(enterIndex++)} style={{ paddingHorizontal: 20, marginTop: 28 }}>
              <Text style={campHeading}>Your pillars</Text>
              <View style={{ gap: 10 }}>
                {days.map(({ goal, habits, day }) => {
                  const tone = getGoalColor(goal);
                  const goalMinutes = pillarMinutes[goal.id] ?? 0;
                  const goalTargetMinutes = habits.reduce((t, a) => (a.type === 'session' && !skippedIds.has(a.id) ? t + a.target_minutes : t), 0);
                  const { obj, tasks, openHabits: openList, doneHabits, restHabits, total, done } = day;
                  const pillarDone = total > 0 && done === total;
                  const isOpen = !!open[goal.id];
                  const doneShown = !!showDone[goal.id];
                  const sub = goalTargetMinutes > 0 ? `${formatMinutes(goalMinutes)} of ${formatMinutes(goalTargetMinutes)}` : goalMinutes > 0 ? `${formatMinutes(goalMinutes)} today` : total > 0 ? `${total} ${total === 1 ? 'habit' : 'habits'} today` : obj ? obj.title : 'Nothing due today';

                  const renderAction = (action: DailyAction) => {
                    const isSession = action.type === 'session';
                    const mins = sessionMins[action.id] ?? 0;
                    const progress = action.target_minutes > 0 ? Math.min(1, mins / action.target_minutes) : 0;
                    // US-078: start time passed → "now" for the first 30 min, then "Missed 7:00. Do it now?" until the day ends.
                    const startAt = timeToMinutes(action.reminder_time);
                    const late = startAt === 9999 ? -1 : nowMinutes - startAt;
                    const isOpenHabit = !isHabitDone(action) && !skippedIds.has(action.id);
                    const row = (
                      <ActionRow
                        goal={goal}
                        action={action}
                        progress={progress}
                        isCompleted={isHabitDone(action)}
                        isHabitDone={!!habitDones[action.id]}
                        minutesLoggedToday={mins}
                        toneColor={tone}
                        streak={actionStreaks[action.id] ?? 0}
                        objective={null}
                        minutesUntilStart={upcoming?.id === action.id ? upcoming.inMin : undefined}
                        isNow={isOpenHabit && late >= 0 && late <= AUTOSTART_WINDOW_MIN}
                        missed={isOpenHabit && late > AUTOSTART_WINDOW_MIN}
                        onStart={isSession ? () => onStartSession(goal, action) : undefined}
                        onHabitToggle={!isSession ? (d) => void onHabitToggle(action.id, d) : undefined}
                        onSkip={() => void onSkipHabit(action)}
                        onLongPress={() => setOptionsFor(action)}
                      />
                    );
                    if (Platform.OS === 'web') return <View key={action.id}>{row}</View>;
                    return (
                      <Swipeable
                        key={action.id}
                        friction={2}
                        overshootRight={false}
                        rightThreshold={32}
                        renderRightActions={() => (
                          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, paddingLeft: 10, marginBottom: 10 }}>
                            {isOpenHabit ? (
                              <TouchableOpacity
                                onPress={() => void onSkipHabit(action)}
                                activeOpacity={0.85}
                                accessibilityLabel={`Skip ${action.name} today`}
                                style={{ width: 64, height: '100%', minHeight: 64, borderRadius: Radius.md, backgroundColor: hexToRgba(tone, 0.14), alignItems: 'center', justifyContent: 'center', gap: 4 }}
                              >
                                <Moon size={18} color={tone} strokeWidth={1.9} />
                                <Text style={[Type.meta, { fontSize: 12, color: tone }]}>Skip</Text>
                              </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                              onPress={() => void confirmDeactivateAction(action)}
                              activeOpacity={0.85}
                              accessibilityLabel={`Hide ${action.name}`}
                              style={{ width: 64, height: '100%', minHeight: 64, borderRadius: Radius.md, backgroundColor: Surface.hill, alignItems: 'center', justifyContent: 'center', gap: 4 }}
                            >
                              <EyeOff size={18} color={Surface.muted} strokeWidth={1.75} />
                              <Text style={[Type.meta, { fontSize: 12 }]}>Hide</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      >
                        {row}
                      </Swipeable>
                    );
                  };

                  // US-065: goal line — title · days left · progress bar · pace (the tasks stay inside the goal).
                  const goalLine = (() => {
                    if (!obj) return null;
                    const left = goalProgress.daysLeft(obj, localDayStart(today));
                    const progress = goalProgress.progressOf(obj, tasks);
                    const pace = goalProgress.paceOf(obj, tasks, new Date());
                    const paceText = pace === 'ahead' ? 'ahead' : pace === 'on_track' ? 'on track' : pace === 'behind' ? 'behind' : null;
                    const paceColor = pace === 'behind' ? Accent.amber : tone;
                    const stepsLeft = tasks.filter((t) => t.is_done === 0).length;
                    return (
                      <PressableScale
                        onPress={() => router.push(`/objective/${encodeURIComponent(obj.id)}`)}
                        scaleTo={0.99}
                        accessibilityRole="button"
                        accessibilityLabel={`Goal: ${obj.title}, ${daysLeftLabel(left)}${paceText ? `, ${paceText}` : ''}${stepsLeft ? `, ${stepsLeft} ${stepsLeft === 1 ? 'step' : 'steps'} left` : ''}`}
                        style={{ padding: 12, marginBottom: 10, borderRadius: Radius.md, backgroundColor: hexToRgba(tone, 0.07) }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text numberOfLines={1} style={[Type.heading, { flex: 1, fontSize: 16, lineHeight: 21 }]}>
                            {obj.title}
                          </Text>
                          {stepsLeft ? <Text style={[Type.meta, { fontSize: 13 }]}>{stepsLeft} {stepsLeft === 1 ? 'step' : 'steps'}</Text> : null}
                          <ChevronRight size={16} color={Surface.faint} strokeWidth={2.2} />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                          <Text style={[Type.meta, { fontSize: 13 }]}>{daysLeftLabel(left)}</Text>
                          <View style={{ flex: 1, minWidth: 24 }}>
                            {progress !== null ? <ProgressBar progress={progress} color={tone} trackColor={hexToRgba(tone, 0.16)} height={5} /> : null}
                          </View>
                          {paceText ? <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: paceColor }}>{paceText}</Text> : null}
                        </View>
                      </PressableScale>
                    );
                  })();

                  return (
                    <View key={goal.id} style={{ ...campCard, overflow: 'hidden' }}>
                      <PressableScale
                        onPress={() => toggleOpen(goal.id, isOpen)}
                        haptic={false}
                        scaleTo={0.99}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: isOpen }}
                        aria-expanded={isOpen}
                        accessibilityLabel={total > 0 ? `${goal.name}, ${done} of ${total} done` : goal.name}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
                      >
                        <PillarIcon icon={goal.icon} name={goal.name} color={tone} size={42} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBlack, fontSize: 18, lineHeight: 23, color: Camp.bark }}>
                            {goal.name}
                          </Text>
                          <Text numberOfLines={1} style={[Type.meta, { marginTop: 1, color: Camp.barkFaint }]}>
                            {sub}
                          </Text>
                          {goalTargetMinutes > 0 ? (
                            <View style={{ marginTop: 8 }}>
                              <ProgressBar progress={goalMinutes / goalTargetMinutes} color={goalMinutes >= goalTargetMinutes ? Camp.meadow : Camp.ember} trackColor={Camp.track} height={8} />
                            </View>
                          ) : null}
                        </View>
                        {total > 0 ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 10, borderRadius: Radius.full, backgroundColor: pillarDone ? Camp.sprout : Camp.containerLow }}>
                            {pillarDone ? <Check size={13} color={Camp.pine} strokeWidth={3} /> : null}
                            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: pillarDone ? Camp.pine : Camp.barkSoft }}>
                              {done}/{total}
                            </Text>
                          </View>
                        ) : null}
                        <View style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>
                          <ChevronDown size={20} color={Camp.barkFaint} strokeWidth={2.4} />
                        </View>
                      </PressableScale>

                      {isOpen ? (
                        <View style={{ marginHorizontal: 8, marginBottom: 8, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 2, borderRadius: 18, backgroundColor: Camp.containerLow }}>
                          {goalLine}
                          {!obj && habits.length > 0 ? (
                            <PressableScale
                              onPress={() => router.push(`/goal/${encodeURIComponent(goal.id)}?setGoal=1`)}
                              accessibilityRole="button"
                              accessibilityLabel={`Set a goal for ${goal.name}`}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 8, marginBottom: 6 }}
                            >
                              <Text style={[Type.meta, { flex: 1 }]}>No goal running. These habits wait for one.</Text>
                              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: Surface.ink }}>Set a goal</Text>
                            </PressableScale>
                          ) : null}
                          {openList.map((a) => renderAction(a))}
                          {done > 0 ? (
                            <PressableScale
                              onPress={() => setShowDone((m) => ({ ...m, [goal.id]: !m[goal.id] }))}
                              accessibilityRole="button"
                              accessibilityLabel={`${done} done in ${goal.name}`}
                              accessibilityState={{ expanded: doneShown }}
                              aria-expanded={doneShown}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 4, marginBottom: doneShown ? 6 : 4 }}
                            >
                              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: hexToRgba(tone, 0.16), alignItems: 'center', justifyContent: 'center' }}>
                                <Check size={12} color={tone} strokeWidth={3} />
                              </View>
                              <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Surface.muted }}>{done} done</Text>
                              <View style={{ transform: [{ rotate: doneShown ? '180deg' : '0deg' }] }}>
                                <ChevronDown size={18} color={Surface.faint} strokeWidth={2.2} />
                              </View>
                            </PressableScale>
                          ) : null}
                          {doneShown ? doneHabits.map((a) => renderAction(a)) : null}
                          {restHabits.map((action) => (
                            <View
                              key={`rest-${action.id}`}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: Radius.md, backgroundColor: hexToRgba(tone, 0.06) }}
                            >
                              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: hexToRgba(tone, 0.14), alignItems: 'center', justifyContent: 'center' }}>
                                <Moon size={14} color={tone} strokeWidth={2.2} />
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text numberOfLines={1} style={[Type.heading, { fontSize: 15, color: Surface.muted }]}>
                                  {action.name}
                                </Text>
                                <Text style={[Type.meta, { fontSize: 12 }]}>Rest day · your streak is safe</Text>
                              </View>
                              <PressableScale
                                onPress={() => void onUnskipHabit(action)}
                                accessibilityRole="button"
                                accessibilityLabel={`Undo skip ${action.name}`}
                                style={{ height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: Surface.surface, justifyContent: 'center' }}
                              >
                                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: Surface.ink }}>Undo</Text>
                              </PressableScale>
                            </View>
                          ))}
                          {!obj && habits.length === 0 ? <Text style={[Type.meta, { paddingHorizontal: 4, paddingBottom: 10 }]}>Nothing due today.</Text> : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </Animated.View>
            </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* US-070: pillar picker for a free session (works on web, iOS and Android). */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: hexToRgba(Surface.ink, 0.45) }}
            onPress={() => setPickerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close pillar picker"
          />
          <View style={{ backgroundColor: Surface.canvas, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 34 }}>
            <Text style={[Type.heading, { fontSize: 20, lineHeight: 26 }]}>Give time to which pillar?</Text>
            <Text style={[Type.meta, { marginTop: 4, marginBottom: 14, fontSize: 14 }]}>A free session counts for the pillar you pick.</Text>
            <View style={{ gap: 8 }}>
              {pillars.map((p) => {
                const tone = getGoalColor(p);
                return (
                  <PressableScale
                    key={p.id}
                    onPress={() => {
                      setPickerOpen(false);
                      router.push(`/(tabs)/focus?goalId=${encodeURIComponent(p.id)}`);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Free session for ${p.name}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 56, paddingHorizontal: 12, borderRadius: Radius.md, backgroundColor: Surface.surfaceRaised }}
                  >
                    <PillarIcon icon={p.icon} name={p.name} color={tone} size={36} />
                    <Text numberOfLines={1} style={[Type.heading, { flex: 1, fontSize: 17 }]}>
                      {p.name}
                    </Text>
                    <Play size={14} color={Surface.muted} fill={Surface.muted} strokeWidth={2} />
                  </PressableScale>
                );
              })}
            </View>
            <PressableScale
              onPress={() => setPickerOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel free session"
              style={{ marginTop: 12, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Surface.muted }}>Cancel</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>

      {/* Long-press options for a habit */}
      <Modal visible={!!optionsFor} transparent animationType="fade" onRequestClose={() => setOptionsFor(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: hexToRgba(Surface.ink, 0.45) }}
            onPress={() => setOptionsFor(null)}
            accessibilityRole="button"
            accessibilityLabel="Close habit options"
          />
          {optionsFor ? (
            <View style={{ backgroundColor: Surface.canvas, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 34, gap: 8 }}>
              <Text numberOfLines={1} style={[Type.heading, { fontSize: 20, lineHeight: 26, marginBottom: 6 }]}>
                {optionsFor.name}
              </Text>
              {!isHabitDone(optionsFor) && !skippedIds.has(optionsFor.id) ? (
                <PressableScale
                  onPress={() => void onSkipHabit(optionsFor)}
                  accessibilityRole="button"
                  accessibilityLabel={`Skip ${optionsFor.name} today`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 14, borderRadius: Radius.md, backgroundColor: Surface.surfaceRaised }}
                >
                  <Moon size={20} color={Surface.ink} strokeWidth={2} />
                  <View style={{ flex: 1 }}>
                    <Text style={[Type.heading, { fontSize: 16 }]}>Skip today</Text>
                    <Text style={[Type.meta, { fontSize: 13 }]}>A rest day. Once a week it keeps your streak.</Text>
                  </View>
                </PressableScale>
              ) : null}
              <PressableScale
                onPress={() => {
                  const a = optionsFor;
                  setOptionsFor(null);
                  void confirmDeactivateAction(a);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Hide ${optionsFor.name}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 14, borderRadius: Radius.md, backgroundColor: Surface.surfaceRaised }}
              >
                <EyeOff size={20} color={Surface.ink} strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <Text style={[Type.heading, { fontSize: 16 }]}>Hide this habit</Text>
                  <Text style={[Type.meta, { fontSize: 13 }]}>Paused until you restore it from Goals.</Text>
                </View>
              </PressableScale>
              <PressableScale
                onPress={() => setOptionsFor(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Surface.muted }}>Cancel</Text>
              </PressableScale>
            </View>
          ) : null}
        </View>
      </Modal>

      <WeekShareSheet
        visible={shareOpen}
        weekStart={reportWeek().weekStart}
        onClose={() => setShareOpen(false)}
        onSent={() => {
          setPartnerSent(true);
          setShareOpen(false);
        }}
      />
    </SafeAreaView>
  );
}
