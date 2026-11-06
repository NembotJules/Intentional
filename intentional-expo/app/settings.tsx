/**
 * US-102 · Settings, and only settings (founder 2026-11-06). Opened from the gear on Today and Goals.
 *   Account (your name; the optional account, US-088) · Notifications (heads-up US-075, Sunday reminder US-082)
 *   · Flick's worlds (US-101) · Your data (CSV US-044, replay onboarding US-053, delete all US-045) · Help & about.
 * Moved out: the habits list (→ Goals), blocking (→ Block), your week, partner and witness (→ Progress).
 */
import { useCallback, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { ONBOARDING_DRAFT_STORAGE_KEY } from '@/constants/onboardingDraft';
import { setSetting, getSetting } from '@/db';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { localDayKey } from '@/utils/dates';
import { Accent, FontFamily, Surface, Type } from '@/constants/design';
import { CTA } from '@/components/onboarding/parts';
import { Mascot } from '@/components/onboarding/Mascot';
import { Card as KitCard } from '@/components/ui/kit';
import { worldTheme } from '@/services/worldThemes';
import { getSelectedWorld } from '@/services/worldChoice';
import Constants from 'expo-constants';
import {
  requestNotificationPermissions,
  cancelAllScheduledNotifications,
  HEADS_UP_SETTING,
} from '@/services/notifications';
import { RITUAL_REMINDER_SETTING, RITUAL_TIME_SETTING, RITUAL_TIMES, isRitualReminderOn, ritualTime } from '@/services/ritual';
import { syncHabits } from '@/services/habitSync';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { isCloudEnabled } from '@/services/supabase';
import { useSession } from '@/services/useSession';


// ─── Building blocks: bold section titles, sand cards, icon rows ──────────────
function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginTop: 30, marginBottom: 12 }}>
      <Text accessibilityRole="header" style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 20, lineHeight: 26 }}>
        {title}
      </Text>
      {sub ? (
        <Text style={{ color: Surface.muted, fontFamily: FontFamily.body, fontSize: 15, lineHeight: 21, marginTop: 3 }}>{sub}</Text>
      ) : null}
    </View>
  );
}

function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <KitCard style={[{ padding: 0, overflow: 'hidden' }, style]}>{children}</KitCard>;
}

function IconTile({ name, color = Surface.ink, bg = Surface.surfaceRaised }: { name: keyof typeof Ionicons.glyphMap; color?: string; bg?: string }) {
  return (
    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={19} color={color} />
    </View>
  );
}

function Row({
  icon,
  iconColor,
  iconBg,
  label,
  sub,
  labelColor = Surface.ink,
  right,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  label: string;
  sub?: string;
  labelColor?: string;
  right?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const body = (
    <>
      {icon ? <IconTile name={icon} color={iconColor} bg={iconBg} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: labelColor, fontFamily: FontFamily.bodySemiBold, fontSize: 17, lineHeight: 22 }} numberOfLines={2}>
          {label}
        </Text>
        {sub ? <Text style={{ color: Surface.muted, fontFamily: FontFamily.body, fontSize: 14, lineHeight: 19, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      {right}
    </>
  );
  const rowStyle: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingHorizontal: 16, paddingVertical: 11 };
  if (!onPress) return <View style={rowStyle}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[rowStyle, { backgroundColor: 'transparent' }]}
    >
      {body}
    </Pressable>
  );
}

const Chevron = () => <Ionicons name="chevron-forward" size={18} color={Surface.faint} />;

// ─── Divider inside a card ────────────────────────────────────────────────────
const Divider = ({ inset = 66 }: { inset?: number }) => (
  <View style={{ height: 1, backgroundColor: Surface.rule, marginLeft: inset }} />
);

