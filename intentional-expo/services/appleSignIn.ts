/**
 * US-088 · Sign in with Apple (iOS). The Apple identity token is exchanged for a Supabase session.
 * Off until `APPLE_SIGN_IN_ENABLED` (services/account.ts): the Supabase Apple provider needs the founder's
 * Apple Developer Team ID, Key ID and .p8 key, and the iOS build needs `ios.usesAppleSignIn: true`.
 */
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { Supa } from '@/services/supabase';

export async function appleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  const Apple = await import('expo-apple-authentication');
  return Apple.isAvailableAsync();
}

/** Null when the person cancels the Apple sheet. */
export async function signInWithApple(client: Supa): Promise<Session | null> {
  const Apple = await import('expo-apple-authentication');
  try {
    const cred = await Apple.signInAsync({
      requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
    });
    if (!cred.identityToken) throw new Error('No identity token from Apple.');
    const { data, error } = await client.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
    if (error) throw error;
    return data.session;
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
}
