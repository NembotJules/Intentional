import { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useInsightsData } from '@/db/hooks';
import { Colors, FontFamily, Radius, Surface } from '@/constants/design';
import { PrimaryButton } from '@/components/PrimaryButton';
import { getGoalColor } from '@/utils/goalColors';

type Range = 'week' | 'month' | 'all';

const RANGE_LABELS: Record<Range, string> = { week: 'WK', month: 'MO', all: 'ALL' };
const RANGE_EYEBROW: Record<Range, string> = { week: 'Last 7 days', month: 'This month', all: 'All time' };

/** Match `(tabs)/_layout.tsx` floating tab bar so content isn’t hidden */
function tabBarOverlapPadding(insetsBottom: number) {
  const tabBarCore = 56;
  const tabBarExtra = 8;
  const gapAboveBar = 10;
  return tabBarCore + Math.max(insetsBottom, 6) + tabBarExtra + gapAboveBar;
}

function formatHours(hours: number): string {
  if (hours <= 0) return '0m';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(1)}h`;
}

export default function InsightsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<Range>('week');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const { goalHours, totalHours, dailyAverage, streaks, showInsightsEmpty } = useInsightsData(range, refreshSignal);

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

  const bottomPad = tabBarOverlapPadding(insets.bottom) + 16;
  const insightSentence = useMemo(() => {
    const nonZero = goalHours.filter((entry) => entry.hours > 0).sort((a, b) => b.hours - a.hours);
    if (!nonZero.length) return 'Your ledger is empty. Start one session and the accounting begins.';
    const [first, second] = nonZero;
    if (!second || first.hours >= second.hours * 2) {
      return `${first.goal.name} is doing most of the work. If that is intentional, keep going. If not, schedule one block elsewhere.`;
    }
    return `${first.goal.name} carried this period. ${second.goal.name} is visible too, which means the week is not one-dimensional.`;
  }, [goalHours]);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: bottomPad }}
      >
        <View className="flex-row items-start justify-between mb-6">
          <View className="flex-1 pr-4">
            <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              {RANGE_EYEBROW[range]}
            </Text>
            <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 44, lineHeight: 46, marginTop: 4 }}>
              {showInsightsEmpty ? 'Your ledger is empty.' : 'Where time went.'}
            </Text>
          </View>
          <View className="w-[138px] h-10 p-1 flex-row" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.full }}>
            {(['week', 'month', 'all'] as const).map((r) => {
              const active = range === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRange(r)}
                  className="flex-1 justify-center items-center"
                  style={{ backgroundColor: active ? Surface.surfaceRaised : 'transparent', borderRadius: Radius.full }}
                >
                  <Text
                    style={{
                      color: active ? Colors.textPrimary : Colors.textSecondary,
                      fontFamily: FontFamily.monoSemiBold,
                      fontSize: 10,
                      letterSpacing: 0.8,
                    }}
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
            onPress={() => router.push('/session-history')}
            className="flex-row items-center justify-between py-3 px-4"
            style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
              <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 16 }}>Session history</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </Pressable>
        </View>

        {showInsightsEmpty ? (
          <View className="py-8 px-5" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
            <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 64, lineHeight: 64 }}>
              0m
            </Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 17, lineHeight: 24, marginTop: 10, marginBottom: 22 }}>
              Insights appear after you log focus time to a pillar. Start one session and Intentional will show where the day went.
            </Text>
            <PrimaryButton title="Start first session" onPress={() => router.push('/(tabs)/focus')} />
          </View>
        ) : (
          <>
            {/* US-034: summary above bar chart */}
            <View className="flex-row gap-2 mb-5">
              <View className="flex-1 p-4 min-h-[92px]" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
                <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 34, lineHeight: 36 }}>{formatHours(totalHours)}</Text>
                <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 10, letterSpacing: 0.8, marginTop: 2, textTransform: 'uppercase' }}>Total</Text>
              </View>
              <View className="flex-1 p-4 min-h-[92px]" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
                <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 34, lineHeight: 36 }}>{formatHours(dailyAverage)}</Text>
                <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 10, letterSpacing: 0.8, marginTop: 2, textTransform: 'uppercase' }}>Daily avg</Text>
              </View>
              <View className="flex-1 p-4 min-h-[92px]" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
                <Text
                  style={{ color: topGoalEntry ? getGoalColor(topGoalEntry.goal.id) : Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 34, lineHeight: 36 }}
                  numberOfLines={1}
                >
                  {topGoalEntry ? formatHours(topGoalEntry.hours) : '-'}
                </Text>
                <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 10, letterSpacing: 0.8, marginTop: 2, textTransform: 'uppercase' }}>Top pillar</Text>
                {topGoalEntry ? (
                  <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                    {topGoalEntry.goal.name}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* US-031: horizontal bars, width ∝ hours, 1 decimal */}
            <View className="p-4 mb-5 gap-4" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
              <View className="flex-row items-center justify-between">
                <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 17 }}>Hours by pillar</Text>
                <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 11 }}>{formatHours(totalHours)}</Text>
              </View>
              {goalHours.map(({ goal, hours }) => {
                const wPct = maxHours > 0 ? (hours / maxHours) * 100 : 0;
                const tone = getGoalColor(goal.id);
                const showSliver = hours > 0 && wPct < 6;
                return (
                  <View key={goal.id}>
                    <View className="flex-row justify-between items-baseline mb-1.5">
                      <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.body, fontSize: 16, flex: 1, paddingRight: 8 }} numberOfLines={1}>
                        {goal.name}
                      </Text>
                      <Text style={{ color: tone, fontFamily: FontFamily.monoSemiBold, fontSize: 12 }}>
                        {formatHours(hours)}
                      </Text>
                    </View>
                    <View className="h-[7px] rounded-full overflow-hidden" style={{ backgroundColor: Surface.surfaceRaised }}>
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
              <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22, marginTop: 2 }}>
                {insightSentence}
              </Text>
            </View>

            <View className="p-4" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
              <View className="flex-row items-center justify-between mb-3">
                <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 17 }}>Streaks</Text>
                <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 11 }}>
                  {streaks.filter(({ current }) => current > 0).length} active
                </Text>
              </View>
              {streaks.length ? (
                streaks.map(({ action, goal, current, best }) => {
                  const tone = getGoalColor(goal.id);
                  return (
                    <View
                      key={action.id}
                      className="flex-row items-center py-3"
                      style={{ borderTopWidth: 1, borderTopColor: Surface.rule }}
                    >
                      <View className="w-2.5 h-2.5 rounded-full mr-3" style={{ backgroundColor: tone }} />
                      <View className="flex-1 pr-3">
                        <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 16 }} numberOfLines={2}>
                          {action.name}
                        </Text>
                        <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 14, marginTop: 2 }}>
                          {goal.name}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.monoSemiBold, fontSize: 13 }}>
                          {current > 0 ? `${current}d` : '0d'}
                        </Text>
                        <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 10, marginTop: 2 }}>
                          best {best}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22 }}>
                  Streaks appear once repeating actions have enough evidence to count.
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
