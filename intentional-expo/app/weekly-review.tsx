/**
 * US-036/072: Write (or edit) the current week's reflection.
 * Accessible from Insights and via notification deep-link.
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import type { Objective, MetaGoal, Task } from '@/types';
import { Accent, FontFamily, Surface, Type } from '@/constants/design';
import { CTA } from '@/components/onboarding/parts';
import { Mascot } from '@/components/onboarding/Mascot';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { getGoalColor } from '@/utils/goalColors';
import { paceOf, type Pace } from '@/services/goalProgress';
import { localDayStart, shiftDayKey } from '@/utils/dates';
import { PressableScale } from '@/components/ui/motion';

const PROMPTS = [
  {
    key: 'went_well' as const,
    label: 'What went well?',
    placeholder: 'Wins count, even small ones…',
  },
  {
    key: 'improve' as const,
    label: 'What would you improve?',
    placeholder: 'What would you do differently?',
  },
  {
    key: 'adjustments' as const,
    label: 'What will you change next week?',
    placeholder: 'A pillar to give more hours, something to drop…',
  },
];

type OnTrack = 'yes' | 'behind' | 'rethink';

/** One entry of weekly_reviews.goals_data (JSON). `title` is kept so history reads well after a rename. */
type SavedGoal = { objective_id: string; on_track: OnTrack; hours: number; title?: string };

type GoalAssessment = {
  objective: Objective;
  pillar: MetaGoal;
  hoursThisWeek: number;
  pace: Pace;
  onTrack: OnTrack | null;
  /** Open tasks already planned for a day of next week. */
  nextWeekTasks: Task[];
};

