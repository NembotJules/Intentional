/**
 * Year in Hours (US-086): the year as a short story, ending on a card to share.
 *
 * 1 Intro · 2 Total · 3 Where it went · 4 Best month · 5 Longest streak · 6 Goals achieved · 7 Flick's path · 8 The card.
 * Steps with nothing to show are skipped (no goals, no streak of 2+ days). Typed lines with the soft vibration, Continue to
 * advance. Dec 1 → Jan 15 it's the year's story (in January, last year's); any other day it's "Your year so far".
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { CTA } from '@/components/onboarding/parts';
import { Mascot } from '@/components/onboarding/Mascot';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { PressableScale } from '@/components/ui/motion';
import { TypeLine } from '@/components/ui/TypeLine';
import { ShareCardSheet } from '@/components/share/ShareCardSheet';
import { YEAR_CARD_H, YEAR_CARD_W, YearCard } from '@/components/share/YearCard';
import { Accent, FontFamily, Radius, Surface, Type } from '@/constants/design';
import { STAGES } from '@/services/lifeLedger';
import { rangeLabel, stagePathLine, storyYear, yearHours, yearShareText, type YearSummary } from '@/services/yearInHours';
import { getPartner } from '@/services/partner';
import { hapticSuccess } from '@/utils/haptics';

type Step = 'intro' | 'total' | 'pillars' | 'months' | 'streak' | 'goals' | 'flick' | 'card';

export default function YearScreen() {
  const router = useRouter();
  const { year: storyY, final } = storyYear(new Date());
  const [y, setY] = useState<YearSummary | null>(null);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const userName = api.getSetting('user_name')?.trim() || '';

  useFocusEffect(
    useCallback(() => {
      setY(api.getYearSummary(storyY));
      if (final) api.markYearStorySeen(storyY);
    }, [storyY, final])
  );

  const steps = useMemo<Step[]>(() => {
    if (!y || y.totalMinutes <= 0) return ['intro'];
    const out: Step[] = ['intro', 'total', 'pillars', 'months'];
    if (y.longestStreak && y.longestStreak.days >= 2) out.push('streak');
    if (y.goalsAchieved.length) out.push('goals');
    out.push('flick', 'card');
    return out;
  }, [y]);
  const step = steps[Math.min(index, steps.length - 1)]!;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/insights'));
  const next = () => {
    setTyped(false);
    if (index < steps.length - 1) setIndex(index + 1);
  };

  if (!y) return <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} />;

  const lineStyle = { ...Type.title, fontSize: 30, lineHeight: 37, textAlign: 'center' as const };
  const subStyle = { ...Type.body, fontSize: 17, lineHeight: 24, textAlign: 'center' as const, marginTop: 10 };
  const maxMonth = Math.max(1, ...y.months.map((m) => m.minutes));
  const top = y.pillars[0];
  const title = final ? `Your ${y.year} in hours` : 'Your year so far';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', gap: 5 }}>
          {steps.map((k, i) => (
            <View key={k} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= index ? Surface.ink : Surface.rule }} />
          ))}
        </View>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close year story" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={20} color={Surface.ink} />
        </Pressable>
      </View>

      <ScrollView key={step} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 18 }}>
        {step === 'intro' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Mascot mood="wave" size={150} intensity={0.9} stage={y.stageEnd.index} />
            <Text style={{ ...Type.accent, marginTop: 18 }}>{final ? `${y.year}` : `${y.year}, so far`}</Text>
            <View style={{ marginTop: 8, alignSelf: 'stretch' }}>
              <TypeLine
                text={y.totalMinutes > 0 ? (userName ? `${userName}, this is ${title.toLowerCase()}.` : `This is ${title.toLowerCase()}.`) : 'Your year starts with one session.'}
                style={lineStyle}
                onDone={() => setTyped(true)}
              />
            </View>
            <Text style={[subStyle, { opacity: typed ? 1 : 0 }]}>
              {y.totalMinutes > 0 ? 'Every hour you chose, in one story.' : 'Give an hour to a pillar and this page starts to fill in.'}
            </Text>
          </View>
        ) : null}

        {step === 'total' ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ ...Type.eyebrow, textAlign: 'center' }}>{final ? `In ${y.year} you gave` : 'This year you gave'}</Text>
            <Text accessibilityLabel={`${yearHours(y.totalMinutes)} given`} style={{ fontFamily: FontFamily.bodyBold, fontSize: 88, lineHeight: 96, letterSpacing: -3, color: Surface.ink, textAlign: 'center' }}>
              {yearHours(y.totalMinutes)}
            </Text>
            <Text style={{ ...Type.heading, fontSize: 18, textAlign: 'center' }}>to the life you chose</Text>
            <View style={{ marginTop: 26 }}>
              <TypeLine
                text={`${y.sessionCount.toLocaleString('en-US')} ${y.sessionCount === 1 ? 'session' : 'sessions'}, on ${y.activeDays} ${y.activeDays === 1 ? 'day' : 'days'}.`}
                style={{ ...Type.body, fontSize: 19, lineHeight: 26, color: Surface.ink, textAlign: 'center' }}
                delay={400}
                onDone={() => setTyped(true)}
              />
            </View>
            {y.bestDay ? (
              <Text style={[subStyle, { opacity: typed ? 1 : 0 }]}>
                Your biggest day: {rangeLabel(y.bestDay.dayKey, y.bestDay.dayKey)}, {yearHours(y.bestDay.minutes)}.
              </Text>
            ) : null}
          </View>
        ) : null}

        {step === 'pillars' && top ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <TypeLine text={`Most of it went to ${top.name}.`} style={lineStyle} />
            <Text style={{ ...Type.meta, textAlign: 'center', marginTop: 6 }}>
              {yearHours(top.minutes)} · {Math.round(top.share * 100)}% of your year
            </Text>
            <View style={{ marginTop: 26, gap: 18 }}>
              {y.pillars.map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <PillarIcon icon={p.icon} name={p.name} color={p.color} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 }}>
                      <Text numberOfLines={1} style={{ ...Type.heading, flex: 1, paddingRight: 8 }}>{p.name}</Text>
                      <Text style={Type.heading}>{yearHours(p.minutes)}</Text>
                    </View>
                    <View style={{ height: 10, borderRadius: 5, backgroundColor: Surface.surfaceRaised, overflow: 'hidden' }}>
                      <View style={{ width: `${Math.max(3, (p.minutes / top.minutes) * 100)}%`, height: 10, borderRadius: 5, backgroundColor: p.color }} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {step === 'months' && y.bestMonth ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <TypeLine text={`${y.bestMonth.long} was your biggest month.`} style={lineStyle} />
            <Text style={{ ...Type.meta, textAlign: 'center', marginTop: 6 }}>{yearHours(y.bestMonth.minutes)} that month</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 170, gap: 6, marginTop: 30 }} accessible accessibilityLabel="Hours per month">
              {y.months.map((m) => (
                <View key={m.index} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  {m.minutes > 0 ? (
                    <View style={{ width: '100%', height: Math.max(6, (m.minutes / maxMonth) * 140), borderRadius: 5, backgroundColor: m.index === y.bestMonth!.index ? Accent.blue : Surface.ink }} />
                  ) : (
                    <View style={{ width: '100%', height: 4, borderRadius: 2, backgroundColor: Surface.rule }} />
                  )}
                  <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: Surface.faint }}>{m.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {step === 'streak' && y.longestStreak ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ ...Type.eyebrow, textAlign: 'center' }}>Your longest run</Text>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 88, lineHeight: 96, letterSpacing: -3, color: Surface.ink }}>{y.longestStreak.days}</Text>
            <TypeLine text="days in a row with time for your life." style={lineStyle} onDone={() => setTyped(true)} />
            <Text style={[subStyle, { opacity: typed ? 1 : 0 }]}>{rangeLabel(y.longestStreak.from, y.longestStreak.to)}</Text>
          </View>
        ) : null}

        {step === 'goals' ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <TypeLine text={y.goalsAchieved.length === 1 ? 'You achieved a goal.' : `You achieved ${y.goalsAchieved.length} goals.`} style={lineStyle} />
            <View style={{ marginTop: 24, gap: 12 }}>
              {y.goalsAchieved.map((g) => (
                <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Surface.surfaceRaised, borderRadius: Radius.md, padding: 14 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Accent.green, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="trophy" size={15} color={Surface.surface} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...Type.heading, fontSize: 16 }} numberOfLines={2}>{g.title}</Text>
                    <Text style={{ ...Type.meta, marginTop: 2 }}>
                      {new Date(g.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {g.minutes > 0 ? ` · ${yearHours(g.minutes)} given` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {step === 'flick' ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4 }}>
              {y.stageEnd.index > y.stageStart.index ? <Mascot mood="calm" size={90} intensity={0.7} bob={false} stage={y.stageStart.index} /> : null}
              {y.stageEnd.index > y.stageStart.index ? <Ionicons name="arrow-forward" size={22} color={Surface.faint} style={{ marginBottom: 36 }} /> : null}
              <Mascot mood="proud" size={150} intensity={1} stage={y.stageEnd.index} />
            </View>
            <View style={{ alignSelf: 'stretch', marginTop: 16 }}>
              <TypeLine text={stagePathLine(y)} style={lineStyle} onDone={() => setTyped(true)} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: 24, opacity: typed ? 1 : 0 }}>
              {STAGES.map((st, i) => {
                const reached = i <= y.stageEnd.index;
                const thisYear = i > y.stageStart.index && i <= y.stageEnd.index;
                return (
                  <View key={st.name} style={{ alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: thisYear ? Accent.orange : reached ? Surface.ink : Surface.rule }} />
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 11, color: reached ? Surface.ink : Surface.faint, marginTop: 4 }}>{st.name}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {step === 'card' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ ...Type.heading, fontSize: 20, textAlign: 'center', marginBottom: 14 }}>{title}</Text>
            <View style={{ width: Math.round(YEAR_CARD_W * 0.78), height: Math.round(YEAR_CARD_H * 0.78), borderRadius: 20, overflow: 'hidden', backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.rule }}>
              <View style={{ transform: [{ scale: 0.78 }], transformOrigin: 'top left', width: YEAR_CARD_W, height: YEAR_CARD_H }}>
                <YearCard year={y} final={final} userName={userName || undefined} />
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 22, paddingBottom: 12, gap: 6 }}>
        {step === 'card' ? (
          <>
            <CTA label="Share your year" onPress={() => setShareOpen(true)} />
            <PressableScale
              onPress={() => {
                hapticSuccess();
                close();
              }}
              accessibilityRole="button"
              accessibilityLabel="Done"
              style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>Done</Text>
            </PressableScale>
          </>
        ) : y.totalMinutes <= 0 ? (
          <CTA label="Start a session" onPress={() => router.replace('/(tabs)/focus')} />
        ) : (
          <CTA label={step === 'intro' ? 'Show me' : 'Continue'} onPress={next} />
        )}
      </View>

      <ShareCardSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share your year"
        sub="Hours only. No task names."
        cardWidth={YEAR_CARD_W}
        cardHeight={YEAR_CARD_H}
        renderCard={(theme) => <YearCard year={y} final={final} theme={theme} userName={userName || undefined} />}
        message={yearShareText(y, { final })}
        partner={getPartner()}
        onSent={() => setShareOpen(false)}
      />
    </SafeAreaView>
  );
}
