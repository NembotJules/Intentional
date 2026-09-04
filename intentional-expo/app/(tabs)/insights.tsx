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
    
    const [first, second, ...rest] = nonZero;
    const total = nonZero.reduce((sum, entry) => sum + entry.hours, 0);
    const firstPct = (first.hours / total) * 100;
    
    // Very dominant single pillar (>50%)
    if (firstPct > 50) {
      const pillarsCount = goalHours.length;
      if (pillarsCount === 1) {
        return `${first.goal.name} is the only pillar with logged time.`;
      }
      return `${first.goal.name} carried the period. ${
        second 
          ? `${second.goal.name} is visible too, but needs more attention.` 
          : 'Other pillars have not been touched.'
      }`;
    }
    
    // Balanced across multiple pillars
    if (nonZero.length >= 3 && firstPct < 40) {
      return `Work is happening across multiple pillars. ${first.goal.name} leads, but the week is not one-dimensional.`;
    }
    
    // Two pillars with reasonable balance
    if (second && firstPct < 60) {
      return `${first.goal.name} and ${second.goal.name} are both active. ${
        rest.length > 0 
          ? `${rest.length} other ${rest.length === 1 ? 'pillar is' : 'pillars are'} underfed.` 
          : 'That is evidence, not vibes.'
      }`;
    }
    
    return `${first.goal.name} is doing most of the work. If that is intentional, keep going. If not, schedule one block elsewhere.`;
  }, [goalHours]);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: bottomPad }}
      >
        <View className="mb-6">
          <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase' }}>
            {RANGE_EYEBROW[range]}
          </Text>
          <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 44, lineHeight: 46, marginTop: 4 }}>
            {showInsightsEmpty ? 'Your ledger is empty.' : 'Where time went.'}
          </Text>
        </View>

        <View className="flex-row gap-2 mb-6">
          {(['week', 'month', 'all'] as const).map((r) => {
            const active = range === r;
            return (
              <Pressable
                key={r}
                onPress={() => setRange(r)}
                className="px-5 py-2.5"
                style={{
                  backgroundColor: active ? Surface.ink : Surface.surface,
                  borderWidth: 1,
                  borderColor: active ? Surface.ink : Surface.rule,
                  borderRadius: Radius.full,
                }}
              >
                <Text
                  style={{
                    color: active ? Surface.canvas : Colors.textSecondary,
                    fontFamily: FontFamily.bodySemiBold,
                    fontSize: 15,
                    letterSpacing: 0.3,
                  }}
                >
                  {RANGE_LABELS[r]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {showInsightsEmpty ? (
          <View className="py-8 px-5" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg, marginTop: 32 }}>
            <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 64, lineHeight: 64 }}>
              0m
            </Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 17, lineHeight: 24, marginTop: 10, marginBottom: 22 }}>
              Insights appear after you log focus time to a pillar. Start one session and Intentional will show where the day went.
            </Text>
            <PrimaryButton title="Start first session" onPress={() => router.push('/(tabs)/focus')} showArrow={false} />
          </View>
        ) : (
          <>
            <View className="py-6 px-5 mb-5" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
              <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 72, lineHeight: 76 }}>
                {formatHours(totalHours)}
              </Text>
              <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 17, lineHeight: 24, marginTop: 8 }}>
                {insightSentence}
              </Text>
            </View>

            <View className="p-5" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
              <View className="flex-row items-center justify-between mb-5">
                <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 17 }}>Hours by pillar</Text>
                <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 11 }}>
                  {dailyAverage > 0 ? `${formatHours(dailyAverage)}/day avg` : 'No data'}
                </Text>
              </View>
              <View className="gap-5">
                {goalHours.map(({ goal, hours }) => {
                  const wPct = maxHours > 0 ? (hours / maxHours) * 100 : 0;
                  const tone = getGoalColor(goal.id);
                  const showSliver = hours > 0 && wPct < 6;
                  return (
                    <View key={goal.id}>
                      <View className="flex-row justify-between items-baseline mb-2">
                        <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 16, flex: 1, paddingRight: 8 }} numberOfLines={1}>
                          {goal.name}
                        </Text>
                        <Text style={{ color: tone, fontFamily: FontFamily.monoSemiBold, fontSize: 14 }}>
                          {formatHours(hours)}
                        </Text>
                      </View>
                      <View className="h-[14px] rounded-full overflow-hidden" style={{ backgroundColor: Surface.surfaceRaised }}>
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
            </View>

            <View className="p-5 mt-5" style={{ backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule, borderRadius: Radius.lg }}>
              <View className="flex-row items-center justify-between mb-4">
                <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 17 }}>Streaks</Text>
                <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 11 }}>
                  {streaks.filter(({ current }) => current > 0).length} active
                </Text>
              </View>
              {streaks.length ? (
                <View className="gap-4">
                  {streaks.map(({ action, goal, current, best }) => {
                    const tone = getGoalColor(goal.id);
                    return (
                      <View
                        key={action.id}
                        className="flex-row items-center"
                      >
                        <View className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: tone }} />
                        <View className="flex-1 pr-4">
                          <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 16 }} numberOfLines={2}>
                            {action.name}
                          </Text>
                          <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.body, fontSize: 14, marginTop: 2 }}>
                            {goal.name}
                          </Text>
                        </View>
                        <View className="items-end">
                          <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 28, lineHeight: 30 }}>
                            {current > 0 ? current : 0}
                          </Text>
                          <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 10, marginTop: 1 }}>
                            best {best}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
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
