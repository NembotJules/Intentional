import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import type { DailyAction, MetaGoal } from '@/types';
import { Colors } from '@/constants/design';
import { GoalChip } from '@/components/GoalChip';
import { shadows } from '@/styles/shadows';
import { getGoalColor, getGoalTint } from '@/utils/goalColors';
import { PrimaryButton } from '@/components/PrimaryButton';

function formatLifetimeHours(seconds: number): string {
  const h = seconds / 3600;
  if (h < 0.05 && seconds > 0) return '<0.1h';
  return `${h.toFixed(1)}h`;
}

export default function GoalDetailScreen() {
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [goal, setGoal] = useState<MetaGoal | null>(null);
  const [actions, setActions] = useState<DailyAction[]>([]);
  const [lifetimeSec, setLifetimeSec] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    const g = await api.getGoalById(id);
    setGoal(g);
    if (!g) {
      setActions([]);
      return;
    }
    const acts = await api.getActionsByGoal(g.id, true);
    setActions(acts);
    setLifetimeSec(api.getTotalFocusSecondsForGoal(g.id));
    setBestStreak(api.getGoalBestStreakDays(g.id));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!id) {
    return (
      <SafeAreaView className="flex-1 bg-bg-primary items-center justify-center px-6">
        <Stack.Screen options={{ title: 'Goal', headerShown: true }} />
        <Text className="text-body text-text-secondary text-center">Missing goal.</Text>
      </SafeAreaView>
    );
  }

  if (!goal) {
    return (
      <SafeAreaView className="flex-1 bg-bg-primary items-center justify-center px-6">
        <Stack.Screen options={{ title: 'Goal', headerShown: true }} />
        <Text className="text-body text-text-secondary text-center">Goal not found or archived.</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-footnote text-accent-blue font-semibold">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const tone = getGoalColor(goal.id);
  const tint = getGoalTint(goal.id);

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: goal.name,
          headerShown: true,
          headerStyle: { backgroundColor: Colors.backgroundPrimary },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: { color: Colors.textPrimary, fontWeight: '700' },
          headerShadowVisible: false,
        }}
      />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}>
        <View className="items-center mb-6">
          <GoalChip name={goal.name} color={tone} icon={goal.icon} useTint />
        </View>

        <View className="flex-row gap-2 mb-6">
          <View className="flex-1 bg-bg-secondary rounded-xl p-4 border border-separator" style={shadows.card}>
            <Text className="text-title2 font-bold text-text-primary">{formatLifetimeHours(lifetimeSec)}</Text>
            <Text className="text-caption text-text-tertiary uppercase tracking-wider mt-1">Lifetime focus</Text>
          </View>
          <View className="flex-1 bg-bg-secondary rounded-xl p-4 border border-separator" style={shadows.card}>
            <Text className="text-title2 font-bold text-text-primary">{bestStreak}</Text>
            <Text className="text-caption text-text-tertiary uppercase tracking-wider mt-1">Best streak (days)</Text>
          </View>
        </View>

        <Text className="text-footnote text-text-tertiary uppercase tracking-wider mb-2">Why</Text>
        <View className="bg-bg-secondary rounded-xl p-4 mb-6 border border-separator" style={shadows.card}>
          <Text className="text-body text-text-primary leading-6">
            {goal.why_statement?.trim() ? goal.why_statement : 'No why statement yet — edit this goal to add one.'}
          </Text>
        </View>

        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-footnote text-text-tertiary uppercase tracking-wider">Actions</Text>
          <Text className="text-caption text-text-secondary">{actions.filter((a) => a.is_active).length} active</Text>
        </View>
        {actions.length === 0 ? (
          <Text className="text-footnote text-text-secondary mb-6">No actions yet.</Text>
        ) : (
          actions.map((a) => (
            <View
              key={a.id}
              className="bg-bg-secondary rounded-lg p-3 mb-2 flex-row items-center border-l-[3px]"
              style={[shadows.card, { borderLeftColor: tone, opacity: a.is_active ? 1 : 0.55 }]}
            >
              <View className="flex-1">
                <Text className="text-headline font-semibold text-text-primary">{a.name}</Text>
                <Text className="text-footnote text-text-secondary mt-0.5">
                  {a.type === 'session' ? `Session · ${a.target_minutes}m target` : 'Habit'}
                  {!a.is_active ? ' · Paused' : ''}
                </Text>
              </View>
            </View>
          ))
        )}

        <Pressable
          onPress={() => router.push(`/session-history?goalId=${encodeURIComponent(goal.id)}`)}
          className="flex-row items-center justify-between py-3 px-4 mb-4 bg-bg-secondary rounded-xl border border-separator"
          style={shadows.card}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
            <Text className="text-subheadline font-semibold text-text-primary">Session history</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </Pressable>

        <PrimaryButton
          title="Edit goal & actions"
          variant="ghost"
          color={tone}
          onPress={() => router.replace(`/(tabs)/goals?editGoal=${encodeURIComponent(goal.id)}`)}
        />

        <View className="mt-4 py-3 rounded-xl items-center border border-dashed border-separator opacity-40" style={{ backgroundColor: tint }}>
          <Text className="text-caption text-text-tertiary uppercase tracking-wider">Set as Wallpaper · v1.1</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
