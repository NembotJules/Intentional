/**
 * The Sunday ritual (US-082): your week as a short story, then plan the next one and send it.
 *
 * 1 Intro · 2 Hours (per day) · 3 Pillars (vs last week) · 4 Habits (kept, rest days) · 5 Goals · 6 Next week.
 * Steps with nothing to show are skipped. Typed lines with the soft vibration (no sound). Continue to advance,
 * never automatic. Finishing marks the week's ritual done (Today's "Your week is ready" card goes away).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { CTA } from '@/components/onboarding/parts';
import { Mascot } from '@/components/onboarding/Mascot';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { PressableScale } from '@/components/ui/motion';
import { TypeLine } from '@/components/ui/TypeLine';
import { WeekShareSheet } from '@/components/share/WeekShareSheet';
import { weekIntensity } from '@/components/share/WeekCard';
import { Accent, FontFamily, Radius, Surface, Type, hexToRgba } from '@/constants/design';
import { formatMinutes, headlineFor, type HabitDay, type WeekSummary } from '@/services/weekSummary';
import { getPartner, isWeekSent, reportWeek, type Partner } from '@/services/partner';
import { markRitualDone, ritualWeek } from '@/services/ritual';
import { hapticSuccess } from '@/utils/haptics';
import { localDayStart } from '@/utils/dates';

type Step = 'intro' | 'hours' | 'pillars' | 'habits' | 'goals' | 'next';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** A bar that grows from 0 to `fraction` when it appears. Vertical or horizontal. */
function GrowBar({ fraction, color, vertical, delay = 0, thickness = 10, length = 100 }: { fraction: number; color: string; vertical?: boolean; delay?: number; thickness?: number; length?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, { toValue: Math.max(0, Math.min(1, fraction)), duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [fraction, delay, v]);
  const size = v.interpolate({ inputRange: [0, 1], outputRange: [0, length] });
  return vertical ? (
    <Animated.View style={{ width: thickness, height: size, borderRadius: thickness / 2, backgroundColor: color }} />
  ) : (
    <Animated.View style={{ height: thickness, width: size.interpolate({ inputRange: [0, length], outputRange: ['0%', '100%'] }), borderRadius: thickness / 2, backgroundColor: color }} />
  );
}

function DayDot({ state, tone }: { state: HabitDay; tone: string }) {
  const base = { width: 22, height: 22, borderRadius: 11, alignItems: 'center' as const, justifyContent: 'center' as const };
  if (state === 'done') return <View style={[base, { backgroundColor: tone }]}><Ionicons name="checkmark" size={13} color={Surface.surface} /></View>;
  if (state === 'rest') return <View style={[base, { backgroundColor: hexToRgba(tone, 0.18) }]}><Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 10, color: tone }}>R</Text></View>;
  if (state === 'missed') return <View style={[base, { borderWidth: 2, borderColor: Surface.ruleStrong }]} />;
  if (state === 'today' || state === 'upcoming') return <View style={[base, { borderWidth: 2, borderStyle: 'dashed', borderColor: Surface.ruleStrong }]} />;
  return <View style={[base]}><View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: Surface.rule }} /></View>;
}

