import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('react-native-url-polyfill/auto', () => ({}));
const createClient = vi.fn((url: string, key: string, opts: unknown) => ({ url, key, opts, auth: { startAutoRefresh: vi.fn(), stopAutoRefresh: vi.fn() } }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } }));

const URL_ = 'https://abcdefghijklmnopqrst.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('supabase client (US-087)', () => {
  it('supabaseConfig: both values, trimmed', async () => {
    const { supabaseConfig } = await import('./supabase');
    expect(supabaseConfig({ EXPO_PUBLIC_SUPABASE_URL: ` ${URL_} `, EXPO_PUBLIC_SUPABASE_ANON_KEY: KEY })).toEqual({ url: URL_, anonKey: KEY });
  });

  it.each([
    [{}, 'nothing set'],
    [{ EXPO_PUBLIC_SUPABASE_URL: URL_ }, 'no key'],
    [{ EXPO_PUBLIC_SUPABASE_ANON_KEY: KEY }, 'no url'],
    [{ EXPO_PUBLIC_SUPABASE_URL: 'https://<project-ref>.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: '<anon key>' }, '.env.example placeholders'],
    [{ EXPO_PUBLIC_SUPABASE_URL: 'http://abc.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: KEY }, 'not https'],
  ])('supabaseConfig: null when %j (%s)', async (env, _label) => {
    const { supabaseConfig } = await import('./supabase');
    expect(supabaseConfig(env)).toBeNull();
  });

  it('no env: getSupabase() is null and the cloud is off (the app stays local-only)', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
    const m = await import('./supabase');
    expect(m.isCloudEnabled()).toBe(false);
    expect(m.getSupabase()).toBeNull();
    expect(() => m.startAutoRefresh(true)).not.toThrow();
  });

  it('with env: one shared client, its session kept under its own storage key', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', URL_);
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', KEY);
    const m = await import('./supabase');
    const c = m.getSupabase();
    expect(c).not.toBeNull();
    expect(m.getSupabase()).toBe(c);
    expect(m.isCloudEnabled()).toBe(true);
    expect(createClient).toHaveBeenCalledTimes(1);
    const [url, key, opts] = createClient.mock.calls[0] as unknown as [string, string, { auth: Record<string, unknown> }];
    expect([url, key]).toEqual([URL_, KEY]);
    expect(opts.auth).toMatchObject({ persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'intentional_auth_v1' });
    expect(opts.auth.storage).toBeDefined();
  });
});
