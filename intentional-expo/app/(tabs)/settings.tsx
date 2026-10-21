/**
 * Settings screen.
 * US-041: Blocked app categories
 * US-042: View / deactivate all actions across all goals
 * US-036: Weekly review notification toggle
 * US-045: Delete all data
 * US-053: Replay onboarding
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
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { localDayKey } from '@/utils/dates';
import type { ActionWithGoal } from '@/db/api';
import { Accent, FontFamily, Surface } from '@/constants/design';
import { CTA } from '@/components/onboarding/parts';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { getGoalColor } from '@/utils/goalColors';
import {
  scheduleWeeklyReviewReminder,
  cancelWeeklyReviewReminder,
  isWeeklyReviewReminderScheduled,
  requestNotificationPermissions,
  syncActionReminder,
  cancelAllScheduledNotifications,
} from '@/services/notifications';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as AppBlocking from '@/services/appBlocking';

function tabBarOverlapPadding(insetsBottom: number) {
  return 56 + Math.max(insetsBottom, 6) + 8 + 10;
}

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
  return <View style={[{ backgroundColor: Surface.surfaceRaised, borderRadius: 18, overflow: 'hidden' }, style]}>{children}</View>;
}

function IconTile({ name, color = Surface.ink, bg = Surface.surface }: { name: keyof typeof Ionicons.glyphMap; color?: string; bg?: string }) {
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
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Your name
  const [userName, setUserName] = useState('');
  const [userNameDraft, setUserNameDraft] = useState('');

  // US-041 — legacy category checkboxes (used when native module is absent)
  const [selected, setSelected] = useState<string[]>([]);

  // US-026 — FamilyControls
  const [fcAuthStatus, setFcAuthStatus] = useState<AppBlocking.AuthorizationStatus>('unsupported');
  const [fcHasSelection, setFcHasSelection] = useState(false);
  const [fcPickerBusy, setFcPickerBusy] = useState(false);

  // True when the native FamilyControls module is compiled in (EAS iOS build)
  const fcAvailable = fcAuthStatus !== 'unsupported';

  const refreshFcState = useCallback(() => {
    setFcAuthStatus(AppBlocking.getAuthorizationStatus());
    setFcHasSelection(AppBlocking.hasSelection());
  }, []);

  // US-042
  const [allActions, setAllActions] = useState<ActionWithGoal[]>([]);

  // US-036
  const [reviewReminderOn, setReviewReminderOn] = useState(false);

  // US-045 — delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  const load = useCallback(async () => {
    const name = api.getSetting('user_name') ?? '';
    setUserName(name);
    setUserNameDraft(name);
    setSelected(api.getBlockedCategoryIds());
    setAllActions(api.getAllActionsWithGoal());
    const on = await isWeeklyReviewReminderScheduled();
    setReviewReminderOn(on);
    refreshFcState();
  }, [refreshFcState]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // ── US-026: FamilyControls ────────────────────────────────────────────────
  const openFcPicker = async () => {
    if (fcPickerBusy) return;
    setFcPickerBusy(true);

    // If not yet authorized, request permission first
    if (fcAuthStatus === 'notDetermined') {
      const status = await AppBlocking.requestAuthorization();
      if (status !== 'approved') {
        setFcPickerBusy(false);
        refreshFcState();
        Alert.alert(
          'Permission required',
          'Enable Screen Time in iOS Settings > Screen Time to allow app blocking during focus.',
        );
        return;
      }
      refreshFcState();
    }

    if (fcAuthStatus === 'denied') {
      setFcPickerBusy(false);
      Alert.alert(
        'Permission denied',
        'To allow blocking, go to iOS Settings > Screen Time and enable access for Intentional.',
      );
      return;
    }

    const confirmed = await AppBlocking.presentPicker();
    setFcPickerBusy(false);
    if (confirmed) refreshFcState();
  };

  // ── US-041 ────────────────────────────────────────────────────────────────
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      api.setBlockedCategoryIds(next);
      return api.getBlockedCategoryIds();
    });
  };

  // ── US-042 ────────────────────────────────────────────────────────────────
  const toggleActionActive = async (action: ActionWithGoal) => {
    const next = action.is_active ? 0 : 1;
    await api.updateAction(action.id, { is_active: next });
    void syncActionReminder({ ...action, is_active: next }, action.goal_name);
    setAllActions(api.getAllActionsWithGoal());
  };

  // ── US-036 ────────────────────────────────────────────────────────────────
  const toggleReviewReminder = async () => {
    if (reviewReminderOn) {
      await cancelWeeklyReviewReminder();
      setReviewReminderOn(false);
    } else {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Permission required', 'Enable notifications in iOS Settings to receive Sunday review reminders.');
        return;
      }
      await scheduleWeeklyReviewReminder(20, 0);
      setReviewReminderOn(true);
    }
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

  const bottomPad = tabBarOverlapPadding(insets.bottom) + 16;

  // Group actions by goal for the flat list
  const goalGroups: { goalName: string; goalColor: string; goalIcon: string; actions: ActionWithGoal[] }[] = [];
  for (const a of allActions) {
    const last = goalGroups[goalGroups.length - 1];
    if (last && last.goalName === a.goal_name) {
      last.actions.push(a);
    } else {
      goalGroups.push({ goalName: a.goal_name, goalColor: getGoalColor({ id: a.goal_id, color: a.goal_color }), goalIcon: a.goal_icon, actions: [a] });
    }
  }

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
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: bottomPad }}>
        <Text accessibilityRole="header" style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 }}>
          Settings
        </Text>
        <Text style={{ color: Surface.muted, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22, marginTop: 4 }}>
          Your name, reminders, and your data. All stored on this phone.
        </Text>

        {/* ── Profile: your name ───────────────────────────────────────── */}
        <SectionTitle title="Profile" />
        <Card style={{ padding: 16 }}>
          <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 14, marginBottom: 8 }}>Your name</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TextInput
              accessibilityLabel="Your name"
              style={{
                flex: 1,
                backgroundColor: Surface.surface,
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
          <Text style={{ color: Surface.muted, fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, marginTop: 10 }}>
            Used in the Today greeting. Leave blank to show just the time of day.
          </Text>
        </Card>

        {/* ── US-036: Weekly review reminder ────────────────────────── */}
        <SectionTitle title="Weekly review" sub="A Sunday moment to look at where your week went." />
        <Card>
          <Row
            icon="notifications-outline"
            label="Sunday reminder"
            sub="Every Sunday at 8:00 PM"
            right={<Switch on={reviewReminderOn} onPress={() => void toggleReviewReminder()} label="Sunday review reminder" />}
          />
          <Divider />
          <Row icon="create-outline" label="Write this week's review" onPress={() => router.push('/weekly-review')} right={<Chevron />} />
        </Card>

        {/* ── US-042: All actions flat list ─────────────────────────── */}
        <SectionTitle title="Your habits" sub="Pause a habit without losing its history. Tap the bolt to switch it on or off." />
        {goalGroups.length === 0 ? (
          <Card style={{ padding: 18, alignItems: 'center' }}>
            <Text style={{ color: Surface.muted, fontFamily: FontFamily.body, fontSize: 16 }}>No habits yet. Add some from the Goals tab.</Text>
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            {goalGroups.map((group) => (
              <Card key={group.goalName}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
                  <PillarIcon icon={group.goalIcon} name={group.goalName} color={group.goalColor} size={32} />
                  <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 17, flex: 1 }} numberOfLines={1}>
                    {group.goalName}
                  </Text>
                </View>
                {group.actions.map((a, idx) => (
                  <View key={a.id}>
                    {idx > 0 ? <Divider inset={16} /> : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ color: a.is_active ? Surface.ink : Surface.faint, fontFamily: FontFamily.bodySemiBold, fontSize: 16 }}
                          numberOfLines={1}
                        >
                          {a.name}
                        </Text>
                        <Text style={{ color: Surface.muted, fontFamily: FontFamily.body, fontSize: 13, marginTop: 1 }}>
                          {a.type === 'session' ? `${a.target_minutes} min` : 'Check-off habit'}
                          {a.reminder_time ? ` · ${a.reminder_time}` : ''}
                          {a.is_active ? '' : ' · Paused'}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => toggleActionActive(a)}
                        hitSlop={8}
                        accessibilityRole="switch"
                        accessibilityLabel={`${a.name} active`}
                        accessibilityState={{ checked: !!a.is_active }}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: a.is_active ? Surface.ink : Surface.surface,
                        }}
                      >
                        <Ionicons name={a.is_active ? 'flash' : 'flash-off-outline'} size={18} color={a.is_active ? Surface.surface : Surface.faint} />
                      </Pressable>
                    </View>
                  </View>
                ))}
                <View style={{ height: 6 }} />
              </Card>
            ))}
          </View>
        )}

        {/* ── US-026 / US-041: Blocking (secondary) ────────────────────── */}
        <SectionTitle
          title="Protect your focus sessions"
          sub="Optional. Block distracting apps while a session runs, so the hour goes where you meant it to."
        />

        {fcAvailable ? (
          /* ── Native FamilyControls UI (EAS iOS build) ───────────────── */
          <>
            <Card>
              {/* Authorization status */}
              <Row
                icon={fcAuthStatus === 'approved' ? 'shield-checkmark' : 'shield-outline'}
                iconColor={fcAuthStatus === 'approved' ? Accent.green : Accent.orange}
                label={fcAuthStatus === 'approved' ? 'Screen Time access granted' : 'Screen Time access not yet granted'}
              />
              <Divider />
              {/* Configure / re-configure button */}
              <Row
                icon="apps-outline"
                label={fcHasSelection ? 'Change blocked apps…' : 'Choose apps to block…'}
                onPress={() => void openFcPicker()}
                disabled={fcPickerBusy}
                right={fcPickerBusy ? <ActivityIndicator size="small" color={Surface.faint} /> : <Chevron />}
              />
            </Card>
            <Text style={{ color: Surface.muted, fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, marginTop: 10, paddingHorizontal: 4 }}>
              {fcHasSelection
                ? 'A selection is saved. Shields switch on by themselves when you start a focus session.'
                : 'No apps selected yet. Tap "Choose apps to block" to set it up.'}
            </Text>
          </>
        ) : (
          /* ── Fallback checkbox UI (Expo Go / web / Android) ─────────── */
          <>
            <Card>
              {api.BLOCKABLE_APP_CATEGORIES.map((cat, idx) => {
                const on = selected.includes(cat.id);
                return (
                  <View key={cat.id}>
                    {idx > 0 ? <Divider inset={16} /> : null}
                    <Pressable
                      onPress={() => toggle(cat.id)}
                      accessibilityRole="checkbox"
                      accessibilityLabel={cat.label}
                      accessibilityState={{ checked: on }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 16,
                        minHeight: 52,
                        backgroundColor: 'transparent',
                      }}
                    >
                      <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodySemiBold, fontSize: 16, flex: 1, paddingRight: 12 }}>{cat.label}</Text>
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: on ? 0 : 2,
                          borderColor: Surface.ruleStrong,
                          backgroundColor: on ? Accent.blue : Surface.surface,
                        }}
                      >
                        {on ? <Ionicons name="checkmark" size={17} color={Surface.surface} /> : null}
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </Card>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10, paddingHorizontal: 4 }}>
              <Ionicons name="information-circle-outline" size={18} color={Surface.faint} style={{ marginTop: 1 }} />
              <Text style={{ color: Surface.muted, fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, flex: 1 }}>
                {selected.length} {selected.length === 1 ? 'category' : 'categories'} selected. Blocking uses Apple&apos;s Screen
                Time, so it only works in the iOS app build. Your choices are saved for when it does.
              </Text>
            </View>
          </>
        )}

        {/* ── US-044 / US-053 / US-045: Data ─────────────────────────── */}
        <SectionTitle title="Your data" sub="Everything lives on this phone. Take it with you or start over." />
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
