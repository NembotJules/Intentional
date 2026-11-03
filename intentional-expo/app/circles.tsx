/**
 * US-091 · Circles: Settings → Your week → Circles (with the cloud), or the invite link intentional://circles?code=…
 *
 * - Your circles: each with "42 h of 50 h to Craft this week" → the circle (app/circle/[id].tsx).
 * - Create a circle: name, the pillar you share (label), a weekly target in hours, which of your pillars counts.
 * - Join with a code, choosing which of your pillars counts.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
import { useSession } from '@/services/useSession';
import { backupNow } from '@/services/backup';
import { weekStartOf } from '@/services/weekSummary';
import {
  MAX_MEMBERS,
  NAME_MAX,
  LABEL_MAX,
  circleFormError,
  cleanInviteCode,
  collectiveLabel,
  collectiveProgress,
  createCircle,
  friendlyCircleError,
  getMyCircles,
  joinCircle,
  prettyCode,
  suggestPillar,
  targetMinutes,
  type CircleSummary,
} from '@/services/circles';
import { CODE_LENGTH } from '@/services/witness';
import { localDayKey } from '@/utils/dates';
import { hapticSuccess } from '@/utils/haptics';

const card = { backgroundColor: Surface.surfaceRaised, borderRadius: 18, padding: 16 } as const;
const input = {
  backgroundColor: Surface.surfaceRaised,
  borderRadius: 16,
  paddingHorizontal: 16,
  height: 54,
  color: Surface.ink,
  fontFamily: FontFamily.bodySemiBold,
  fontSize: 17,
} as const;

function Label({ children }: { children: string }) {
  return <Text style={{ ...Type.meta, marginTop: 14, marginBottom: 6 }}>{children}</Text>;
}

function PillarChoice({ pillars, value, onChange }: { pillars: { id: string; name: string }[]; value: string | null; onChange: (id: string) => void }) {
  if (!pillars.length) return <Text style={{ ...Type.body }}>Add a pillar first, in Goals.</Text>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {pillars.map((p) => (
        <Chip key={p.id} label={p.name} on={value === p.id} onPress={() => onChange(p.id)} accessibilityLabel={`My pillar ${p.name}`} />
      ))}
    </View>
  );
}

export default function CirclesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const client = getSupabase();
  const { session, loading } = useSession();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/settings'));
  const weekStart = weekStartOf(localDayKey());
  const pillars = useMemo(() => api.getAllPillarsSync().filter((p) => !p.is_archived).map((p) => ({ id: p.id, name: p.name })), []);

  const [circles, setCircles] = useState<CircleSummary[] | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'join'>(params.code ? 'join' : 'list');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create
  const [name, setName] = useState('');
  const [label, setLabel] = useState(pillars[0]?.name ?? '');
  const [hours, setHours] = useState('10');
  const [pillarId, setPillarId] = useState<string | null>(pillars[0]?.id ?? null);
  const [pillarTouched, setPillarTouched] = useState(false);
  // Join
  const [code, setCode] = useState(cleanInviteCode(params.code ?? ''));
  const [joinPillar, setJoinPillar] = useState<string | null>(pillars[0]?.id ?? null);

  useEffect(() => {
    if (params.code) {
      setCode(cleanInviteCode(params.code));
      setMode('join');
    }
  }, [params.code]);

  const load = useCallback(async () => {
    if (!client || !session) return;
    try {
      setCircles(await getMyCircles(client, weekStart));
    } catch (e) {
      setError(friendlyCircleError(e));
    }
  }, [client, session, weekStart]);
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

  const onLabel = (v: string) => {
    setLabel(v);
    if (!pillarTouched) setPillarId(suggestPillar(v, pillars)?.id ?? null);
  };

  const form = { name, label, targetHours: hours, pillarId };
  const formError = circleFormError(form);

  const create = () =>
    run(async () => {
      if (!client || formError) return;
      // The circle counts your backed-up hours: make sure the pillar and this week's sessions are there.
      await backupNow().catch(() => null);
      const made = await createCircle(client, { name, label, targetMinutes: targetMinutes(hours), pillarId: pillarId! });
      hapticSuccess();
      setMode('list');
      setName('');
      router.push({ pathname: '/circle/[id]', params: { id: made.id, created: '1' } });
    });

  const join = () =>
    run(async () => {
      if (!client || !joinPillar) return;
      await backupNow().catch(() => null);
      const id = await joinCircle(client, code, joinPillar);
      hapticSuccess();
      setCode('');
      setMode('list');
      router.push({ pathname: '/circle/[id]', params: { id } });
    });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
            <Pressable
              onPress={mode === 'list' ? back : () => setMode('list')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-back" size={22} color={Surface.ink} />
            </Pressable>
            <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 14 }}>
              <Mascot mood="wave" size={100} intensity={0.7} />
            </View>
            <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center' }}>
              {mode === 'create' ? 'A new circle' : mode === 'join' ? 'Join a circle' : 'Circles'}
            </Text>
            <Text style={{ ...Type.body, textAlign: 'center', marginTop: 8 }}>
              A small group around one pillar, up to {MAX_MEMBERS} people. You see each other’s hours on it every week. Never tasks or notes.
            </Text>

            {!client ? (
              <Text style={{ ...Type.meta, textAlign: 'center', marginTop: 20 }}>Circles aren’t set up in this version of the app.</Text>
            ) : loading ? (
              <ActivityIndicator color={Surface.ink} style={{ marginTop: 24 }} />
            ) : !session ? (
              <View style={{ marginTop: 22 }}>
                <Text style={{ ...Type.body, textAlign: 'center', marginBottom: 14 }}>A circle needs an account.</Text>
                <CTA label="Sign in" onPress={() => router.push('/account')} />
              </View>
            ) : mode === 'create' ? (
              <View style={{ marginTop: 10 }}>
                <Label>Name</Label>
                <TextInput value={name} onChangeText={setName} placeholder="Morning makers" placeholderTextColor={Surface.faint} maxLength={NAME_MAX} accessibilityLabel="Circle name" style={input} />
                <Label>The pillar you share</Label>
                <TextInput value={label} onChangeText={onLabel} placeholder="Craft" placeholderTextColor={Surface.faint} maxLength={LABEL_MAX} accessibilityLabel="Shared pillar" style={input} />
                <Label>Hours a week, all together</Label>
                <TextInput value={hours} onChangeText={(v) => setHours(v.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" accessibilityLabel="Weekly target hours" style={input} />
                <Label>Which of your pillars counts</Label>
                <PillarChoice
                  pillars={pillars}
                  value={pillarId}
                  onChange={(id) => {
                    setPillarId(id);
                    setPillarTouched(true);
                  }}
                />
                <View style={{ marginTop: 22 }}>
                  <CTA label={busy ? 'Creating…' : 'Create the circle'} disabled={busy || !!formError} onPress={() => void create()} />
                </View>
                {formError && name.trim() ? <Text style={{ ...Type.meta, textAlign: 'center', marginTop: 10 }}>{formError}</Text> : null}
              </View>
            ) : mode === 'join' ? (
              <View style={{ marginTop: 10 }}>
                <Label>The code</Label>
                <TextInput
                  value={prettyCode(code)}
                  onChangeText={(v) => {
                    setCode(cleanInviteCode(v));
                    if (error) setError(null);
                  }}
                  placeholder="ABCD 2345"
                  placeholderTextColor={Surface.faint}
                  accessibilityLabel="Circle code"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={CODE_LENGTH + 1}
                  style={{ ...input, fontFamily: FontFamily.bodyBold, fontSize: 20, letterSpacing: 3 }}
                />
                <Label>Which of your pillars counts</Label>
                <PillarChoice pillars={pillars} value={joinPillar} onChange={setJoinPillar} />
                <View style={{ marginTop: 22 }}>
                  <CTA label={busy ? 'Joining…' : 'Join'} disabled={busy || code.length !== CODE_LENGTH || !joinPillar} onPress={() => void join()} />
                </View>
              </View>
            ) : circles === null && !error ? (
              <ActivityIndicator color={Surface.ink} style={{ marginTop: 24 }} />
            ) : (
              <>
                <View style={{ gap: 10, marginTop: 22 }}>
                  {(circles ?? []).map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => router.push({ pathname: '/circle/[id]', params: { id: c.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={`Circle ${c.name}`}
                      style={card}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ flex: 1, ...Type.heading }} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={{ ...Type.meta }}>
                          {c.member_count} {c.member_count === 1 ? 'person' : 'people'}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color={Surface.faint} />
                      </View>
                      <Text style={{ ...Type.body, marginTop: 4, marginBottom: 10 }}>{collectiveLabel(c)}</Text>
                      <ProgressBar progress={collectiveProgress(c)} color={Surface.ink} trackColor={Surface.hill} height={8} />
                    </Pressable>
                  ))}
                  {circles?.length === 0 ? <Text style={{ ...Type.body, textAlign: 'center' }}>No circle yet. Start one, or join with a code.</Text> : null}
                </View>
                <View style={{ marginTop: 22, gap: 4 }}>
                  <CTA label="Create a circle" onPress={() => setMode('create')} />
                  <Pressable onPress={() => setMode('join')} accessibilityRole="button" accessibilityLabel="Join with a code" style={{ paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 16 }}>Join with a code</Text>
                  </Pressable>
                </View>
              </>
            )}

            {error ? <Text style={{ ...Type.meta, color: Accent.amber, textAlign: 'center', marginTop: 14 }}>{error}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
