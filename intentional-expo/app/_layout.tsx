import '../global.css';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useRootNavigationState, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { LaunchIntro } from '@/components/flick/LaunchIntro';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import {
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';

import { useColorScheme } from '@/components/useColorScheme';
import { initDb, runMigrations, setSetting } from '@/db';
import * as api from '@/db/api';
import { syncHabits } from '@/services/habitSync';
import { isRuleBlockId } from '@/services/blockRules';
import { CelebrationHost } from '@/components/celebrate/CelebrationHost';
import * as AppBlocking from '@/services/appBlocking';
import { startAutoRefresh } from '@/services/supabase';
import { scheduleBackup } from '@/services/backup';
import { warmUpSounds } from '@/services/sounds';
import {
  LAST_RESPONSE_SETTING,
  addNotificationResponseListener,
  getLastNotificationResponse,
  processNotificationResponse,
  registerHabitCategory,
  snoozeHabitAlert,
  type NotificationResponseLike,
} from '@/services/notifications';

export { ErrorBoundary } from 'expo-router';

// expo-router 58 takes the initial route ("anchor") from here, not from a <Stack> prop.
export const unstable_settings = { anchor: 'index' };

SplashScreen.preventAutoHideAsync();

// Run synchronously before any child route renders.
// initDb creates all tables (idempotent); runMigrations applies any pending
// column/index changes tracked in the versioned migration list (US-007).
initDb();
runMigrations();

export default function RootLayout() {
  const router = useRouter();
  const [loaded, error] = useFonts({
    'InstrumentSerif-Regular': InstrumentSerif_400Regular,
    'InstrumentSerif-Italic': InstrumentSerif_400Regular_Italic,
    'Nunito-Medium': Nunito_500Medium,
    'Nunito-SemiBold': Nunito_600SemiBold,
    'Nunito-Bold': Nunito_700Bold,
    'Nunito-ExtraBold': Nunito_800ExtraBold,
    'Nunito-Black': Nunito_900Black,
    'IBMPlexMono-Regular': IBMPlexMono_400Regular,
    'IBMPlexMono-Medium': IBMPlexMono_500Medium,
    'IBMPlexMono-SemiBold': IBMPlexMono_600SemiBold,
  });
  const colorScheme = useColorScheme();
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  // US-130: the celebration jingles are loaded ahead of time, so the music starts the instant a moment comes
  useEffect(() => {
    void warmUpSounds();
  }, []);

  // US-075: buttons on habit alerts, and a fresh 7-day schedule at start and whenever the app comes back.
  useEffect(() => {
    void registerHabitCategory().then(() => syncHabits());
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void syncHabits(), 800);
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, []);

  // US-076: one handler for taps and buttons, deduped so a response never runs twice.
  const lastHandled = useRef<string | null>(null);
  const handleResponse = useCallback(
    (response: NotificationResponseLike) =>
      processNotificationResponse(response, {
        push: (href) => router.push(href as never),
        skipHabit: (id) => {
          api.skipHabit(id);
          AppBlocking.endActiveHabitBlock(id); // "Skip today" lifts a strict-mode block right away
        },
        snooze: snoozeHabitAlert,
        sync: syncHabits,
        canNavigate: () => api.getSetting('hasCompletedOnboarding') === '1',
        seen: () => lastHandled.current ?? api.getSetting(LAST_RESPONSE_SETTING),
        markSeen: (key) => {
          lastHandled.current = key;
          setSetting(LAST_RESPONSE_SETTING, key);
        },
      }),
    [router]
  );

  useEffect(() => addNotificationResponseListener((r) => void handleResponse(r)), [handleResponse]);

  // US-077: opening the app during a strict-mode window lands on that habit's session (auto-start flow).
  const handledStrictWindow = useRef<string | null>(null);
  const openActiveStrictHabit = useCallback(() => {
    if (api.getSetting('hasCompletedOnboarding') !== '1') return;
    // US-096: "Unlock with intention" was just tapped on a blocked app's screen → the unlock screen, not the session.
    if (AppBlocking.consumeUnlockRequest()) {
      router.push('/unlock?from=shield' as never);
      return;
    }
    const block = AppBlocking.getActiveHabitBlock();
    // A block-hours rule ("rule_<id>") has no habit to start.
    if (!block?.habitId || isRuleBlockId(block.habitId)) return;
    const key = `${block.habitId}|${block.since ?? ''}`;
    if (handledStrictWindow.current === key) return;
    handledStrictWindow.current = key;
    router.push(`/(tabs)/focus?actionId=${encodeURIComponent(block.habitId)}&autostart=1&ts=${Date.now()}` as never);
  }, [router]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') openActiveStrictHabit();
    });
    return () => sub.remove();
  }, [openActiveStrictHabit]);

  // US-088: refresh the account's token only while the app is in front (no-op without the cloud or on web).
  useEffect(() => {
    startAutoRefresh(AppState.currentState === 'active');
    // US-089: back up what changed while the app was away (signed in, phone already synced).
    scheduleBackup(3000);
    const sub = AppState.addEventListener('change', (state) => {
      startAutoRefresh(state === 'active');
      if (state === 'active') scheduleBackup(3000);
    });
    return () => sub.remove();
  }, []);

  // Cold start (app was killed) and button presses that arrived while JS wasn't running.
  const navReady = !!useRootNavigationState()?.key;
  const coldStartChecked = useRef(false);
  useEffect(() => {
    if (!navReady || coldStartChecked.current) return;
    coldStartChecked.current = true;
    // Let index.tsx redirect to Today first so Focus lands on top of it.
    setTimeout(() => {
      void getLastNotificationResponse().then((r) => {
        if (r) void handleResponse(r);
      });
    }, 300);
  }, [navReady, handleResponse]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="session-history" options={{ headerShown: true }} />
          <Stack.Screen name="goal/[id]" options={{ headerShown: true }} />
        </Stack>
        <CelebrationHost />
        {/* US-121: the launch moment over the app (once per cold start) */}
        <LaunchIntro ready={loaded} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
