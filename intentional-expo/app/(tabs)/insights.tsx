import { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { usePremium } from '@/hooks/usePremium';
import { PaywallSheet } from '@/components/PaywallSheet';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { useInsightsData } from '@/db/hooks';
import { Colors } from '@/constants/design';
import { PrimaryButton } from '@/components/PrimaryButton';
import { shadows } from '@/styles/shadows';
import { getGoalColor, getGoalTint } from '@/utils/goalColors';

type Range = 'week' | 'month' | 'all';

const RANGE_LABELS: Record<Range, string> = { week: 'WK', month: 'MO', all: 'ALL' };

/** Match `(tabs)/_layout.tsx` floating tab bar so content isn’t hidden */
function tabBarOverlapPadding(insetsBottom: number) {
  const tabBarCore = 56;
  const tabBarExtra = 8;
  const gapAboveBar = 10;
  return tabBarCore + Math.max(insetsBottom, 6) + tabBarExtra + gapAboveBar;
}

export default function InsightsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<Range>('week');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const { goalHours, totalHours, dailyAverage, streaks, showInsightsEmpty } = useInsightsData(range, refreshSignal);
  const { requirePremium, paywallVisible, setPaywallVisible, refresh: refreshPremium } = usePremium();

  useFocusEffect(
    useCallback(() => {
      setRefreshSignal((v) => v + 1);
    }, [])
  );

  /** US-031: max goal = 100% bar width; US-010: preserve goal list order */
  const maxHours = useMemo(() => Math.max(1e-6, ...goalHours.map((x) => x.hours)), [goalHours]);

  const topGoalEntry = useMemo(() => {
    if (!goalHours.length) return null;
    return goalHours.reduce((best, cur) => (cur.hours > best.hours ? cur : best), goalHours[0]);
  }, [goalHours]);

  const radarData = goalHours;

  const radarGeometry = useMemo(() => {
    const center = 120;
    const radius = 90;
    const count = radarData.length;
    if (count === 0) return { outer: [] as { x: number; y: number }[], count: 0 };
    return {
      outer: radarData.map(({ hours }, i) => {
        const ratio = Math.max(0.12, Math.min(1, hours / maxHours));
        const angle = -Math.PI / 2 + (i * (Math.PI * 2)) / count;
        return {
          x: center + Math.cos(angle) * radius * ratio,
          y: center + Math.sin(angle) * radius * ratio,
        };
      }),
      count,
    };
  }, [radarData, maxHours]);

  const bottomPad = tabBarOverlapPadding(insets.bottom) + 16;

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: bottomPad }}
      >
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-title2 font-bold text-text-primary">Insights</Text>
          <View className="w-[132px] h-8 rounded-lg p-1 flex-row" style={{ backgroundColor: '#2a2a2a' }}>
            {(['week', 'month', 'all'] as const).map((r) => {
              const active = range === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRange(r)}
                  className={`flex-1 justify-center items-center rounded-md ${active ? 'bg-bg-primary' : ''}`}
                  style={active ? shadows.card : undefined}
                >
                  <Text
                    className={`text-[9px] font-bold tracking-wider ${active ? 'text-text-primary' : 'text-text-tertiary'}`}
                  >
                    {RANGE_LABELS[r]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="gap-2 mb-5">
          <Pressable
            onPress={() => requirePremium(() => router.push('/session-history'))}
            className="flex-row items-center justify-between py-3 px-4 rounded-xl"
            style={[shadows.card, { backgroundColor: '#1f1f1f' }]}
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
              <Text className="text-subheadline font-semibold text-text-primary">Session history</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </Pressable>

          <Pressable
            onPress={() => requirePremium(() => router.push('/weekly-review'))}
            className="flex-row items-center justify-between py-3 px-4 rounded-xl"
            style={[shadows.card, { backgroundColor: '#1f1f1f' }]}
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="journal-outline" size={20} color={Colors.textSecondary} />
              <Text className="text-subheadline font-semibold text-text-primary">Weekly review</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </Pressable>
        </View>

        {showInsightsEmpty ? (
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
            {/* US-034: summary above bar chart */}
            <View className="flex-row gap-2 mb-6">
              <View className="flex-1 rounded-xl p-4 min-h-[88px]" style={[shadows.card, { backgroundColor: '#1f1f1f' }]}>
                <Text className="text-title2 font-semibold text-text-primary">{totalHours.toFixed(1)}h</Text>
                <Text className="text-caption uppercase tracking-wider text-text-tertiary mt-1">Total hrs</Text>
              </View>
              <View className="flex-1 rounded-xl p-4 min-h-[88px]" style={[shadows.card, { backgroundColor: '#1f1f1f' }]}>
                <Text className="text-title2 font-semibold text-text-primary">{dailyAverage.toFixed(1)}h</Text>
                <Text className="text-caption uppercase tracking-wider text-text-tertiary mt-1">Daily avg</Text>
              </View>
              <View className="flex-1 rounded-xl p-4 min-h-[88px]" style={[shadows.card, { backgroundColor: '#1f1f1f' }]}>
                <Text
                  className="text-title2 font-semibold"
                  style={{ color: topGoalEntry ? getGoalColor(topGoalEntry.goal.id) : Colors.textPrimary }}
                  numberOfLines={1}
                >
                  {topGoalEntry ? `${topGoalEntry.hours.toFixed(1)}h` : '—'}
                </Text>
                <Text className="text-caption uppercase tracking-wider text-text-tertiary mt-1">Top goal</Text>
                {topGoalEntry ? (
                  <Text className="text-footnote text-text-secondary mt-1" numberOfLines={1}>
                    {topGoalEntry.goal.name}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* US-031: horizontal bars, width ∝ hours, 1 decimal */}
            <Text className="text-footnote uppercase tracking-wider text-text-tertiary mb-3">Time per goal</Text>
            <View className="rounded-xl p-4 mb-6 gap-4" style={[shadows.card, { backgroundColor: '#1f1f1f' }]}>
              {goalHours.map(({ goal, hours }) => {
                const wPct = maxHours > 0 ? (hours / maxHours) * 100 : 0;
                const tone = getGoalColor(goal.id);
                const showSliver = hours > 0 && wPct < 6;
                return (
                  <View key={goal.id}>
                    <View className="flex-row justify-between items-baseline mb-1.5">
                      <Text className="text-subheadline text-text-primary flex-1 pr-2" numberOfLines={1}>
                        {goal.name}
                      </Text>
                      <Text className="text-subheadline font-semibold tabular-nums" style={{ color: tone }}>
                        {hours.toFixed(1)}h
                      </Text>
                    </View>
                    <View className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#1f1f1f' }}>
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${showSliver ? 6 : wPct}%`,
                          backgroundColor: tone,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>

            {/* US-032: radar — one axis per active goal */}
            <Text className="text-footnote uppercase tracking-wider text-text-tertiary mb-3">Goal balance</Text>
            <View className="rounded-xl p-4 mb-6" style={[shadows.card, { backgroundColor: '#1f1f1f' }]}>
              <View className="items-center justify-center">
                {radarGeometry.count > 0 ? (
                  <Svg width={240} height={240}>
                    <Circle cx={120} cy={120} r={90} stroke={Colors.separator} strokeWidth={1} fill="none" />
                    <Circle cx={120} cy={120} r={60} stroke={Colors.separator} strokeWidth={1} fill="none" />
                    <Circle cx={120} cy={120} r={30} stroke={Colors.separator} strokeWidth={1} fill="none" />

                    {radarData.map((_, i) => {
                      const angle = -Math.PI / 2 + (i * (Math.PI * 2)) / radarGeometry.count;
                      const x = 120 + Math.cos(angle) * 90;
                      const y = 120 + Math.sin(angle) * 90;
                      return <Line key={`axis-${i}`} x1={120} y1={120} x2={x} y2={y} stroke={Colors.separator} strokeWidth={1} />;
                    })}

                    {radarGeometry.count === 1 ? (
                      <Line
                        x1={120}
                        y1={120}
                        x2={radarGeometry.outer[0].x}
                        y2={radarGeometry.outer[0].y}
                        stroke={getGoalColor(radarData[0].goal.id)}
                        strokeWidth={2}
                      />
                    ) : null}

                    {radarGeometry.count >= 3 ? (
                      <Polygon
                        points={radarGeometry.outer.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="rgba(232,228,220,0.12)"
                        stroke={Colors.textPrimary}
                        strokeWidth={1.5}
                      />
                    ) : radarGeometry.count === 2 ? (
                      <Polygon
                        points={`120,120 ${radarGeometry.outer[0].x},${radarGeometry.outer[0].y} ${radarGeometry.outer[1].x},${radarGeometry.outer[1].y}`}
                        fill="rgba(232,228,220,0.12)"
                        stroke={Colors.textPrimary}
                        strokeWidth={1.5}
                      />
                    ) : null}

                    {radarGeometry.outer.map((p, idx) => (
                      <Circle
                        key={`pt-${idx}`}
                        cx={p.x}
                        cy={p.y}
                        r={radarGeometry.count === 1 ? 6 : 3}
                        fill={getGoalColor(radarData[idx].goal.id)}
                      />
                    ))}
                  </Svg>
                ) : null}
              </View>

              <View className="flex-row flex-wrap justify-center gap-x-3 gap-y-1 mt-3">
                {radarData.map(({ goal }) => (
                  <Text key={`lbl-${goal.id}`} className="text-caption text-text-secondary" numberOfLines={1}>
                    <Text style={{ color: getGoalColor(goal.id) }}>{goal.icon} </Text>
                    {goal.name}
                  </Text>
                ))}
              </View>
            </View>

            {/* US-033: streak cards — action name in goal color, current + best */}
            <Text className="text-footnote uppercase tracking-wider text-text-tertiary mb-3">Streaks</Text>
            {streaks.map(({ action, goal, current, best }) => {
              const tone = getGoalColor(goal.id);
              return (
                <View
                  key={action.id}
                  className="rounded-lg px-4 py-3 mb-2 flex-row items-center border-l-[3px]"
                  style={[shadows.card, { backgroundColor: '#1f1f1f', borderLeftColor: tone }]}
                >
                  <Ionicons name="flame" size={20} color={tone} />
                  <View className="ml-3 flex-1">
                    <Text className="text-subheadline font-semibold" style={{ color: tone }} numberOfLines={2}>
                      {action.name}
                    </Text>
                    <Text className="text-footnote text-text-secondary mt-0.5">
                      {current > 0 ? `${current} day streak` : 'No active streak'}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-caption font-semibold text-text-primary">{current}</Text>
                    <Text className="text-caption text-text-tertiary">best {best}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
      <PaywallSheet
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onSuccess={() => void refreshPremium()}
      />
    </SafeAreaView>
  );
}
