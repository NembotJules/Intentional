import '../global.css';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useRootNavigationState, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import {
  SourceSans3_400Regular,
  SourceSans3_500Medium,
  SourceSans3_600SemiBold,
  SourceSans3_700Bold,
} from '@expo-google-fonts/source-sans-3';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';

import { useColorScheme } from '@/components/useColorScheme';
import { initDb, runMigrations, setSetting } from '@/db';
import * as api from '@/db/api';
import { syncHabits } from '@/services/habitSync';
import * as AppBlocking from '@/services/appBlocking';
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
    'SourceSans3-Regular': SourceSans3_400Regular,
    'SourceSans3-Medium': SourceSans3_500Medium,
    'SourceSans3-SemiBold': SourceSans3_600SemiBold,
    'SourceSans3-Bold': SourceSans3_700Bold,
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
    const block = AppBlocking.getActiveHabitBlock();
    if (!block?.habitId) return;
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
        <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="session-history" options={{ headerShown: true }} />
          <Stack.Screen name="goal/[id]" options={{ headerShown: true }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
