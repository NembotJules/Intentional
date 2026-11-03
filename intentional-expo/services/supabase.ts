/**
 * US-087 · The Supabase client (cloud-additive; the app is local-first).
 *
 * Created lazily, only when `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set (intentional-expo/.env,
 * git-ignored). Without them `getSupabase()` returns null and every cloud feature stays hidden: the app runs offline
 * and without an account. The auth session is kept in AsyncStorage (localStorage on web).
 * The service-role key never belongs here: it's only for admin/test scripts (scripts/test-rls.mjs).
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from '@/types/supabase';

export type Supa = SupabaseClient<Database>;

let client: Supa | null | undefined;

/** The env values, trimmed; null when either is missing (or a placeholder). */
export function supabaseConfig(env: Record<string, string | undefined> = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
}): { url: string; anonKey: string } | null {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
  if (!/^https:\/\/[^\s/]+$/.test(url) || anonKey.length < 20) return null;
  return { url, anonKey };
}

export function isCloudEnabled(): boolean {
  return supabaseConfig() !== null;
}

/** The shared client, or null when the cloud isn't configured. */
export function getSupabase(): Supa | null {
  if (client !== undefined) return client;
  const cfg = supabaseConfig();
  client = cfg
    ? createClient<Database>(cfg.url, cfg.anonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          // Email one-time codes, not links: nothing to read from the URL.
          detectSessionInUrl: false,
          storageKey: 'intentional_auth_v1',
        },
      })
    : null;
  return client;
}

/** Native apps refresh tokens only while in the foreground (Supabase's recommendation for React Native). */
export function startAutoRefresh(active: boolean): void {
  const c = getSupabase();
  if (!c || Platform.OS === 'web') return;
  if (active) void c.auth.startAutoRefresh();
  else void c.auth.stopAutoRefresh();
}
