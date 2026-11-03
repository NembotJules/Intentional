/**
 * US-088 · Account (optional): Settings → Account.
 *
 * Signed out: email → "Send me a code" → the 8-digit code → signed in (profile created from the onboarding name).
 * Signed in: the email, the name others will see, Sign out (local data stays), Delete account (server data and the
 * account go; local data stays). Sign in with Apple shows on iOS once the Apple provider is configured.
 * US-089: the Backup card (back up now, restore; a new phone is offered its backup first).
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { CTA } from '@/components/onboarding/parts';
import { Mascot } from '@/components/onboarding/Mascot';
import { Accent, FontFamily, Surface, Type } from '@/constants/design';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/services/useSession';
import {
  APPLE_SIGN_IN_ENABLED,
  CODE_MAX,
  cleanCode,
  deleteAccount,
  ensureProfile,
  friendlyAuthError,
  getProfile,
  isValidCode,
  isValidEmail,
  normalizeEmail,
  sendCode,
  signOut,
  updateDisplayName,
  verifyCode,
} from '@/services/account';
import { signInWithApple, appleSignInAvailable } from '@/services/appleSignIn';
import { confirmAsync } from '@/utils/confirm';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackupCard } from '@/components/account/BackupCard';
import { ONBOARDING_DRAFT_STORAGE_KEY } from '@/constants/onboardingDraft';
import { hapticSuccess } from '@/utils/haptics';

const inputStyle = {
  backgroundColor: Surface.surfaceRaised,
  borderRadius: 16,
  paddingHorizontal: 16,
  height: 54,
  color: Surface.ink,
  fontFamily: FontFamily.bodySemiBold,
  fontSize: 17,
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

function TextLink({ label, onPress, color = Surface.muted }: { label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ paddingVertical: 12, alignItems: 'center' }}>
      <Text style={{ color, fontFamily: FontFamily.bodyBold, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export default function AccountScreen() {
  const router = useRouter();
  const client = getSupabase();
  const { session, loading } = useSession();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/settings'));

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [appleOk, setAppleOk] = useState(false);
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');

  useEffect(() => {
    if (APPLE_SIGN_IN_ENABLED) void appleSignInAvailable().then(setAppleOk);
  }, []);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!client || !userId) return;
    let live = true;
    void getProfile(client, userId)
      .then((p) => {
        if (live && p) {
          setName(p.display_name);
          setSavedName(p.display_name);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [client, userId]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const afterSignIn = async (user: { id: string; email?: string }) => {
    if (!client) return;
    await ensureProfile(client, user, api.getSetting('user_name'), api.getFlickState().stage.index);
    // The profile may have just been created: show its name now (the load on sign-in can run before the insert).
    const p = await getProfile(client, user.id);
    if (p) {
      setName(p.display_name);
      setSavedName(p.display_name);
    }
    hapticSuccess();
    setStep('email');
    setCode('');
  };

  const send = () =>
    run(async () => {
      if (!client) return;
      await sendCode(client, email);
      setStep('code');
      setNotice(`We sent a code to ${normalizeEmail(email)}.`);
    });

  const verify = () =>
    run(async () => {
      if (!client) return;
      const s = await verifyCode(client, email, code);
      await afterSignIn(s.user);
    });

  const apple = () =>
    run(async () => {
      if (!client) return;
      const s = await signInWithApple(client);
      if (s) await afterSignIn(s.user);
    });

  const saveName = () =>
    run(async () => {
      if (!client || !userId || name.trim() === savedName) return;
      const n = await updateDisplayName(client, userId, name);
      setName(n);
      setSavedName(n);
      setNotice('Name saved.');
    });

  const doSignOut = async () => {
    if (!client) return;
    const yes = await confirmAsync({
      title: 'Sign out?',
      message: 'Everything stays on this phone. Sign in again anytime.',
      confirmLabel: 'Sign out',
    });
    if (yes) await run(() => signOut(client));
  };

  const doDelete = async () => {
    if (!client) return;
    const yes = await confirmAsync({
      title: 'Delete your account?',
      message: 'Your account and everything stored with it on our server are deleted for good. What’s on this phone stays.',
      confirmLabel: 'Delete account',
      destructive: true,
    });
    if (yes) await run(async () => {
      await deleteAccount(client);
      setNotice('Your account is deleted. Everything on this phone is still here.');
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
            <BackButton onPress={back} />

            <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 18 }}>
              <Mascot mood={session ? 'proud' : 'wave'} size={110} intensity={0.7} />
            </View>
            <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center' }}>
              {session ? 'Your account' : 'An account, if you want one'}
            </Text>
            <Text style={{ ...Type.body, textAlign: 'center', marginTop: 8, marginBottom: 24 }}>
              {session
                ? 'Signed in. Your hours still live on this phone first.'
                : 'Optional. Sign in with your email. Signing out or deleting the account never touches what’s on this phone.'}
            </Text>

            {!client ? (
              <Text style={{ ...Type.meta, textAlign: 'center' }}>Accounts aren’t set up in this version of the app.</Text>
            ) : loading ? (
              <ActivityIndicator color={Surface.ink} />
            ) : session ? (
              <View>
                <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: 18, padding: 16 }}>
                  <Text style={{ ...Type.meta }}>Signed in as</Text>
                  <Text accessibilityLabel={`Signed in as ${session.user.email ?? ''}`} style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 17, marginTop: 2 }}>
                    {session.user.email ?? 'Apple ID'}
                  </Text>
                </View>

                <BackupCard
                  userId={session.user.id}
                  onRestored={() => {
                    // The account's data is on the phone now (onboarding included): go to Today.
                    void AsyncStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
                    setTimeout(() => router.replace('/(tabs)/today'), 600);
                  }}
                />

                <Text style={{ ...Type.heading, marginTop: 22, marginBottom: 4 }}>Your name</Text>
                <Text style={{ ...Type.meta, marginBottom: 8 }}>What your witness will see. Only your name and hours, never your tasks.</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onBlur={() => void saveName()}
                  onSubmitEditing={() => void saveName()}
                  accessibilityLabel="Account name"
                  maxLength={30}
                  returnKeyType="done"
                  style={inputStyle}
                />

                <View style={{ marginTop: 26 }}>
                  <CTA label="Sign out" onPress={() => void doSignOut()} disabled={busy} />
                </View>
                <TextLink label="Delete account" color={Accent.red} onPress={() => void doDelete()} />
              </View>
            ) : step === 'email' ? (
              <View>
                <Text style={{ ...Type.heading, marginBottom: 8 }}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    if (error) setError(null);
                  }}
                  placeholder="you@example.com"
                  placeholderTextColor={Surface.faint}
                  accessibilityLabel="Email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  returnKeyType="send"
                  onSubmitEditing={() => isValidEmail(email) && void send()}
                  style={inputStyle}
                />
                <View style={{ marginTop: 18 }}>
                  <CTA label={busy ? 'Sending…' : 'Send me a code'} disabled={busy || !isValidEmail(email)} onPress={() => void send()} />
                </View>
                {APPLE_SIGN_IN_ENABLED && appleOk ? (
                  <View style={{ marginTop: 10 }}>
                    <CTA label="Continue with Apple" onPress={() => void apple()} disabled={busy} />
                  </View>
                ) : null}
              </View>
            ) : (
              <View>
                <Text style={{ ...Type.heading, marginBottom: 8 }}>The code from the email</Text>
                <TextInput
                  value={code}
                  onChangeText={(v) => {
                    setCode(cleanCode(v));
                    if (error) setError(null);
                  }}
                  placeholder="12345678"
                  placeholderTextColor={Surface.faint}
                  accessibilityLabel="Code"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={CODE_MAX}
                  returnKeyType="done"
                  onSubmitEditing={() => isValidCode(code) && void verify()}
                  style={{ ...inputStyle, letterSpacing: 4, fontFamily: FontFamily.bodyBold, fontSize: 22 }}
                />
                <View style={{ marginTop: 18 }}>
                  <CTA label={busy ? 'Checking…' : 'Sign in'} disabled={busy || !isValidCode(code)} onPress={() => void verify()} />
                </View>
                <TextLink label="Send a new code" onPress={() => void send()} />
                <TextLink
                  label="Use a different email"
                  onPress={() => {
                    setStep('email');
                    setCode('');
                    setNotice(null);
                    setError(null);
                  }}
                />
              </View>
            )}

            {notice ? <Text style={{ ...Type.meta, color: Surface.ink, textAlign: 'center', marginTop: 14 }}>{notice}</Text> : null}
            {error ? <Text style={{ ...Type.meta, color: Accent.amber, textAlign: 'center', marginTop: 14 }}>{error}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
