/**
 * US-091 · One circle: the collective week ("42 h of 50 h to Craft this week"), each member's hours this week on
 * the pillar they mapped, their Flick stage. Ranking is off by default; the owner can turn on a weekly ranking
 * (resets every Monday). Invite (code + share), change which of your pillars counts, leave; the owner removes
 * members or deletes the circle. From `circle_week` (aggregates only, as fresh as each member's last backup).
 */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { CTA } from '@/components/onboarding/parts';
import { Mascot } from '@/components/onboarding/Mascot';
import { Chip } from '@/components/focus/parts';
import { ProgressBar } from '@/components/ui/motion';
import { Accent, FontFamily, Surface, Type } from '@/constants/design';
import { getSupabase } from '@/services/supabase';
import { STAGES } from '@/services/lifeLedger';
import { backupNow } from '@/services/backup';
import { weekStartOf } from '@/services/weekSummary';
import {
  MAX_MEMBERS,
  circleInviteMessage,
  collectiveLabel,
  collectiveProgress,
  deleteCircle,
  friendlyCircleError,
  getCircleWeek,
  hoursLabel,
  joinCircle,
  leaveCircle,
  memberHours,
  prettyCode,
  removeMember,
  setRanking,
  type CircleWeek,
} from '@/services/circles';
import { confirmAsync } from '@/utils/confirm';
import { localDayKey, localDayStart } from '@/utils/dates';
import { hapticSuccess } from '@/utils/haptics';
import { shareText } from '@/utils/shareCard';

const card = { backgroundColor: Surface.surfaceRaised, borderRadius: 18, padding: 16 } as const;
const stageName = (s: number | null) => STAGES[Math.max(0, Math.min(5, s ?? 0))]!.name;

function Switch({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      hitSlop={8}
      style={{ width: 52, height: 32, borderRadius: 16, padding: 3, justifyContent: 'center', backgroundColor: on ? Surface.ink : Surface.ruleStrong }}
    >
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: Surface.surface, transform: [{ translateX: on ? 20 : 0 }] }} />
    </Pressable>
  );
}