const MAX_PLANNED = 3;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatHM(hours: number): string {
  const mins = Math.round(Math.max(0, hours) * 60);
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function mondayLabel(weekStart: string): string {
  return localDayStart(weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseSavedGoals(json: string | null | undefined): SavedGoal[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as SavedGoal[]) : [];
  } catch {
    return [];
  }
}

/** Active goals with this calendar week's hours (Monday 00:00 → now) and saved answers applied. */
async function loadAssessments(weekStart: string, saved: SavedGoal[]): Promise<GoalAssessment[]> {
  const pillars = await api.getGoals();
  const now = new Date();
  const start = localDayStart(weekStart);
  const nextMon = shiftDayKey(weekStart, 7);
  const nextSun = shiftDayKey(weekStart, 13);
  const out: GoalAssessment[] = [];
  for (const pillar of pillars) {
    const active = await api.getActiveObjective(pillar.id);
    if (!active) continue;
    const tasks = await api.getTasks(active.id);
    const minutes = api.getMinutesForObjective(active.id, { start: start.toISOString(), end: now.toISOString() });
    out.push({
      objective: active,
      pillar,
      hoursThisWeek: minutes / 60,
      pace: paceOf(active, tasks, now),
      onTrack: saved.find((g) => g.objective_id === active.id)?.on_track ?? null,
      nextWeekTasks: tasks.filter((t) => !t.is_done && t.planned_date != null && t.planned_date >= nextMon && t.planned_date <= nextSun),
    });
  }
  return out;
}

const ON_TRACK_LABEL: Record<OnTrack, string> = { yes: 'On track', behind: 'Behind', rethink: 'Rethink' };

function PlanNextWeek({ g, weekStart, onAdded }: { g: GoalAssessment; weekStart: string; onAdded: (t: Task) => void }) {
  const days = DAY_NAMES.map((name, i) => {
    const key = shiftDayKey(weekStart, 7 + i);
    return { key, name, date: localDayStart(key).getDate() };
  });
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(days[0]!.key);
  const [error, setError] = useState<string | null>(null);
  const full = g.nextWeekTasks.length >= MAX_PLANNED;

  const add = async () => {
    const clean = title.trim();
    if (!clean) {
      setError('Give the task a name first.');
      return;
    }
    try {
      const task = await api.addTask({ objective_id: g.objective.id, title: clean.slice(0, 60), planned_date: day });
      setTitle('');
      setError(null);
      onAdded(task);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the task.');
    }
  };

  return (
    <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: Surface.rule }}>
      <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>Plan next week</Text>
      <Text style={{ ...Type.meta, marginTop: 2 }}>Up to {MAX_PLANNED} tasks, each on a day.</Text>
      {g.nextWeekTasks.map((t) => (
        <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Ionicons name="checkmark-circle" size={18} color={Accent.green} />
          <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodySemiBold, fontSize: 15, flex: 1 }} numberOfLines={1}>
            {t.title}
          </Text>
          <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 13 }}>
            {DAY_NAMES[(localDayStart(t.planned_date!).getDay() + 6) % 7]} {localDayStart(t.planned_date!).getDate()}
          </Text>
        </View>
      ))}
      {full ? null : (
        <>
          <TextInput
            value={title}
            onChangeText={(v) => {
              setTitle(v);
              if (error) setError(null);
            }}
            placeholder="A task for next week"
            placeholderTextColor={Surface.faint}
            accessibilityLabel={`New task for ${g.objective.title}`}
            maxLength={60}
            onSubmitEditing={add}
            style={{
              marginTop: 10,
              backgroundColor: Surface.surface,
              borderRadius: 12,
              paddingHorizontal: 14,
              height: 46,
              color: Surface.ink,
              fontFamily: FontFamily.body,
              fontSize: 16,
            }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {days.map((d) => {
              const on = d.key === day;
              return (
                <PressableScale
                  key={d.key}
                  onPress={() => setDay(d.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Plan on ${d.name} ${d.date}`}
                  accessibilityState={{ selected: on }}
                  style={{
                    width: 40,
                    height: 48,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? Surface.ink : Surface.surface,
                  }}
                >
                  <Text style={{ color: on ? Surface.surface : Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 11 }}>{d.name}</Text>
                  <Text style={{ color: on ? Surface.surface : Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>{d.date}</Text>
                </PressableScale>
              );
            })}
          </View>
          {error ? <Text style={{ ...Type.meta, color: Accent.amber, marginTop: 8 }}>{error}</Text> : null}
          <PressableScale
            onPress={add}
            accessibilityRole="button"
            accessibilityLabel={`Add task to ${g.objective.title}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: Accent.blueSoft }}
          >
            <Ionicons name="add" size={18} color={Accent.blue} />
            <Text style={{ color: Accent.blue, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>Add task</Text>
          </PressableScale>
        </>
      )}
    </View>
  );
}

export default function WeeklyReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const weekStart = api.currentWeekStart();

  const [fields, setFields] = useState({ went_well: '', improve: '', adjustments: '' });
  const [goalAssessments, setGoalAssessments] = useState<GoalAssessment[]>([]);
  /** goals_data as saved, so answers for goals no longer active are kept on re-save. */
  const [savedGoals, setSavedGoals] = useState<SavedGoal[]>([]);
  const [saved, setSaved] = useState(false);

  // Load the review and the goals together, so saved answers are applied to the list they belong to.
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setSaved(false);
      // Latest save of this week (the web store can hold an older row for the same week).
      const existing =
        api
          .getWeeklyReviews()
          .filter((r) => r.week_start === weekStart)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] ?? api.getWeeklyReviewForWeek(weekStart);
      const prior = parseSavedGoals(existing?.goals_data);
      setFields(
        existing
          ? { went_well: existing.went_well, improve: existing.improve, adjustments: existing.adjustments }
          : { went_well: '', improve: '', adjustments: '' }
      );
      setSavedGoals(prior);
      void loadAssessments(weekStart, prior).then((list) => {
        if (mounted) setGoalAssessments(list);
      });
      return () => {
        mounted = false;
      };
    }, [weekStart])
  );

  const handleSave = () => {
    const trimmed = {
      went_well: fields.went_well.trim(),
      improve: fields.improve.trim(),
      adjustments: fields.adjustments.trim(),
    };
    if (!trimmed.went_well && !trimmed.improve && !trimmed.adjustments && goalAssessments.every((g) => !g.onTrack)) {
      Alert.alert('Nothing to save', 'Fill in at least one field or assess a goal before saving.');
      return;
    }
    const shown = new Set(goalAssessments.map((g) => g.objective.id));
    const goalsData: SavedGoal[] = [
      ...goalAssessments
        .filter((g) => g.onTrack)
        .map((g) => ({ objective_id: g.objective.id, on_track: g.onTrack!, hours: g.hoursThisWeek, title: g.objective.title })),
      // Answers for goals that are no longer active stay in the record.
      ...savedGoals.filter((s) => !shown.has(s.objective_id)),
    ];
    api.saveWeeklyReview({
      week_start: weekStart,
      ...trimmed,
      goals_data: goalsData.length > 0 ? JSON.stringify(goalsData) : null,
    });
    setSavedGoals(goalsData);
    setSaved(true);
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/insights');
  };

  const bottomPad = insets.bottom + 24;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: bottomPad }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={22} color={Surface.ink} />
          </Pressable>

          <View style={{ alignItems: 'center', marginTop: 4 }}>
            <Mascot mood={saved ? 'proud' : 'think'} size={96} intensity={0.6} />
            <Text style={{ color: Accent.blue, fontFamily: FontFamily.bodySemiBold, fontSize: 15, marginTop: 10 }}>
              Week of {mondayLabel(weekStart)}
            </Text>
            <Text accessibilityRole="header" style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 28, lineHeight: 34, textAlign: 'center', marginTop: 4 }}>
              Where did your week go?
            </Text>
            <Text style={{ color: Surface.muted, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22, textAlign: 'center', marginTop: 6, marginBottom: 22 }}>
              Three quick questions. Short answers are fine.
            </Text>
          </View>

          {saved ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginBottom: 18, borderRadius: 16, backgroundColor: Accent.greenSoft }}>
              <Ionicons name="checkmark-circle" size={22} color={Accent.green} />
              <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodySemiBold, fontSize: 16, flex: 1 }}>Review saved. See you next Sunday.</Text>
            </View>
          ) : null}

          {PROMPTS.map((p, idx) => (
            <View key={p.key} style={{ marginBottom: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: Surface.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: Surface.surface, fontFamily: FontFamily.bodyBold, fontSize: 14 }}>{idx + 1}</Text>
                </View>
                <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 18, flex: 1 }}>{p.label}</Text>
              </View>
              <TextInput
                value={fields[p.key]}
                onChangeText={(v) => { setSaved(false); setFields((f) => ({ ...f, [p.key]: v })); }}
                placeholder={p.placeholder}
                placeholderTextColor={Surface.faint}
                accessibilityLabel={p.label}
                multiline
                textAlignVertical="top"
                style={{
                  backgroundColor: Surface.surfaceRaised,
                  borderRadius: 18,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  color: Surface.ink,
                  fontFamily: FontFamily.body,
                  fontSize: 17,
                  lineHeight: 24,
                  minHeight: 112,
                }}
              />
            </View>
          ))}

          {goalAssessments.length > 0 && (
            <View style={{ marginTop: 12, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: Surface.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: Surface.surface, fontFamily: FontFamily.bodyBold, fontSize: 14 }}>4</Text>
                </View>
                <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 18, flex: 1 }}>How are your goals?</Text>
              </View>
              <View style={{ gap: 14 }}>
                {goalAssessments.map((g) => {
                  const tone = getGoalColor(g.pillar);
                  const paceColor = g.pace === 'ahead' ? Accent.green : g.pace === 'behind' ? Accent.amber : Surface.muted;
                  const paceLabel = g.pace === 'ahead' ? 'ahead' : g.pace === 'on_track' ? 'on track' : g.pace === 'behind' ? 'behind' : null;
                  return (
                    <View key={g.objective.id} style={{ backgroundColor: Surface.surfaceRaised, borderRadius: 18, padding: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                        <PillarIcon icon={g.pillar.icon} name={g.pillar.name} color={tone} size={36} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 16, marginBottom: 4 }} numberOfLines={2}>
                            {g.objective.title}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 13 }}>
                              {formatHM(g.hoursThisWeek)} this week
                            </Text>
                            {paceLabel ? (
                              <>
                                <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: Surface.faint }} />
                                <Text style={{ color: paceColor, fontFamily: FontFamily.bodyBold, fontSize: 13 }}>{paceLabel}</Text>
                              </>
                            ) : null}
                          </View>
                        </View>
                      </View>
                      <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodyBold, fontSize: 13, marginBottom: 8 }}>On track?</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {(['yes', 'behind', 'rethink'] as const).map((status) => (
                          <PressableScale
                            key={status}
                            onPress={() => {
                              setSaved(false);
                              setGoalAssessments((prev) =>
                                prev.map((item) =>
                                  item.objective.id === g.objective.id ? { ...item, onTrack: status } : item
                                )
                              );
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`${ON_TRACK_LABEL[status]}: ${g.objective.title}`}
                            accessibilityState={{ selected: g.onTrack === status }}
                            style={{
                              flex: 1,
                              height: 44,
                              borderRadius: 12,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: g.onTrack === status ? Surface.ink : Surface.surface,
                            }}
                          >
                            <Text
                              style={{
                                color: g.onTrack === status ? Surface.surface : Surface.ink,
                                fontFamily: FontFamily.bodyBold,
                                fontSize: 14,
                              }}
                            >
                              {ON_TRACK_LABEL[status]}
                            </Text>
                          </PressableScale>
                        ))}
                      </View>
                      <PlanNextWeek
                        g={g}
                        weekStart={weekStart}
                        onAdded={(task) =>
                          setGoalAssessments((prev) =>
                            prev.map((item) => (item.objective.id === g.objective.id ? { ...item, nextWeekTasks: [...item.nextWeekTasks, task] } : item))
                          )
                        }
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <View style={{ marginTop: 6 }}>
            <CTA label={saved ? 'Saved' : 'Save review'} onPress={handleSave} />
          </View>

          <Pressable
            onPress={() => router.push('/reviews-history')}
            accessibilityRole="button"
            accessibilityLabel="View past reviews"
            style={{ height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}
          >
            <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 16 }}>View past reviews</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
