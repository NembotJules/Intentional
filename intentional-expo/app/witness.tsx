/**
 * US-090 · Witness: Settings → Your week → Witness (with the cloud), or the invite link intentional://witness?code=…
 *
 * - Your witness: invite one person (code + share sheet), see who it is, end it.
 * - You witness: the people who chose you → their week (app/witnessing/[owner].tsx).
 * - Got a code? Accept it (needs an account).
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { CTA } from '@/components/onboarding/parts';
import { Mascot } from '@/components/onboarding/Mascot';
import { Accent, FontFamily, Surface, Type } from '@/constants/design';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/services/useSession';
import { backupNow } from '@/services/backup';
import { ensureProfile } from '@/services/account';
import {
  CODE_LENGTH,
  acceptInvite,
  cleanInviteCode,
  createInvite,
  endLink,
  friendlyWitnessError,
  getLinks,
  inviteMessage,
  prettyCode,
  type WitnessLink,
} from '@/services/witness';
import { confirmAsync } from '@/utils/confirm';
import { hapticSuccess } from '@/utils/haptics';
import { shareText } from '@/utils/shareCard';

const inputStyle = {
  backgroundColor: Surface.surfaceRaised,
  borderRadius: 16,
  paddingHorizontal: 16,
  height: 54,
  color: Surface.ink,
  fontFamily: FontFamily.bodyBold,
  fontSize: 20,
  letterSpacing: 3,
} as const;

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name="chevron-back" size={22} color={Surface.ink} />
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 26 }}>
      <Text accessibilityRole="header" style={{ ...Type.heading, fontSize: 20, lineHeight: 26, marginBottom: 10 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const card = { backgroundColor: Surface.surfaceRaised, borderRadius: 18, padding: 16 } as const;

export default function WitnessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const client = getSupabase();
  const { session, loading } = useSession();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/progress'));

  const [links, setLinks] = useState<WitnessLink[] | null>(null);
  const [code, setCode] = useState(cleanInviteCode(params.code ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client || !session) return;
    try {
      // The other side sees your profile's name: make sure it exists (sign-in may have been left before it was saved).
      await ensureProfile(client, session.user, api.getSetting('user_name'), api.getFlickState().stage.index).catch(() => {});
      setLinks(await getLinks(client));
    } catch (e) {
      setError(friendlyWitnessError(e));
    }
  }, [client, session]);

  useEffect(() => {
    void load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(friendlyWitnessError(e));
    } finally {
      setBusy(false);
    }
  };

  const mine = links?.find((l) => l.role === 'owner') ?? null;
  const witnessing = links?.filter((l) => l.role === 'witness') ?? [];
  const pillars = useCallback(() => api.getAllPillarsSync().filter((p) => !p.is_archived).map((p) => p.name), []);

  const share = async (inviteCode: string) => {
    await shareText(inviteMessage({ userName: api.getSetting('user_name'), code: inviteCode, pillars: pillars() }), 'Be my witness');
  };

  const invite = () =>
    run(async () => {
      if (!client) return;
      // They'll see your last backup: make sure it's there.
      await backupNow().catch(() => null);
      const c = await createInvite(client);
      await load();
      hapticSuccess();
      await share(c);
    });

  const accept = () =>
    run(async () => {
      if (!client) return;
      await acceptInvite(client, code);
      setCode('');
      hapticSuccess();
      setNotice('You’re their witness now.');
      await load();
    });

  const end = async (l: WitnessLink) => {
    if (!client) return;
    const yes = await confirmAsync({
      title: l.status === 'pending' ? 'Cancel the invite?' : l.role === 'owner' ? `End ${l.other_name ?? 'your witness'}’s witnessing?` : `Stop witnessing ${l.other_name ?? 'them'}?`,
      message: l.status === 'pending' ? 'The code stops working.' : 'You can choose again anytime.',
      confirmLabel: l.status === 'pending' ? 'Cancel invite' : 'End it',
    });
    if (yes)
      await run(async () => {
        await endLink(client, l.id);
        await load();
      });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
            <BackButton onPress={back} />
            <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 14 }}>
              <Mascot mood="wave" size={100} intensity={0.7} />
            </View>
            <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center' }}>
              A witness
            </Text>
            <Text style={{ ...Type.body, textAlign: 'center', marginTop: 8 }}>
              One person who sees your commitment: your pillars and goals, Flick, the hours you give each week and how your goals are going. Never your tasks or notes.
            </Text>

            {!client ? (
              <Text style={{ ...Type.meta, textAlign: 'center', marginTop: 20 }}>Witnesses aren’t set up in this version of the app.</Text>
            ) : loading ? (
              <ActivityIndicator color={Surface.ink} style={{ marginTop: 24 }} />
            ) : !session ? (
              <View style={{ marginTop: 22 }}>
                <Text style={{ ...Type.body, textAlign: 'center', marginBottom: 14 }}>A witness needs an account, on both sides.</Text>
                <CTA label="Sign in" onPress={() => router.push('/account')} />
              </View>
            ) : links === null && !error ? (
              <ActivityIndicator color={Surface.ink} style={{ marginTop: 24 }} />
            ) : (
              <>
                <Section title="Your witness">
                  {mine?.status === 'active' ? (
                    <View style={card} accessibilityLabel={`Your witness: ${mine.other_name ?? ''}`}>
                      <Text style={{ ...Type.heading }}>{mine.other_name ? `${mine.other_name} is your witness` : 'Your witness accepted'}</Text>
                      <Text style={{ ...Type.meta, marginTop: 4 }}>They see your week after each backup.</Text>
                      <Pressable onPress={() => void end(mine)} accessibilityRole="button" accessibilityLabel="End witnessing" style={{ paddingTop: 12 }}>
                        <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>End it</Text>
                      </Pressable>
                    </View>
                  ) : mine?.status === 'pending' && mine.invite_code ? (
                    <View style={card}>
                      <Text style={{ ...Type.meta }}>Your invite code</Text>
                      <Text accessibilityLabel={`Invite code ${mine.invite_code}`} style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 30, letterSpacing: 4, marginTop: 4 }}>
                        {prettyCode(mine.invite_code)}
                      </Text>
                      <Text style={{ ...Type.meta, marginTop: 6 }}>Waiting for them to accept it in their app.</Text>
                      <View style={{ marginTop: 14 }}>
                        <CTA label="Share the invite" onPress={() => void share(mine.invite_code!)} disabled={busy} />
                      </View>
                      <Pressable onPress={() => void end(mine)} accessibilityRole="button" accessibilityLabel="Cancel the invite" style={{ paddingTop: 12, alignItems: 'center' }}>
                        <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>Cancel the invite</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <CTA label={busy ? 'Creating…' : 'Invite a witness'} onPress={() => void invite()} disabled={busy} />
                  )}
                </Section>

                <Section title="You witness">
                  {witnessing.length === 0 ? (
                    <Text style={{ ...Type.body }}>Nobody yet. When someone sends you a code, enter it below.</Text>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {witnessing.map((l) => (
                        <Pressable
                          key={l.id}
                          onPress={() => router.push({ pathname: '/witnessing/[owner]', params: { owner: l.other_id ?? '', link: l.id, name: l.other_name ?? '' } })}
                          accessibilityRole="button"
                          accessibilityLabel={`See ${l.other_name ?? 'their'} week`}
                          style={{ ...card, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                        >
                          <Ionicons name="eye-outline" size={20} color={Surface.ink} />
                          <Text style={{ flex: 1, ...Type.heading }}>{l.other_name ?? 'Someone'}</Text>
                          <Ionicons name="chevron-forward" size={18} color={Surface.faint} />
                        </Pressable>
                      ))}
                    </View>
                  )}
                </Section>

                <Section title="Got a code?">
                  <TextInput
                    value={prettyCode(code)}
                    onChangeText={(v) => {
                      setCode(cleanInviteCode(v));
                      if (error) setError(null);
                    }}
                    placeholder="ABCD 2345"
                    placeholderTextColor={Surface.faint}
                    accessibilityLabel="Witness code"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={CODE_LENGTH + 1}
                    style={inputStyle}
                  />
                  <View style={{ marginTop: 12 }}>
                    <CTA label={busy ? 'Accepting…' : 'Accept'} disabled={busy || code.length !== CODE_LENGTH} onPress={() => void accept()} />
                  </View>
                </Section>
              </>
            )}

            {notice ? <Text style={{ ...Type.meta, color: Accent.green, textAlign: 'center', marginTop: 14 }}>{notice}</Text> : null}
            {error ? <Text style={{ ...Type.meta, color: Accent.amber, textAlign: 'center', marginTop: 14 }}>{error}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
