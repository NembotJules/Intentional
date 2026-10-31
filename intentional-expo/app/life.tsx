/**
 * Your Life in Hours (US-083): the whole ledger on one screen.
 *
 * Lifetime hours (big) and since when · Flick's stage and the hours to the next one (US-079 thresholds) ·
 * the last 12 months · every pillar's share · the goals you achieved, with the hours each took.
 * It only grows: this is the record that makes the history worth keeping.
 */
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { Mascot } from '@/components/onboarding/Mascot';
import { CTA } from '@/components/onboarding/parts';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { ProgressBar } from '@/components/ui/motion';
import { Accent, Elevation, FontFamily, Radius, Surface, Type } from '@/constants/design';
import { STAGES, stageToNextLabel, type Ledger } from '@/services/lifeLedger';
import { formatMinutes } from '@/services/weekSummary';
import { localDayStart } from '@/utils/dates';

function hoursLabel(mins: number): string {
  if (mins < 60) return formatMinutes(mins);
  const h = mins / 60;
  return h >= 100 ? `${Math.round(h)}h` : `${Math.round(h * 10) / 10}h`.replace('.0h', 'h');
}

export default function LifeScreen() {
  const router = useRouter();
  const [ledger, setLedger] = useState<Ledger | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void api.getLifeLedger().then((l) => {
        if (live) setLedger(l);
      });
      return () => {
        live = false;
      };
    }, [])
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/insights'));
  if (!ledger) return <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} />;

  const l = ledger;
  const since = l.firstDay ? localDayStart(l.firstDay).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
  const maxMonth = Math.max(1, ...l.months.map((m) => m.minutes));
  const pillarById = new Map(l.pillars.map((p) => [p.id, p]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 }}>
        <Pressable
          onPress={back}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={22} color={Surface.ink} />
        </Pressable>

        {/* Hero */}
        <View style={{ alignItems: 'center', marginTop: 6 }}>
          <Text accessibilityRole="header" style={{ ...Type.eyebrow, textAlign: 'center' }}>
            Your life in hours
          </Text>
          <Text
            accessibilityLabel={`${hoursLabel(l.totalMinutes)} given in total`}
            style={{ fontFamily: FontFamily.bodyBold, fontSize: 72, lineHeight: 80, letterSpacing: -2.4, color: Surface.ink, marginTop: 2 }}
          >
            {hoursLabel(l.totalMinutes)}
          </Text>
          <Text style={{ ...Type.heading, fontSize: 17, textAlign: 'center' }}>given to the life you chose</Text>
          <Text style={{ ...Type.meta, fontSize: 14, textAlign: 'center', marginTop: 6 }}>
            {since ? `Since ${since} · on ${l.activeDays} ${l.activeDays === 1 ? 'day' : 'days'} · ${l.sessionCount} ${l.sessionCount === 1 ? 'session' : 'sessions'}` : 'Your first session starts the ledger.'}
          </Text>
        </View>

        {/* Flick's stage */}
        <View style={{ marginTop: 22, backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 18, ...Elevation.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Mascot mood={l.stage.index >= 2 ? 'proud' : 'happy'} size={78} intensity={0.85} stage={l.stage.index} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...Type.heading, fontSize: 19 }}>Flick is a {l.stage.name}</Text>
              <Text style={{ ...Type.meta, fontSize: 14, marginTop: 2 }}>
                {l.stage.next && l.stage.hoursToNext !== null
                  ? stageToNextLabel(l.stage)
                  : 'The brightest stage. Every hour still counts.'}
              </Text>
              {l.stage.next ? (
                <View style={{ marginTop: 10 }}>
                  <ProgressBar progress={l.stage.progress} color={Accent.orange} trackColor={Surface.surfaceRaised} height={6} />
                </View>
              ) : null}
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
            {STAGES.map((st, i) => {
              const reached = i <= l.stage.index;
              return (
                <View key={st.name} style={{ alignItems: 'center', flex: 1 }} accessible accessibilityLabel={`${st.name}, ${st.hours} hours${reached ? ', reached' : ''}`}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: reached ? Accent.orange : Surface.rule }} />
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 11, color: reached ? Surface.ink : Surface.faint, marginTop: 4 }}>{st.name}</Text>
                  <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 10, color: Surface.faint }}>{st.hours}h</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Months */}
        <Text style={{ ...Type.title, fontSize: 22, lineHeight: 28, marginTop: 28, marginBottom: 12 }}>The last 12 months</Text>
        <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.lg, padding: 16 }} accessible accessibilityLabel="Hours per month, last 12 months">
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 6 }}>
            {l.months.map((m, i) => (
              <View key={m.key} style={{ flex: 1, height: 110, justifyContent: 'flex-end' }}>
                {m.minutes > 0 ? (
                  <View style={{ height: Math.max(6, (m.minutes / maxMonth) * 110), borderRadius: 5, backgroundColor: i === 11 ? Accent.blue : Surface.ink }} />
                ) : (
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: Surface.rule }} />
                )}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            {l.months.map((m) => (
              <Text key={m.key} style={{ flex: 1, textAlign: 'center', fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: Surface.faint }}>
                {m.label}
              </Text>
            ))}
          </View>
        </View>

        {/* Pillars */}
        <Text style={{ ...Type.title, fontSize: 22, lineHeight: 28, marginTop: 28, marginBottom: 12 }}>Where your life went</Text>
        <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.lg, padding: 16, gap: 16 }}>
          {l.pillars.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <PillarIcon icon={p.icon} name={p.name} color={p.color} size={38} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 }}>
                  <Text numberOfLines={1} style={{ ...Type.heading, flex: 1, paddingRight: 8 }}>
                    {p.name}
                  </Text>
                  <Text style={{ ...Type.heading }}>{hoursLabel(p.minutes)}</Text>
                  <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: Surface.faint, width: 42, textAlign: 'right' }}>{Math.round(p.share * 100)}%</Text>
                </View>
                <ProgressBar progress={Math.max(p.minutes > 0 ? 0.03 : 0, p.share)} color={p.color} trackColor={Surface.rule} height={7} />
              </View>
            </View>
          ))}
        </View>

        {/* Goals achieved */}
        <Text style={{ ...Type.title, fontSize: 22, lineHeight: 28, marginTop: 28, marginBottom: 12 }}>Goals achieved</Text>
        {l.goalsAchieved.length ? (
          <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.lg, padding: 16 }}>
            {l.goalsAchieved.map((g, i) => {
              const p = pillarById.get(g.pillarId);
              const last = i === l.goalsAchieved.length - 1;
              return (
                <View key={g.id} style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: Accent.green, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="trophy" size={14} color={Surface.surface} />
                    </View>
                    {last ? null : <View style={{ width: 2, flex: 1, minHeight: 16, backgroundColor: Surface.ruleStrong, marginVertical: 4 }} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: last ? 0 : 16 }}>
                    <Text style={{ ...Type.heading, fontSize: 16 }}>{g.title}</Text>
                    <Text style={{ ...Type.meta, marginTop: 2 }}>
                      {new Date(g.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {p ? ` · ${p.name}` : ''} · {formatMinutes(g.minutes)} in {g.days} {g.days === 1 ? 'day' : 'days'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: Radius.lg, padding: 16 }}>
            <Text style={Type.body}>Your first achieved goal will be written here, with the hours it took.</Text>
          </View>
        )}

        {l.totalMinutes <= 0 ? (
          <View style={{ marginTop: 24 }}>
            <CTA label="Start your first session" onPress={() => router.push('/(tabs)/focus')} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