export default function RitualScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ week?: string }>();
  const weekStart = typeof params.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.week) ? params.week : ritualWeek();
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const userName = api.getSetting('user_name')?.trim() || '';

  useFocusEffect(
    useCallback(() => {
      let live = true;
      setPartner(getPartner());
      setSent(isWeekSent(weekStart));
      void api.getWeekSummary(weekStart).then((s) => {
        if (live) setSummary(s);
      });
      return () => {
        live = false;
      };
    }, [weekStart])
  );

  const steps = useMemo<Step[]>(() => {
    if (!summary) return ['intro'];
    const out: Step[] = ['intro', 'hours', 'pillars'];
    if (summary.habits.some((h) => h.days.some((d) => d !== 'off'))) out.push('habits');
    if (summary.goals.length) out.push('goals');
    out.push('next');
    return out;
  }, [summary]);
  const step = steps[Math.min(index, steps.length - 1)]!;

  useEffect(() => setTyped(false), [step]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/today'));
  const next = () => {
    if (index < steps.length - 1) setIndex(index + 1);
  };
  const finish = (to: 'today' | 'review') => {
    markRitualDone(weekStart);
    if (reportWeek().weekStart !== weekStart) markRitualDone(reportWeek().weekStart);
    hapticSuccess();
    if (to === 'review') router.replace('/weekly-review');
    else router.replace('/(tabs)/today');
  };

  if (!summary) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} />;
  }

  const s = summary;
  const maxDay = Math.max(1, ...s.days.map((d) => d.minutes));
  const maxPillar = Math.max(1, ...s.pillars.map((p) => p.minutes), ...s.pillars.map((p) => p.prevMinutes));
  const quiet = s.pillars.filter((p) => p.minutes <= 0);
  const intensity = weekIntensity(s.totalMinutes);
  const diff = s.totalMinutes - s.prevTotalMinutes;
  const bestName = s.bestDay ? localDayStart(s.bestDay.dayKey).toLocaleDateString('en-US', { weekday: 'long' }) : null;
  const pillarColor = (id: string) => s.pillars.find((p) => p.id === id)?.color ?? Surface.ink;

  const lineStyle = { ...Type.title, fontSize: 30, lineHeight: 37, textAlign: 'center' as const };
  const subStyle = { ...Type.body, fontSize: 17, lineHeight: 24, textAlign: 'center' as const, marginTop: 10 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />

      {/* Top: progress + close */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', gap: 5 }}>
          {steps.map((k, i) => (
            <View key={k} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= index ? Surface.ink : Surface.rule }} />
          ))}
        </View>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close ritual" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={20} color={Surface.ink} />
        </Pressable>
      </View>

      <ScrollView key={step} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 18 }}>
        {step === 'intro' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Mascot mood="wave" size={150} intensity={intensity} />
            <Text style={{ ...Type.accent, marginTop: 18 }}>Week of {s.label}</Text>
            <View style={{ marginTop: 8, alignSelf: 'stretch' }}>
              <TypeLine text={userName ? `${userName}, your week is in.` : 'Your week is in.'} style={lineStyle} onDone={() => setTyped(true)} />
            </View>
            <Text style={[subStyle, { opacity: typed ? 1 : 0 }]}>Three minutes: where your hours went, then next week.</Text>
          </View>
        ) : null}

        {step === 'hours' ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ ...Type.eyebrow, textAlign: 'center' }}>You gave</Text>
            <Text accessibilityLabel={`${formatMinutes(s.totalMinutes)} given this week`} style={{ fontFamily: FontFamily.bodyBold, fontSize: 76, lineHeight: 84, letterSpacing: -2.5, color: Surface.ink, textAlign: 'center' }}>
              {formatMinutes(s.totalMinutes)}
            </Text>
            <Text style={{ ...Type.heading, fontSize: 18, textAlign: 'center' }}>to the life you chose</Text>
            {s.prevTotalMinutes > 0 ? (
              <View style={{ alignSelf: 'center', marginTop: 12, height: 30, paddingHorizontal: 12, borderRadius: 15, justifyContent: 'center', backgroundColor: diff > 0 ? Accent.greenSoft : Surface.surfaceRaised }}>
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: diff > 0 ? Accent.green : Surface.muted }}>
                  {diff > 0 ? `↑ ${formatMinutes(diff)} more than last week` : diff < 0 ? `${formatMinutes(-diff)} less than last week` : 'Same as last week'}
                </Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 150, marginTop: 30, paddingHorizontal: 6 }}>
              {s.days.map((d, i) => (
                <View key={d.dayKey} style={{ alignItems: 'center', gap: 8, flex: 1 }}>
                  {d.minutes > 0 ? (
                    <GrowBar vertical fraction={d.minutes / maxDay} length={120} thickness={22} delay={i * 70} color={s.bestDay?.dayKey === d.dayKey ? Accent.blue : Surface.ink} />
                  ) : (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Surface.rule }} />
                  )}
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: Surface.faint }}>{DAY_LETTERS[i]}</Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop: 22 }}>
              <TypeLine
                text={
                  s.totalMinutes <= 0
                    ? 'A quiet week. That happens. One hour starts the next one.'
                    : `You showed up ${s.daysShowedUp} of 7 days.${bestName && s.bestDay ? ` ${bestName} was your best: ${formatMinutes(s.bestDay.minutes)}.` : ''}`
                }
                style={{ ...Type.body, fontSize: 18, lineHeight: 25, color: Surface.ink, textAlign: 'center' }}
                delay={500}
              />
            </View>
          </View>
        ) : null}

        {step === 'pillars' ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <TypeLine text="Where it went" style={{ ...Type.title, textAlign: 'center' }} />
            <Text style={{ ...Type.meta, textAlign: 'center', marginTop: 4 }}>This week, with last week in grey</Text>
            <View style={{ marginTop: 24, gap: 18 }}>
              {s.pillars.map((p, i) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <PillarIcon icon={p.icon} name={p.name} color={p.color} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 }}>
                      <Text numberOfLines={1} style={{ ...Type.heading, flex: 1, paddingRight: 8 }}>{p.name}</Text>
                      <Text style={{ ...Type.heading, color: p.minutes > 0 ? Surface.ink : Surface.faint }}>{formatMinutes(p.minutes)}</Text>
                    </View>
                    <View style={{ height: 10, borderRadius: 5, backgroundColor: Surface.surfaceRaised, overflow: 'hidden' }}>
                      <View style={{ width: `${(p.minutes / maxPillar) * 100}%`, height: 10 }}>
                        <GrowBar fraction={1} color={p.color} delay={i * 90} />
                      </View>
                    </View>
                    {p.prevMinutes > 0 ? (
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: Surface.ruleStrong, marginTop: 4, width: `${(p.prevMinutes / maxPillar) * 100}%` }} />
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
            {quiet.length && quiet.length < s.pillars.length ? (
              <View style={{ marginTop: 26, padding: 14, borderRadius: Radius.md, backgroundColor: Accent.blueSoft }}>
                <Text style={{ ...Type.body, color: Surface.ink, fontSize: 16 }}>
                  <Text style={{ fontFamily: FontFamily.bodyBold }}>{quiet.map((q) => q.name).join(', ')}</Text> got no time this week. One hour next week keeps{' '}
                  {quiet.length === 1 ? 'it' : 'them'} alive.
                </Text>
              </View>
            ) : (
              <Text style={{ ...Type.body, fontSize: 16, textAlign: 'center', marginTop: 24, color: Surface.ink }}>{headlineFor(s)}</Text>
            )}
          </View>
        ) : null}

        {step === 'habits' ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <TypeLine
              text={s.habitsDue > 0 ? `You kept ${s.habitsKept} of ${s.habitsDue} habit days.` : 'Your habits this week'}
              style={{ ...Type.title, textAlign: 'center' }}
            />
            {s.restDays > 0 ? (
              <Text style={{ ...Type.meta, textAlign: 'center', marginTop: 4 }}>
                {s.restDays} rest {s.restDays === 1 ? 'day' : 'days'}. A rest day keeps your streak.
              </Text>
            ) : null}
            <View style={{ marginTop: 22, gap: 12 }}>
              {s.habits
                .filter((h) => h.days.some((d) => d !== 'off'))
                .map((h) => {
                  const tone = pillarColor(h.pillarId);
                  return (
                    <View key={h.id} style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md, padding: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                        <Text numberOfLines={1} style={{ ...Type.heading, flex: 1, paddingRight: 8 }}>{h.name}</Text>
                        <Text style={{ ...Type.meta }}>
                          {formatMinutes(h.givenMinutes)} of {formatMinutes(h.plannedMinutes)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                        {h.days.map((d, i) => (
                          <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                            <DayDot state={d} tone={tone} />
                            <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 10, color: Surface.faint }}>{DAY_LETTERS[i]}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
            </View>
            <Text style={{ ...Type.meta, textAlign: 'center', marginTop: 14 }}>Missed days don't erase anything. Next week starts clean.</Text>
          </View>
        ) : null}

        {step === 'goals' ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <TypeLine text={s.goals.length === 1 ? 'Your goal' : 'Your goals'} style={{ ...Type.title, textAlign: 'center' }} />
            <View style={{ marginTop: 22, gap: 12 }}>
              {s.goals.map((g, i) => {
                const tone = pillarColor(g.pillar_id);
                const paceText = g.pace === 'ahead' ? 'ahead' : g.pace === 'on_track' ? 'on track' : g.pace === 'behind' ? 'a bit behind' : null;
                return (
                  <View key={g.id} style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md, padding: 16 }}>
                    <Text style={{ ...Type.heading, fontSize: 17 }} numberOfLines={2}>{g.title}</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                      <Text style={Type.meta}>{formatMinutes(g.minutes)} this week</Text>
                      {paceText ? <Text style={{ ...Type.meta, fontFamily: FontFamily.bodyBold, color: g.pace === 'behind' ? Accent.amber : g.pace === 'ahead' ? Accent.green : Surface.muted }}>{paceText}</Text> : null}
                    </View>
                    {g.progress !== null ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
                        <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: hexToRgba(tone, 0.16), overflow: 'hidden' }}>
                          <View style={{ width: `${Math.min(100, g.progress * 100)}%`, height: 8 }}>
                            <GrowBar fraction={1} color={tone} thickness={8} delay={i * 120} />
                          </View>
                        </View>
                        <Text style={{ ...Type.heading, fontSize: 15 }}>{Math.round(g.progress * 100)}%</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
            <Text style={{ ...Type.body, fontSize: 16, textAlign: 'center', marginTop: 18, color: Surface.ink }}>
              {s.goals.some((g) => g.pace === 'behind') ? 'Behind is information, not failure. Plan one task for it next week.' : 'Keep giving them hours every week.'}
            </Text>
          </View>
        ) : null}

        {step === 'next' ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Mascot mood="proud" size={130} intensity={Math.max(0.7, intensity)} />
            <View style={{ alignSelf: 'stretch', marginTop: 14 }}>
              <TypeLine text="Now, make next week count." style={lineStyle} onDone={() => setTyped(true)} />
            </View>
            <Text style={[subStyle, { opacity: typed ? 1 : 0 }]}>
              {partner
                ? sent
                  ? `${partner.name} has your week. Plan the next one.`
                  : `Send your week to ${partner.name}, then plan the next one.`
                : 'Plan a task for each goal, and share your week if you like.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Bottom actions */}
      <View style={{ paddingHorizontal: 22, paddingBottom: 12, gap: 6 }}>
        {step === 'next' ? (
          <>
            {partner && !sent ? (
              <CTA label={`Send to ${partner.name}`} onPress={() => setShareOpen(true)} />
            ) : (
              <CTA label="Plan next week" onPress={() => finish('review')} />
            )}
            {partner && !sent ? (
              <PressableScale onPress={() => finish('review')} accessibilityRole="button" accessibilityLabel="Plan next week" style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>Plan next week</Text>
              </PressableScale>
            ) : !partner ? (
              <PressableScale onPress={() => setShareOpen(true)} accessibilityRole="button" accessibilityLabel="Share your week" style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>Share your week</Text>
              </PressableScale>
            ) : null}
            {!partner ? (
              <PressableScale onPress={() => router.push('/partner')} accessibilityRole="button" accessibilityLabel="Choose an accountability partner" style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Accent.blue }}>Choose someone to send it to every week</Text>
              </PressableScale>
            ) : (
              <PressableScale onPress={() => finish('today')} accessibilityRole="button" accessibilityLabel="Done for now" style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Surface.muted }}>Done for now</Text>
              </PressableScale>
            )}
          </>
        ) : (
          <CTA label={step === 'intro' ? 'Show me' : 'Continue'} onPress={next} />
        )}
      </View>

      <WeekShareSheet
        visible={shareOpen}
        weekStart={weekStart}
        toPartner={!!partner}
        onClose={() => setShareOpen(false)}
        onSent={() => {
          setSent(true);
          setShareOpen(false);
        }}
      />
    </SafeAreaView>
  );
}
