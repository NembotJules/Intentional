import { useMemo, useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { GoalChip } from '@/components/GoalChip';
import { Colors } from '@/constants/design';
import { ONBOARDING_DRAFT_STORAGE_KEY } from '@/constants/onboardingDraft';
import { setSetting } from '@/db';
import * as api from '@/db/api';
import type { ActionType } from '@/types';
import { shadows } from '@/styles/shadows';
import { GrainOverlay, ScanlineOverlay } from '@/components/BrutalistOverlay';

type PendingGoal = { name: string; color: string; icon: string; why: string };

const PRESETS = [
  { name: 'Physique', color: Colors.goalPhysique, icon: '🏃' },
  { name: 'Finances', color: Colors.goalFinances, icon: '💰' },
  { name: 'Skills', color: Colors.goalSkills, icon: '📚' },
  { name: 'Mind', color: Colors.goalMind, icon: '🧠' },
];

const DURATIONS = [25, 45, 60, 90, 120];
const TOTAL_STEPS = 4;
type OnboardingDraftV1 = {
  v: 1;
  step: number;
  goals: PendingGoal[];
  actionName: string;
  actionType: ActionType;
  actionMins: number;
  why: string;
};

function StepDots({ step }: { step: number }) {
  return (
    <View className="flex-row items-center justify-center gap-[5px] mb-6">
      {new Array(TOTAL_STEPS).fill(0).map((_, idx) => (
        <View
          key={idx}
          className="h-[3px] w-4 rounded-full"
          style={{
            backgroundColor: idx === step ? Colors.textPrimary : idx < step ? '#333333' : '#1E1E1E',
          }}
        />
      ))}
    </View>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<PendingGoal[]>([{ name: '', color: Colors.goalPhysique, icon: '⭐', why: '' }]);
  const [actionName, setActionName] = useState('');
  const [actionType, setActionType] = useState<ActionType>('session');
  const [actionMins, setActionMins] = useState(45);
  const [why, setWhy] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [hasExistingGoals, setHasExistingGoals] = useState(false);

  /** US-053: detect replay (user already has data — finish must not duplicate goals) */
  useEffect(() => {
    void api.getGoals().then((g) => setHasExistingGoals(g.length > 0));
  }, []);

  /** US-051: restore draft on cold start */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as Partial<OnboardingDraftV1>;
          if (parsed.v === 1) {
            if (typeof parsed.step === 'number' && parsed.step >= 1 && parsed.step <= 3) setStep(parsed.step);
            if (Array.isArray(parsed.goals) && parsed.goals.length > 0) {
              const next = parsed.goals.map((g) => ({
                name: typeof g.name === 'string' ? g.name.slice(0, 30) : '',
                color: typeof g.color === 'string' ? g.color : Colors.goalPhysique,
                icon: typeof g.icon === 'string' ? g.icon.slice(-2) || '⭐' : '⭐',
                why: typeof g.why === 'string' ? g.why.slice(0, 140) : '',
              }));
              setGoals(next);
            }
            if (typeof parsed.actionName === 'string') setActionName(parsed.actionName.slice(0, 80));
            if (parsed.actionType === 'habit' || parsed.actionType === 'session') setActionType(parsed.actionType);
            if (typeof parsed.actionMins === 'number' && parsed.actionMins > 0) setActionMins(parsed.actionMins);
            if (typeof parsed.why === 'string') setWhy(parsed.why.slice(0, 140));
          }
        }
      } catch {
        /* ignore corrupt draft */
      } finally {
        if (!cancelled) setDraftReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** US-051: persist after each meaningful change (avoid overwriting draft before restore pass; step 0 has nothing to save) */
  useEffect(() => {
    if (!draftReady || step === 0) return;
    const payload: OnboardingDraftV1 = {
      v: 1,
      step,
      goals,
      actionName,
      actionType,
      actionMins,
      why,
    };
    const t = setTimeout(() => {
      void AsyncStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify(payload));
    }, 350);
    return () => clearTimeout(t);
  }, [draftReady, step, goals, actionName, actionType, actionMins, why]);

  const firstGoal = goals[0] ?? { name: '', color: Colors.goalPhysique, icon: '⭐', why: '' };
  const canContinueStep1 = goals.some((g) => g.name.trim().length > 0);
  const canContinueStep2 = actionName.trim().length > 0;
  const cleanGoals = useMemo(() => goals.filter((g) => g.name.trim().length > 0), [goals]);

  const finish = async () => {
    /** US-053: replay with existing profile — only flip flag; do not insert duplicate goals/actions */
    const existingGoals = await api.getGoals();
    if (existingGoals.length > 0) {
      await setSetting('hasCompletedOnboarding', '1');
      await AsyncStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
      router.replace('/(tabs)/today');
      return;
    }

    const primary = cleanGoals[0] ?? firstGoal;
    const goal = await api.addGoal({
      name: primary.name.trim() || 'My Goal',
      color: primary.color,
      icon: primary.icon,
      sort_order: 0,
      why_statement: why.slice(0, 140),
    });

    await api.addAction({
      goal_id: goal.id,
      name: actionName.trim() || 'Daily focus',
      type: actionType,
      target_minutes: actionType === 'session' ? actionMins : 60,
      reminder_time: null,
      is_active: 1,
      sort_order: 0,
    });

    for (let i = 1; i < cleanGoals.length; i++) {
      await api.addGoal({
        name: cleanGoals[i].name.trim(),
        color: cleanGoals[i].color,
        icon: cleanGoals[i].icon,
        sort_order: i,
        why_statement: cleanGoals[i].why.slice(0, 140),
      });
    }

    await setSetting('hasCompletedOnboarding', '1');
    await AsyncStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
    router.replace('/(tabs)/today');
  };

  if (step === 0) {
    return (
      <View className="flex-1 bg-[#080808] px-8 justify-center items-center">
        <Stack.Screen options={{ headerShown: false }} />
        <GrainOverlay />
        <ScanlineOverlay />
        <Text className="text-[54px] font-bold tracking-tight text-text-primary lowercase mb-3" style={{ zIndex: 1 }}>intentional</Text>
        <Text className="text-title3 text-text-secondary text-center mb-12 max-w-[280px]" style={{ zIndex: 1 }}>
          Build your life intentionally.
        </Text>
        <View className="mb-6 px-4 py-2 rounded-full bg-[#0E0E0E] border border-[#1A1A1A]" style={{ zIndex: 1 }}>
          <Text className="text-caption uppercase tracking-wider text-text-tertiary">Step 1 of 4</Text>
        </View>
        {hasExistingGoals ? (
          <Text className="text-caption text-text-secondary text-center mb-6 max-w-[300px] leading-5" style={{ zIndex: 1 }}>
            You already have goals in the app. Walk through as a refresher — finishing won&apos;t duplicate them.
          </Text>
        ) : null}
        <View style={{ zIndex: 1, width: '100%' }}>
          <PrimaryButton title="Begin" onPress={() => setStep(1)} />
        </View>
      </View>
    );
  }

  if (step === 1) {
    return (
      <KeyboardAvoidingView className="flex-1 bg-bg-primary" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Stack.Screen options={{ title: 'Life Pillars', headerShadowVisible: false }} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 }}>
          <StepDots step={1} />
          <Text className="text-[7px] uppercase tracking-[2.5px] text-text-ghost mb-2">▶ 02 · Meta Goal</Text>
          <Text className="text-title1 font-bold text-text-primary mb-2">Name your first pillar.</Text>
          <Text className="text-[10px] text-text-tertiary mb-6">This becomes your first visible track in Today.</Text>

          {goals.map((g, i) => (
            <View key={i} className="bg-bg-secondary rounded-lg p-[10px] mb-2 flex-row items-center border border-separator">
              <View className="w-8 h-8 rounded-full mr-3" style={{ backgroundColor: g.color }} />
              <TextInput
                className="w-10 h-9 rounded-md bg-bg-primary border border-separator text-center text-[16px] text-text-primary mr-2"
                value={g.icon}
                onChangeText={(t) =>
                  setGoals((prev) => prev.map((p, j) => (j === i ? { ...p, icon: t.slice(-2) || '⭐' } : p)))
                }
                maxLength={2}
              />
              <TextInput
                className="flex-1 h-9 px-3 rounded-md bg-bg-primary text-[14px] text-text-primary border border-separator"
                placeholder="Goal name"
                placeholderTextColor={Colors.textTertiary}
                value={g.name}
                onChangeText={(t) =>
                  setGoals((prev) => prev.map((p, j) => (j === i ? { ...p, name: t.slice(0, 30) } : p)))
                }
                maxLength={30}
              />
              {i > 0 && (
                <Pressable
                  onPress={() => setGoals((prev) => prev.filter((_, idx) => idx !== i))}
                className="w-7 h-7 ml-2 rounded-md items-center justify-center bg-bg-primary border border-separator"
                >
                  <Ionicons name="remove" size={16} color={Colors.textSecondary} />
                </Pressable>
              )}
            </View>
          ))}

          <View className="flex-row flex-wrap gap-2 mb-4">
            {PRESETS.map((preset) => (
              <Pressable
                key={preset.name}
                onPress={() =>
                  setGoals((prev) => {
                    const idx = prev.findIndex((g) => !g.name.trim());
                    if (idx === -1) return prev;
                    return prev.map((g, i) => (i === idx ? { ...g, ...preset } : g));
                  })
                }
                className="px-2.5 py-1 rounded-md bg-bg-secondary border border-separator"
              >
                <Text className="text-[7px] uppercase tracking-[1.6px] text-text-secondary">{preset.name}</Text>
              </Pressable>
            ))}
          </View>

          {goals.length < 4 && (
            <Pressable
              onPress={() =>
                setGoals((prev) => [
                  ...prev,
                  { name: '', color: PRESETS[prev.length % 4].color, icon: PRESETS[prev.length % 4].icon, why: '' },
                ])
              }
              className="h-11 rounded-lg border border-dashed border-separator items-center justify-center flex-row gap-2 mb-8"
            >
              <Ionicons name="add" size={18} color={Colors.accentBlue} />
              <Text className="text-[8px] uppercase tracking-[2px] text-accent-blue">Add Goal</Text>
            </Pressable>
          )}

          <PrimaryButton title="Continue" onPress={() => setStep(2)} disabled={!canContinueStep1} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (step === 2) {
    return (
      <KeyboardAvoidingView className="flex-1 bg-bg-primary" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Stack.Screen options={{ title: 'Daily Action', headerShadowVisible: false }} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 }}>
          <StepDots step={2} />
          <View className="mb-5 items-center">
            <GoalChip name={firstGoal.name || 'First Goal'} color={firstGoal.color} icon={firstGoal.icon} useTint />
          </View>

          <Text className="text-[7px] uppercase tracking-[2.5px] text-text-ghost mb-2 text-center">▶ 03 · Daily Action</Text>
          <Text className="text-title1 font-bold text-text-primary mb-2 text-center">What will you do for it?</Text>
          <Text className="text-[10px] text-text-tertiary mb-5 text-center">Choose one repeatable action.</Text>

          <TextInput
            className="h-11 px-4 rounded-lg bg-bg-secondary text-[14px] text-text-primary border border-separator mb-5"
            placeholder="e.g. Learn ML"
            placeholderTextColor={Colors.textTertiary}
            value={actionName}
            onChangeText={setActionName}
          />

          <Text className="text-[7px] uppercase tracking-[2px] text-text-ghost mb-2">Type</Text>
          <View className="flex-row bg-bg-tertiary rounded-md p-1 mb-6">
            <Pressable
              className={`flex-1 h-8 rounded-sm items-center justify-center border ${actionType === 'habit' ? 'bg-bg-primary border-separator' : 'border-transparent'}`}
              style={actionType === 'habit' ? shadows.card : undefined}
              onPress={() => setActionType('habit')}
            >
              <Text className={`text-[8px] uppercase tracking-[2px] ${actionType === 'habit' ? 'text-text-primary' : 'text-text-secondary'}`}>
                Habit
              </Text>
            </Pressable>
            <Pressable
              className={`flex-1 h-8 rounded-sm items-center justify-center border ${actionType === 'session' ? 'bg-bg-primary border-separator' : 'border-transparent'}`}
              style={actionType === 'session' ? shadows.card : undefined}
              onPress={() => setActionType('session')}
            >
              <Text className={`text-[8px] uppercase tracking-[2px] ${actionType === 'session' ? 'text-text-primary' : 'text-text-secondary'}`}>
                Session
              </Text>
            </Pressable>
          </View>

          {actionType === 'session' && (
            <>
              <Text className="text-[7px] uppercase tracking-[2px] text-text-ghost mb-2">Target</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8">
                <View className="flex-row gap-2 pr-2">
                  {DURATIONS.map((m) => {
                    const selected = actionMins === m;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => setActionMins(m)}
                        className={`h-8 px-3 rounded-md items-center justify-center border ${selected ? 'bg-bg-primary border-accent-blue' : 'bg-bg-secondary border-separator'}`}
                      >
                        <Text className={`text-[8px] uppercase tracking-[1.8px] ${selected ? 'text-accent-blue' : 'text-text-secondary'}`}>
                          {m === 60 ? '1h' : `${m}m`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </>
          )}

          <PrimaryButton title="Continue" onPress={() => setStep(3)} disabled={!canContinueStep2} color={Colors.accentBlue} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg-primary" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Your Why', headerShadowVisible: false }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 }}>
        <StepDots step={3} />
        <Text className="text-[7px] uppercase tracking-[2.5px] text-text-ghost mb-2 text-center">▶ 04 · Your Why</Text>
        <Text className="text-title1 font-bold text-text-primary mb-2 text-center">Why does this matter to you?</Text>
        <Text className="text-[10px] text-text-secondary mb-8 text-center">
          Write one sentence. You&apos;ll see it on your lock screen.
        </Text>

        <View className="items-center mb-6">
          <TextInput
            className="w-full min-h-[190px] p-4 rounded-lg bg-bg-overlay text-text-primary border border-separator text-center"
            style={{ fontSize: 20, lineHeight: 25, fontWeight: '700' }}
            placeholder="To feel present..."
            placeholderTextColor={Colors.textTertiary}
            value={why}
            onChangeText={(t) => setWhy(t.slice(0, 140))}
            multiline
            maxLength={140}
            textAlignVertical="top"
          />
          <View className="mt-4 px-3 py-1 rounded-full bg-bg-secondary border border-separator">
            <Text className="text-caption text-text-tertiary uppercase tracking-wider">{why.length} / 140</Text>
          </View>
        </View>

        <Pressable onPress={finish} className="py-3 items-center">
          <Text className="text-footnote uppercase tracking-wider text-text-tertiary">Skip for now</Text>
        </Pressable>
        <PrimaryButton title="Start Intentional" onPress={finish} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
