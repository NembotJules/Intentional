import { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { useInsightsData } from '@/db/hooks';
import { Colors } from '@/constants/design';
import { PrimaryButton } from '@/components/PrimaryButton';
import { shadows } from '@/styles/shadows';
import { getGoalColor, getGoalTint } from '@/utils/goalColors';

type Range = 'week' | 'month' | 'all';

export default function InsightsScreen() {
  const router = useRouter();
  const [range, setRange] = useState<Range>('week');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const { goalHours, totalHours, hasData, streaks } = useInsightsData(range, refreshSignal);

  useFocusEffect(
    useCallback(() => {
      setRefreshSignal((v) => v + 1);
    }, [])
  );
  const sortedGoalHours = useMemo(() => [...goalHours].sort((a, b) => b.hours - a.hours), [goalHours]);
  const maxHours = Math.max(1, ...sortedGoalHours.map((x) => x.hours));
  const periodDays = range === 'week' ? 7 : range === 'month' ? 30 : 90;
  const dailyAverage = totalHours / periodDays;
  const bestGoal = sortedGoalHours[0];
  const radarData = sortedGoalHours.slice(0, 4);

  const radarPoints = useMemo(() => {
    const center = 120;
    const radius = 90;
    const count = Math.max(1, radarData.length);
    return radarData.map(({ hours }, i) => {
      const ratio = Math.max(0.15, Math.min(1, hours / maxHours));
      const angle = (-Math.PI / 2) + (i * (Math.PI * 2)) / count;
      return {
        x: center + Math.cos(angle) * radius * ratio,
        y: center + Math.sin(angle) * radius * ratio,
      };
    });
  }, [radarData, maxHours]);

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 34 }}>
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-title2 font-bold text-text-primary">Insights</Text>
          <View className="w-[130px] h-7 bg-bg-tertiary rounded-md p-1 flex-row">
            {(['week', 'month', 'all'] as const).map((r) => {
              const active = range === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRange(r)}
                  className={`flex-1 justify-center items-center rounded-sm ${active ? 'bg-bg-primary border border-separator' : ''}`}
                  style={active ? shadows.card : undefined}
                >
                  <Text className={`text-[7px] uppercase tracking-[1.6px] ${active ? 'text-text-primary font-semibold' : 'text-text-tertiary'}`}>
                    {r}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {!hasData ? (
          <View className="items-center py-20">
            <View className="w-20 h-20 rounded-2xl bg-bg-secondary items-center justify-center mb-5">
              <View className="flex-row items-end gap-1.5">
                <View className="w-2.5 h-4 rounded-sm bg-goal-physique" />
                <View className="w-2.5 h-7 rounded-sm bg-goal-finances" />
                <View className="w-2.5 h-5 rounded-sm bg-goal-skills" />
                <View className="w-2.5 h-9 rounded-sm bg-goal-mind" />
              </View>
            </View>
            <Text className="text-title2 font-semibold text-text-primary mb-2">Your progress story</Text>
            <Text className="text-body text-text-secondary text-center max-w-[280px] mb-6">
              Complete your first session and watch your week take shape.
            </Text>
            <PrimaryButton title="Start a Session" onPress={() => router.push('/(tabs)/focus')} fullWidth={false} />
          </View>
        ) : (
          <>
            <View className="mb-6 bg-bg-secondary rounded-xl p-5" style={shadows.card}>
              <Text className="text-footnote uppercase tracking-wider text-text-tertiary mb-1">Total Focus Time</Text>
              <Text className="text-largeTitle font-bold text-text-primary">{totalHours.toFixed(1)}h</Text>
              <View className="mt-3 self-start px-3 py-1 rounded-full bg-bg-tertiary">
                <Text className="text-caption text-text-primary font-semibold">Keep it up</Text>
              </View>
            </View>

            <Text className="text-footnote uppercase tracking-wider text-text-tertiary mb-3">Time Per Goal</Text>
            <View className="bg-bg-secondary rounded-xl p-4 mb-6" style={shadows.card}>
              <View className="flex-row items-end justify-between gap-3">
                {sortedGoalHours.map(({ goal, hours }) => {
                  const height = Math.max(8, (hours / maxHours) * 120);
                  const tone = getGoalColor(goal.id);
                  const tint = getGoalTint(goal.id);
                  return (
                    <View key={goal.id} className="flex-1 items-center">
                      <Text className="text-footnote font-semibold mb-1" style={{ color: tone }}>
                        {hours.toFixed(1)}h
                      </Text>
                      <View className="h-[120px] w-full rounded-full justify-end overflow-hidden" style={{ backgroundColor: tint }}>
                        <View className="w-full rounded-full" style={{ height, backgroundColor: tone }} />
                      </View>
                      <Text className="text-caption text-text-secondary mt-2">{goal.name.slice(0, 8)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <Text className="text-footnote uppercase tracking-wider text-text-tertiary mb-3">Goal Balance</Text>
            <View className="bg-bg-secondary rounded-xl p-4 mb-6 border border-separator" style={shadows.card}>
              <View className="items-center justify-center">
                <Svg width={240} height={240}>
                  <Circle cx={120} cy={120} r={90} stroke={Colors.separator} strokeWidth={1} fill="none" />
                  <Circle cx={120} cy={120} r={60} stroke={Colors.separator} strokeWidth={1} fill="none" />
                  <Circle cx={120} cy={120} r={30} stroke={Colors.separator} strokeWidth={1} fill="none" />

                  {radarData.map((_, i) => {
                    const angle = (-Math.PI / 2) + (i * (Math.PI * 2)) / Math.max(1, radarData.length);
                    const x = 120 + Math.cos(angle) * 90;
                    const y = 120 + Math.sin(angle) * 90;
                    return <Line key={`axis-${i}`} x1={120} y1={120} x2={x} y2={y} stroke={Colors.separator} strokeWidth={1} />;
                  })}

                  <Polygon
                    points={radarPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="rgba(232,228,220,0.15)"
                    stroke={Colors.accentBlue}
                    strokeWidth={1.5}
                  />

                  {radarPoints.map((p, idx) => (
                    <Circle key={`pt-${idx}`} cx={p.x} cy={p.y} r={3} fill={getGoalColor(radarData[idx].goal.id)} />
                  ))}
                </Svg>
              </View>

              <View className="flex-row justify-between mt-3">
                {radarData.map(({ goal }) => (
                  <Text key={`lbl-${goal.id}`} className="text-caption text-text-secondary">
                    {goal.icon} {goal.name.slice(0, 7)}
                  </Text>
                ))}
              </View>
            </View>

            <View className="flex-row gap-2 mb-6">
              <View className="flex-1 bg-bg-secondary rounded-xl p-4" style={shadows.card}>
                <Text className="text-title2 font-semibold text-text-primary">{totalHours.toFixed(1)}h</Text>
                <Text className="text-caption uppercase tracking-wider text-text-tertiary mt-1">Total Hours</Text>
              </View>
              <View className="flex-1 bg-bg-secondary rounded-xl p-4" style={shadows.card}>
                <Text className="text-title2 font-semibold text-text-primary">{dailyAverage.toFixed(1)}h</Text>
                <Text className="text-caption uppercase tracking-wider text-text-tertiary mt-1">Daily Avg</Text>
              </View>
              <View className="flex-1 bg-bg-secondary rounded-xl p-4" style={shadows.card}>
                <Text className="text-title2 font-semibold text-text-primary">{bestGoal ? bestGoal.goal.name.slice(0, 4) : '--'}</Text>
                <Text className="text-caption uppercase tracking-wider text-text-tertiary mt-1">Best Goal</Text>
              </View>
            </View>

            <Text className="text-footnote uppercase tracking-wider text-text-tertiary mb-3">Streaks</Text>
            {streaks.slice(0, 5).map(({ action, goal, current, best }, idx) => (
              <View
                key={`${action.id}-${idx}`}
                className="bg-bg-secondary rounded-lg px-4 h-16 mb-2 flex-row items-center border-l-2 border-text-primary"
                style={shadows.card}
              >
                <Ionicons name="flame" size={20} color={Colors.textPrimary} />
                <View className="ml-3 flex-1">
                  <Text className="text-subheadline font-semibold text-text-primary">
                    {current > 0 ? `${current} day streak` : 'No streak yet'}
                  </Text>
                  <Text className="text-footnote text-text-secondary">{action.name}</Text>
                </View>
                <Text className="text-caption text-text-tertiary">Best: {best}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
