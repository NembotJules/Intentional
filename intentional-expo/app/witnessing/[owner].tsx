/**
 * US-090 · Witnessing: what a witness sees of one person — their pledge (pillars and goals), Flick's stage,
 * hours per pillar this week, goals with progress and pace. From `witness_summary` (aggregates only: no task names,
 * no notes). As fresh as their last backup.
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Mascot } from '@/components/onboarding/Mascot';
import { ProgressBar } from '@/components/ui/motion';
import { Accent, FontFamily, Surface, Type } from '@/constants/design';
import { getSupabase } from '@/services/supabase';
import { STAGES } from '@/services/lifeLedger';
import { formatMinutes, weekStartOf } from '@/services/weekSummary';
import { listOf } from '@/services/pledge';
import { agoLabel } from '@/components/account/BackupCard';
import { endLink, friendlyWitnessError, getSummary, paceLabel, weekTotal, type WitnessSummary } from '@/services/witness';
import { confirmAsync } from '@/utils/confirm';
import { localDayKey, localDayStart } from '@/utils/dates';

const card = { backgroundColor: Surface.surfaceRaised, borderRadius: 18, padding: 16 } as const;

const paceColor = (p: WitnessSummary['goals'][number]['pace']) =>
  p === 'ahead' ? Accent.green : p === 'behind' ? Accent.amber : p === 'on_track' ? Surface.ink : Surface.muted;

export default function WitnessingScreen() {
  const router = useRouter();
  const { owner, link, name } = useLocalSearchParams<{ owner: string; link?: string; name?: string }>();
  const client = getSupabase();
  const [summary, setSummary] = useState<WitnessSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/witness'));
  const weekStart = weekStartOf(localDayKey());

  useFocusEffect(
    useCallback(() => {
      if (!client || !owner) return;
      let live = true;
      void getSummary(client, owner, weekStart)
        .then((s) => live && setSummary(s))
        .catch((e) => live && setError(friendlyWitnessError(e)));
      return () => {
        live = false;
      };
    }, [client, owner, weekStart])
  );

  const stop = async () => {
    if (!client || !link) return;
    const who = summary?.display_name ?? name ?? 'them';
    const yes = await confirmAsync({ title: `Stop witnessing ${who}?`, message: 'They can invite you again anytime.', confirmLabel: 'Stop witnessing' });
    if (!yes) return;
    try {
      await endLink(client, link);
      back();
    } catch (e) {
      setError(friendlyWitnessError(e));
    }
  };

  const who = summary?.display_name ?? name ?? 'Them';
  const stage = STAGES[Math.max(0, Math.min(5, summary?.flick_stage ?? 0))]!;
  const total = summary ? weekTotal(summary) : 0;
  const max = summary ? Math.max(1, ...summary.pillars.map((p) => p.minutes)) : 1;
  const pillarName = (id: string) => summary?.pillars.find((p) => p.id === id)?.name ?? '';
  const weekLabel = localDayStart(weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 }}>
        <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
          <Pressable
            onPress={back}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={22} color={Surface.ink} />
          </Pressable>

          {error ? (
            <Text style={{ ...Type.body, color: Accent.amber, textAlign: 'center', marginTop: 40 }}>{error}</Text>
          ) : !summary ? (
            <ActivityIndicator color={Surface.ink} style={{ marginTop: 40 }} />
          ) : (
            <>
              <View style={{ alignItems: 'center', marginTop: 4 }} accessibilityLabel={`Flick, ${stage.name}`}>
                <Mascot mood="proud" size={110} intensity={total > 0 ? 0.85 : 0.5} stage={summary.flick_stage ?? 0} />
              </View>
              <Text style={{ ...Type.meta, textAlign: 'center', marginTop: 6 }}>You witness</Text>
              <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center' }}>
                {who}
              </Text>
              <Text style={{ ...Type.body, textAlign: 'center', marginTop: 6 }}>
                Flick is a {stage.name}. Updated {agoLabel(summary.last_backup)}.
              </Text>

              {summary.pillars.length ? (
                <View style={{ ...card, marginTop: 18 }} accessibilityLabel={`Pledge: hours go to ${listOf(summary.pillars.map((p) => p.name))}`}>
                  <Text style={{ ...Type.meta }}>Their pledge</Text>
                  <Text style={{ ...Type.heading, marginTop: 4 }}>Their hours go to {listOf(summary.pillars.map((p) => p.name))}.</Text>
                  {summary.goals.length ? (
                    <Text style={{ ...Type.body, marginTop: 4 }}>
                      {summary.goals
                        .map((g) => (g.deadline ? `${g.title} by ${localDayStart(g.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : g.title))
                        .join(' · ')}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <View style={{ ...card, marginTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text style={{ ...Type.heading }}>This week</Text>
                  <Text style={{ ...Type.meta }}>since Mon {weekLabel}</Text>
                </View>
                <Text accessibilityLabel={`This week ${formatMinutes(total)}`} style={{ ...Type.hero, fontSize: 40, lineHeight: 46, marginTop: 4 }}>
                  {formatMinutes(total)}
                </Text>
                <View style={{ gap: 12, marginTop: 10 }}>
                  {summary.pillars.map((p) => (
                    <View key={p.id} accessibilityLabel={`${p.name} ${formatMinutes(p.minutes)}`}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodySemiBold, fontSize: 15 }}>{p.name}</Text>
                        <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 14 }}>{formatMinutes(p.minutes)}</Text>
                      </View>
                      <ProgressBar progress={p.minutes / max} color={p.color} trackColor={Surface.hill} height={8} />
                    </View>
                  ))}
                </View>
              </View>

              <View style={{ ...card, marginTop: 12 }}>
                <Text style={{ ...Type.heading, marginBottom: 6 }}>Goals</Text>
                {summary.goals.length === 0 ? (
                  <Text style={{ ...Type.body }}>No goal running right now.</Text>
                ) : (
                  <View style={{ gap: 14 }}>
                    {summary.goals.map((g, i) => (
                      <View key={`${g.title}-${i}`} accessibilityLabel={`Goal ${g.title}, ${paceLabel(g.pace)}${g.progress !== null ? `, ${Math.round(g.progress * 100)}%` : ''}`}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                          <Text numberOfLines={2} style={{ flex: 1, color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>
                            {g.title}
                          </Text>
                          <Text style={{ color: paceColor(g.pace), fontFamily: FontFamily.bodyBold, fontSize: 14 }}>{paceLabel(g.pace)}</Text>
                        </View>
                        <Text style={{ ...Type.meta, marginTop: 2 }}>
                          {pillarName(g.pillar_id)}
                          {g.progress !== null ? ` · ${Math.round(g.progress * 100)}%` : ''}
                        </Text>
                        {g.progress !== null ? (
                          <View style={{ marginTop: 6 }}>
                            <ProgressBar progress={g.progress} color={summary.pillars.find((p) => p.id === g.pillar_id)?.color ?? Surface.ink} trackColor={Surface.hill} height={6} />
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <Text style={{ ...Type.meta, textAlign: 'center', marginTop: 16 }}>Only hours and goals. Never their tasks or notes.</Text>
              {link ? (
                <Pressable onPress={() => void stop()} accessibilityRole="button" accessibilityLabel="Stop witnessing" style={{ paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>Stop witnessing</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