/** Ink pill switch. */
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
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: Surface.surface,
          transform: [{ translateX: on ? 20 : 0 }],
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
        }}
      />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { session } = useSession();
  const cloud = isCloudEnabled();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Your name
  const [userName, setUserName] = useState('');
  const [userNameDraft, setUserNameDraft] = useState('');

  // US-036/082: Sunday ritual reminder (on by default)
  const [reviewReminderOn, setReviewReminderOn] = useState(true);
  const [ritualTimeValue, setRitualTimeValue] = useState('18:00');
  const [worldName, setWorldName] = useState(() => worldTheme(getSelectedWorld()).name);

  // US-075: optional 10-minute heads-up before each habit
  const [headsUpOn, setHeadsUpOn] = useState(false);

  // US-045 — delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  const load = useCallback(async () => {
    const name = api.getSetting('user_name') ?? '';
    setUserName(name);
    setUserNameDraft(name);
    setReviewReminderOn(isRitualReminderOn());
    setWorldName(worldTheme(getSelectedWorld()).name);
    const t = ritualTime();
    setRitualTimeValue(`${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`);
    setHeadsUpOn(api.getSetting(HEADS_UP_SETTING) === '1');
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // ── US-075: heads-up before a habit ─────────────────────────────────────────
  const toggleHeadsUp = () => {
    const next = !headsUpOn;
    setSetting(HEADS_UP_SETTING, next ? '1' : '0');
    setHeadsUpOn(next);
    void syncHabits();
  };

  // ── US-036/082: Sunday ritual reminder ───────────────────────────────────
  const toggleReviewReminder = async () => {
    if (reviewReminderOn) {
      setSetting(RITUAL_REMINDER_SETTING, '0');
      setReviewReminderOn(false);
    } else {
      const granted = await requestNotificationPermissions();
      setSetting(RITUAL_REMINDER_SETTING, '1');
      setReviewReminderOn(true);
      if (!granted && Platform.OS !== 'web') {
        Alert.alert('Notifications are off', 'Allow notifications for Intentional in Settings to get the Sunday reminder.');
      }
    }
    void syncHabits(); // schedules or cancels the weekly reminder
  };

  const pickRitualTime = (value: string) => {
    setSetting(RITUAL_TIME_SETTING, value);
    setRitualTimeValue(value);
    void syncHabits();
  };

  // ── US-044: CSV export ────────────────────────────────────────────────────
  const handleExportCsv = async () => {
    const rows = api.getAllSessionsCsvRows();
    if (rows.length === 0) {
      Alert.alert('Nothing to export', 'Log at least one focus session first.');
      return;
    }
    const csv = api.buildCsvString(rows);
    const filename = `intentional-sessions-${localDayKey()}.csv`;
    const fileUri = (FileSystem.cacheDirectory ?? '') + filename;
    await FileSystem.writeAsStringAsync(fileUri, csv);
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Sharing not available', 'This device does not support the share sheet.');
      return;
    }
    await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export sessions CSV' });
  };

  // ── US-045 ────────────────────────────────────────────────────────────────
  const handleDeleteAll = async () => {
    if (deleteInput !== 'DELETE') return;
    // Reminders for deleted actions would otherwise keep firing.
    await cancelAllScheduledNotifications();
    api.deleteAllData();
    void syncHabits(); // no habits left: clears habit alerts and app-blocking windows
    setShowDeleteModal(false);
    setDeleteInput('');
    setSetting('hasCompletedOnboarding', '0');
    try {
      await AsyncStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    router.replace('/');
  };

  const bottomPad = Math.max(insets.bottom, 16) + 32;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/today'));

  const confirmReplayOnboarding = () =>
    Alert.alert(
      'Show onboarding again?',
      'Your SQLite data (goals, sessions) is kept. The onboarding-complete flag and any saved onboarding draft (AsyncStorage) are cleared so you start at the welcome screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: async () => {
            setSetting('hasCompletedOnboarding', '0');
            try {
              await AsyncStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
            } catch {
              /* ignore */
            }
            router.replace('/');
          },
        },
      ]
    );

  const saveName = () => {
    const trimmed = userNameDraft.trim();
    setSetting('user_name', trimmed);
    setUserName(trimmed);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerShown: false,
          headerStyle: { backgroundColor: Surface.canvas },
          headerTintColor: Surface.ink,
          headerTitleStyle: { color: Surface.ink, fontFamily: FontFamily.bodyBold },
          headerShadowVisible: false,
        }}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: bottomPad }}>
        <Pressable
          onPress={back}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: Surface.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft size={22} color={Surface.ink} strokeWidth={2.4} />
        </Pressable>

        {/* Flick, at home in the world you chose */}
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <Mascot mood="happy" size={92} intensity={0.75} />
          </View>
          <Text accessibilityRole="header" style={{ ...Type.title, marginTop: 10 }}>
            Settings
          </Text>
        </View>

        {/* ── Account: your name + the optional account (US-088) ───────── */}
        <SectionTitle title="Account" />
        <Card style={{ padding: 16 }}>
          <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 14, marginBottom: 8 }}>Your name</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TextInput
              accessibilityLabel="Your name"
              style={{
                flex: 1,
                backgroundColor: Surface.surfaceRaised,
                borderRadius: 14,
                paddingHorizontal: 14,
                height: 50,
                color: Surface.ink,
                fontFamily: FontFamily.bodySemiBold,
                fontSize: 17,
              }}
              placeholder="e.g. Jules"
              placeholderTextColor={Surface.faint}
              value={userNameDraft}
              onChangeText={setUserNameDraft}
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={saveName}
              onBlur={saveName}
            />
            {userName.trim() ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="checkmark-circle" size={16} color={Accent.green} />
                <Text style={{ color: Accent.green, fontFamily: FontFamily.bodySemiBold, fontSize: 13 }}>Saved</Text>
              </View>
            ) : null}
          </View>
        </Card>
        {cloud ? (
          <Card style={{ marginTop: 10 }}>
            <Row
              icon="person-outline"
              label="Account"
              sub={session ? `Signed in as ${session.user.email ?? 'Apple ID'}` : 'Optional. Sign in with your email.'}
              onPress={() => router.push('/account')}
              right={<Chevron />}
            />
          </Card>
        ) : null}

        {/* ── Notifications ─────────────────────────────────────────────── */}
        <SectionTitle title="Notifications" />
        <Card>
          <Row
            icon="alarm-outline"
            label="Heads-up 10 min before a habit"
            right={<Switch on={headsUpOn} onPress={toggleHeadsUp} label="Heads-up 10 min before a habit" />}
          />
          <Divider />
          <Row
            icon="notifications-outline"
            label="Sunday reminder"
            sub={reviewReminderOn ? `Every Sunday at ${ritualTime().label}` : 'Off'}
            right={<Switch on={reviewReminderOn} onPress={() => void toggleReviewReminder()} label="Sunday ritual reminder" />}
          />
          {reviewReminderOn ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 14, paddingLeft: 66 }}>
              {RITUAL_TIMES.map((t) => {
                const on = t === ritualTimeValue;
                const h = Number(t.slice(0, 2));
                return (
                  <Pressable
                    key={t}
                    onPress={() => pickRitualTime(t)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Sunday reminder at ${h - 12} PM`}
                    style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, justifyContent: 'center', backgroundColor: on ? Surface.ink : Surface.surfaceRaised }}
                  >
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: on ? Surface.surface : Surface.ink }}>{h - 12} PM</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Card>

        {/* ── Flick (US-101) ────────────────────────────────────────────── */}
        <SectionTitle title="Flick" />
        <Card>
          <Row icon="earth-outline" label="Flick's worlds" sub={`Lives in: ${worldName}`} onPress={() => router.push('/worlds')} right={<Chevron />} />
        </Card>

        {/* ── US-044 / US-053 / US-045: Data ─────────────────────────── */}
        <SectionTitle title="Your data" />
        <Card>
          <Row icon="download-outline" label="Export sessions as CSV" onPress={() => void handleExportCsv()} right={<Chevron />} />
          <Divider />
          <Row
            icon="refresh-outline"
            label="Replay onboarding"
            sub="Goals and history are kept"
            onPress={confirmReplayOnboarding}
            right={<Chevron />}
          />
          <Divider />
          <Row
            icon="trash-outline"
            iconColor={Accent.red}
            iconBg={Accent.redSoft}
            label="Delete all data"
            labelColor={Accent.red}
            onPress={() => {
              setDeleteInput('');
              setShowDeleteModal(true);
            }}
          />
        </Card>

        {/* ── Help & about ─────────────────────────────────────────────── */}
        <SectionTitle title="Help & about" />
        <Card>
          <Row icon="lock-closed-outline" label="Your privacy" sub="Your hours live on this phone. Nothing leaves it unless you sign in." />
          <Divider />
          <Row icon="information-circle-outline" label="Version" right={<Text style={{ ...Type.meta }}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>} />
        </Card>
      </ScrollView>

      {/* Delete all data confirmation modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'center' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
        >
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(23,20,17,0.55)' }}
            onPress={() => setShowDeleteModal(false)}
            accessibilityLabel="Close"
          />
          <View style={{ marginHorizontal: 20, borderRadius: 24, padding: 22, backgroundColor: Surface.canvas }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: Accent.redSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Ionicons name="trash-outline" size={24} color={Accent.red} />
            </View>
            <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 24, lineHeight: 30, marginBottom: 8 }}>Delete all data?</Text>
            <Text style={{ color: Surface.muted, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 23, marginBottom: 16 }}>
              This permanently erases every pillar, goal, task, habit, focus session, and weekly review. The app restarts in onboarding.
              There is no undo.
            </Text>
            <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 14, marginBottom: 8 }}>
              Type <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold }}>DELETE</Text> to confirm
            </Text>
            <TextInput
              value={deleteInput}
              onChangeText={setDeleteInput}
              autoCapitalize="characters"
              placeholder="DELETE"
              placeholderTextColor={Surface.faint}
              accessibilityLabel="Type DELETE to confirm"
              style={{
                height: 52,
                borderRadius: 14,
                paddingHorizontal: 16,
                marginBottom: 18,
                color: Surface.ink,
                fontFamily: FontFamily.bodyBold,
                fontSize: 17,
                letterSpacing: 1,
                backgroundColor: Surface.surfaceRaised,
                borderWidth: 2,
                borderColor: deleteInput === 'DELETE' ? Accent.red : 'transparent',
              }}
            />
            <CTA label="Delete everything" color={Accent.red} disabled={deleteInput !== 'DELETE'} onPress={() => void handleDeleteAll()} />
            <Pressable
              onPress={() => setShowDeleteModal(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={{ height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}
            >
              <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 17 }}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
