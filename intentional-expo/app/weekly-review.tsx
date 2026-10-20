/**
 * US-036/072: Write (or edit) the current week's reflection.
 * Accessible from Insights and via notification deep-link.
 */
import { useState, useCallback, useEffect } from 'react';
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
import { progressOf, paceOf, type Pace } from '@/services/goalProgress';
import { hapticLight } from '@/utils/haptics';

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

type GoalAssessment = {
  objective: Objective;
  pillar: MetaGoal;
  hoursThisWeek: number;
  pace: Pace;
  onTrack: OnTrack | null;
};

function formatHM(hours: number): string {
  const mins = Math.round(Math.max(0, hours) * 60);
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function mondayLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T12:00:00Z');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function WeeklyReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const weekStart = api.currentWeekStart();

  const [fields, setFields] = useState({ went_well: '', improve: '', adjustments: '' });
  const [goalAssessments, setGoalAssessments] = useState<GoalAssessment[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const pillars = await api.getGoals();
      const assessments: GoalAssessment[] = [];
      const now = new Date();
      const start = new Date(weekStart + 'T12:00:00Z');
      start.setDate(start.getDate() - 6);

      for (const pillar of pillars) {
        const objectives = await api.getObjectives(pillar.id);
        const active = objectives.find((o) => o.status === 'active');
        if (!active) continue;

        const tasks = await api.getTasks(active.id);
        const weekMinutes = await api.getMinutesForObjective(active.id, {
          start: start.toISOString(),
          end: now.toISOString(),
        });
        const pace = paceOf(active, tasks, now);

        assessments.push({
          objective: active,
          pillar,
          hoursThisWeek: weekMinutes / 60,
          pace,
          onTrack: null,
        });
      }

      if (mounted) setGoalAssessments(assessments);
    })();
    return () => {
      mounted = false;
    };
  }, [weekStart]);

  useFocusEffect(
    useCallback(() => {
      setSaved(false);
      const existing = api.getWeeklyReviewForWeek(weekStart);
      if (existing) {
        setFields({ went_well: existing.went_well, improve: existing.improve, adjustments: existing.adjustments });
        // Load goal assessments from saved data
        if (existing.goals_data) {
          try {
            const savedGoals = JSON.parse(existing.goals_data) as Array<{ objective_id: string; on_track: OnTrack; hours: number }>;
            setGoalAssessments((prev) =>
              prev.map((g) => {
                const saved = savedGoals.find((s) => s.objective_id === g.objective.id);
                return saved ? { ...g, onTrack: saved.on_track } : g;
              })
            );
          } catch (e) {
            // Ignore parse errors
          }
        }
      } else {
        setFields({ went_well: '', improve: '', adjustments: '' });
      }
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
    const goalsData = goalAssessments
      .filter((g) => g.onTrack)
      .map((g) => ({
        objective_id: g.objective.id,
        on_track: g.onTrack,
        hours: g.hoursThisWeek,
      }));
    api.saveWeeklyReview({
      week_start: weekStart,
      ...trimmed,
      goals_data: goalsData.length > 0 ? JSON.stringify(goalsData) : null,
    });
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
                  const paceColor = g.pace === 'ahead' ? Accent.green : g.pace === 'behind' ? Accent.orange : Surface.muted;
                  const paceLabel = g.pace === 'ahead' ? 'ahead' : g.pace === 'on_track' ? 'on track' : g.pace === 'behind' ? 'behind' : 'unknown';
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
                            <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: Surface.faint }} />
                            <Text style={{ color: paceColor, fontFamily: FontFamily.bodyBold, fontSize: 13 }}>
                              {paceLabel}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {(['yes', 'behind', 'rethink'] as const).map((status) => (
                          <Pressable
                            key={status}
                            onPress={() => {
                              hapticLight();
                              setSaved(false);
                              setGoalAssessments((prev) =>
                                prev.map((item) =>
                                  item.objective.id === g.objective.id ? { ...item, onTrack: status } : item
                                )
                              );
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Mark as ${status}`}
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
                              {status === 'yes' ? 'On track' : status === 'behind' ? 'Behind' : 'Rethink'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={{ marginTop: 16, paddingHorizontal: 4 }}>
                <Pressable
                  onPress={() => {
                    // Navigate to task planning view (simplified - just go to today to add tasks)
                    router.push('/(tabs)/today');
                  }}
                  accessibilityRole="button"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <Ionicons name="add-circle-outline" size={20} color={Accent.blue} />
                  <Text style={{ color: Accent.blue, fontFamily: FontFamily.bodyBold, fontSize: 16 }}>
                    Plan tasks for next week
                  </Text>
                </Pressable>
                <Text style={{ ...Type.meta, marginTop: 6, marginLeft: 28 }}>
                  Add tasks to your goals and schedule them for next week
                </Text>
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