export default function CircleScreen() {
  const router = useRouter();
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const client = getSupabase();
  const [week, setWeek] = useState<CircleWeek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [changingPillar, setChangingPillar] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/circles'));
  const weekStart = weekStartOf(localDayKey());
  const pillars = useMemo(() => api.getAllPillarsSync().filter((p) => !p.is_archived).map((p) => ({ id: p.id, name: p.name })), []);

  const load = useCallback(async () => {
    if (!client || !id) return;
    try {
      setWeek(await getCircleWeek(client, id, weekStart));
      setError(null);
    } catch (e) {
      setError(friendlyCircleError(e));
    }
  }, [client, id, weekStart]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(friendlyCircleError(e));
    } finally {
      setBusy(false);
    }
  };

  const isOwner = week?.my_role === 'owner';
  const me = week?.members.find((m) => m.is_me);
  const myPillarName = pillars.find((p) => p.id === me?.pillar_id)?.name;
  const full = (week?.members.length ?? 0) >= MAX_MEMBERS;
  const weekLabel = localDayStart(weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const share = () =>
    week
      ? shareText(
          circleInviteMessage({ userName: api.getSetting('user_name'), code: week.invite_code, name: week.name, label: week.pillar_label, targetMinutes: week.weekly_target_minutes }),
          'Join my circle'
        )
      : Promise.resolve();

  const toggleRanking = () =>
    run(async () => {
      if (!client || !week) return;
      await setRanking(client, week.id, !week.ranking_enabled);
      await load();
    });

  const changePillar = (pillarId: string) =>
    run(async () => {
      if (!client || !week) return;
      await backupNow().catch(() => null);
      await joinCircle(client, week.invite_code, pillarId);
      setChangingPillar(false);
      hapticSuccess();
      await load();
    });

  const remove = async (memberId: string, who: string) => {
    if (!client || !week) return;
    const yes = await confirmAsync({ title: `Remove ${who}?`, message: 'The circle’s code changes, so they can’t come straight back.', confirmLabel: 'Remove' });
    if (yes)
      await run(async () => {
        await removeMember(client, week.id, memberId);
        await load();
      });
  };

  const leave = async () => {
    if (!client || !week) return;
    const alone = week.members.length === 1;
    const yes = await confirmAsync({
      title: `Leave ${week.name}?`,
      message: alone ? 'You’re the only one here: the circle is deleted.' : isOwner ? 'The person who joined first after you becomes the owner.' : 'You can join again with a code.',
      confirmLabel: 'Leave',
    });
    if (yes)
      await run(async () => {
        await leaveCircle(client, week.id);
        router.replace('/circles');
      });
  };

  const removeCircle = async () => {
    if (!client || !week) return;
    const yes = await confirmAsync({ title: `Delete ${week.name}?`, message: 'The circle is gone for everyone. Hours stay on each phone.', confirmLabel: 'Delete the circle' });
    if (yes)
      await run(async () => {
        await deleteCircle(client, week.id);
        router.replace('/circles');
      });
  };

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

          {!week ? (
            error ? (
              <Text style={{ ...Type.body, color: Accent.amber, textAlign: 'center', marginTop: 40 }}>{error}</Text>
            ) : (
              <ActivityIndicator color={Surface.ink} style={{ marginTop: 40 }} />
            )
          ) : (
            <>
              <Text style={{ ...Type.meta, textAlign: 'center', marginTop: 8 }}>A circle for {week.pillar_label}</Text>
              <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center' }}>
                {week.name}
              </Text>

              <View style={{ ...card, marginTop: 18 }} accessibilityLabel={collectiveLabel(week)}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text style={{ ...Type.heading }}>This week, together</Text>
                  <Text style={{ ...Type.meta }}>since Mon {weekLabel}</Text>
                </View>
                <Text style={{ ...Type.hero, fontSize: 40, lineHeight: 46, marginTop: 4 }}>{hoursLabel(week.total_minutes)}</Text>
                <Text style={{ ...Type.body, marginBottom: 10 }}>
                  of {hoursLabel(week.weekly_target_minutes)} to {week.pillar_label}
                </Text>
                <ProgressBar progress={collectiveProgress(week)} color={Surface.ink} trackColor={Surface.hill} height={10} />
              </View>

              <View style={{ ...card, marginTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <Text style={{ ...Type.heading }}>{week.ranking_enabled ? 'This week’s ranking' : 'Everyone’s hours'}</Text>
                  <Text style={{ ...Type.meta }}>{week.ranking_enabled ? 'resets Monday' : `${week.members.length} of ${MAX_MEMBERS}`}</Text>
                </View>
                <View style={{ gap: 12 }}>
                  {week.members.map((m) => {
                    const who = m.display_name ?? 'Someone';
                    return (
                      <View
                        key={m.user_id}
                        accessibilityLabel={`${who}${m.is_me ? ' (you)' : ''}, ${memberHours(m, week.ranking_enabled)}, Flick ${stageName(m.flick_stage)}`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                      >
                        <Mascot mood="happy" size={40} bob={false} intensity={m.minutes > 0 ? 0.8 : 0.4} stage={m.flick_stage ?? 0} />
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 16 }}>
                            {who}
                            {m.is_me ? ' · you' : ''}
                            {m.role === 'owner' ? ' · owner' : ''}
                          </Text>
                          <Text style={{ ...Type.meta }}>Flick is a {stageName(m.flick_stage)}</Text>
                        </View>
                        <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 16 }}>{memberHours(m, week.ranking_enabled)}</Text>
                        {isOwner && !m.is_me ? (
                          <Pressable onPress={() => void remove(m.user_id, who)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${who}`}>
                            <Ionicons name="close-circle-outline" size={20} color={Surface.faint} />
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>

              {isOwner ? (
                <View style={{ ...card, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...Type.heading }}>Weekly ranking</Text>
                    <Text style={{ ...Type.meta, marginTop: 2 }}>{week.ranking_enabled ? 'On: everyone sees an order, from Monday to Sunday.' : 'Off: just everyone’s hours, no order.'}</Text>
                  </View>
                  <Switch on={week.ranking_enabled} onPress={() => void toggleRanking()} label="Weekly ranking" />
                </View>
              ) : null}

              <View style={{ ...card, marginTop: 12 }}>
                <Text style={{ ...Type.heading }}>Your hours here</Text>
                <Text style={{ ...Type.body, marginTop: 2 }}>{myPillarName ? `Your hours on ${myPillarName} count.` : 'Pick which of your pillars counts.'}</Text>
                {changingPillar || !myPillarName ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {pillars.map((p) => (
                      <Chip key={p.id} label={p.name} on={p.id === me?.pillar_id} onPress={() => void changePillar(p.id)} accessibilityLabel={`Count ${p.name}`} />
                    ))}
                  </View>
                ) : (
                  <Pressable onPress={() => setChangingPillar(true)} accessibilityRole="button" accessibilityLabel="Change my pillar" style={{ paddingTop: 10 }}>
                    <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>Change</Text>
                  </Pressable>
                )}
              </View>

              <View style={{ ...card, marginTop: 12 }}>
                <Text style={{ ...Type.meta }}>{created ? 'Your circle is ready. Invite your people:' : 'Invite code'}</Text>
                <Text accessibilityLabel={`Circle code ${week.invite_code}`} style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 30, letterSpacing: 4, marginTop: 4 }}>
                  {prettyCode(week.invite_code)}
                </Text>
                <View style={{ marginTop: 14 }}>
                  {full ? <Text style={{ ...Type.body }}>The circle is full ({MAX_MEMBERS} people).</Text> : <CTA label="Share the invite" onPress={() => void share()} disabled={busy} />}
                </View>
              </View>

              <Text style={{ ...Type.meta, textAlign: 'center', marginTop: 16 }}>Only hours on one pillar. Never tasks or notes.</Text>
              <Pressable onPress={() => void leave()} accessibilityRole="button" accessibilityLabel="Leave the circle" style={{ paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>Leave the circle</Text>
              </Pressable>
              {isOwner ? (
                <Pressable onPress={() => void removeCircle()} accessibilityRole="button" accessibilityLabel="Delete the circle" style={{ paddingVertical: 6, alignItems: 'center' }}>
                  <Text style={{ color: Accent.amber, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>Delete the circle</Text>
                </Pressable>
              ) : null}
              {error ? <Text style={{ ...Type.meta, color: Accent.amber, textAlign: 'center', marginTop: 14 }}>{error}</Text> : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
