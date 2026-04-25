/**
 * Settings screen.
 * US-041: Blocked app categories
 * US-042: View / deactivate all actions across all goals
 * US-036: Weekly review notification toggle
 * US-045: Delete all data
 * US-053: Replay onboarding
 */
import { useCallback, useState, useEffect } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { ONBOARDING_DRAFT_STORAGE_KEY } from '@/constants/onboardingDraft';
import { setSetting, getSetting } from '@/db';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import type { ActionWithGoal } from '@/db/api';
import { Colors, Surface } from '@/constants/design';
import { shadows } from '@/styles/shadows';
import {
  scheduleWeeklyReviewReminder,
  cancelWeeklyReviewReminder,
  isWeeklyReviewReminderScheduled,
  requestNotificationPermissions,
} from '@/services/notifications';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as AppBlocking from '@/services/appBlocking';

function tabBarOverlapPadding(insetsBottom: number) {
  return 56 + Math.max(insetsBottom, 6) + 8 + 10;
}

// ─── Tiny section header ──────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return <Text className="text-footnote uppercase tracking-wider text-text-tertiary mb-2 mt-6">{title}</Text>;
}

// ─── Divider inside a card ────────────────────────────────────────────────────
const Divider = () => (
  <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 0 }} />
);

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
    const filename = `intentional-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
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
      goalGroups.push({ goalName: a.goal_name, goalColor: a.goal_color, goalIcon: a.goal_icon, actions: [a] });
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <Stack.Screen options={{ title: 'Settings', headerShadowVisible: false }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: bottomPad }}>
        <Text className="text-title2 font-bold text-text-primary mb-1">Settings</Text>
        <Text className="text-footnote text-text-tertiary mb-2">Preferences & data</Text>

        {/* ── Profile: your name ───────────────────────────────────────── */}
        <SectionHeader title="Profile" />
        <View className="rounded-xl px-4 py-3" style={[shadows.card, { backgroundColor: Surface.container }]}>
          <Text className="text-caption text-text-tertiary uppercase tracking-wider mb-2">Your name</Text>
          <View className="flex-row items-center gap-3">
            <TextInput
              className="flex-1 text-body text-text-primary"
              style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)', paddingVertical: 6 }}
              placeholder="e.g. Jules"
              placeholderTextColor={Colors.textLabel}
              value={userNameDraft}
              onChangeText={setUserNameDraft}
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={() => {
                const trimmed = userNameDraft.trim();
                setSetting('user_name', trimmed);
                setUserName(trimmed);
              }}
              onBlur={() => {
                const trimmed = userNameDraft.trim();
                setSetting('user_name', trimmed);
                setUserName(trimmed);
              }}
            />
            {userName.trim() ? (
              <Text className="text-caption text-text-tertiary">saved</Text>
            ) : null}
          </View>
          <Text className="text-caption text-text-tertiary mt-2 leading-4">
            Used in the Today greeting. Leave blank to show just the time of day.
          </Text>
        </View>

        {/* ── US-026 / US-041: Blocked app categories ──────────────────── */}
        <SectionHeader title="Blocked app categories" />

        {fcAvailable ? (
          /* ── Native FamilyControls UI (EAS iOS build) ───────────────── */
          <>
            <Text className="text-caption text-text-secondary mb-4 leading-5">
              Choose which apps and categories iOS should block{' '}
              <Text className="font-semibold text-text-primary">during every focus session</Text>.
              Blocking is enforced at the OS level — apps can&apos;t be opened while the shield is active.
            </Text>

            <View className="rounded-xl overflow-hidden mb-2" style={[shadows.card, { backgroundColor: Surface.container }]}>
              {/* Authorization status */}
              <View className="flex-row items-center gap-3 px-4 py-3">
                <View
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: fcAuthStatus === 'approved' ? Colors.accentSuccess : Colors.accentWarning }}
                />
                <Text className="text-body text-text-primary flex-1">
                  {fcAuthStatus === 'approved' ? 'Screen Time access granted' : 'Screen Time access not yet granted'}
                </Text>
              </View>

              <Divider />

              {/* Configure / re-configure button */}
              <Pressable
                onPress={() => void openFcPicker()}
                disabled={fcPickerBusy}
                className="flex-row items-center gap-3 px-4 py-3.5"
              >
                <Ionicons name="shield-checkmark-outline" size={18} color={Colors.textSecondary} />
                <Text className="text-body text-text-primary flex-1">
                  {fcHasSelection ? 'Change blocked apps…' : 'Choose apps to block…'}
                </Text>
                {fcPickerBusy
                  ? <ActivityIndicator size="small" color={Colors.textTertiary} />
                  : <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />}
              </Pressable>
            </View>

            <View className="flex-row items-start gap-2 rounded-lg p-3 mb-2" style={{ backgroundColor: Surface.high }}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.textTertiary} style={{ marginTop: 1 }} />
              <Text className="text-caption text-text-secondary flex-1 leading-5">
                {fcHasSelection
                  ? 'A selection is saved. Shields apply automatically when you start a focus session.'
                  : 'No apps selected yet. Tap "Choose apps to block" to configure.'}
              </Text>
            </View>
          </>
        ) : (
          /* ── Fallback checkbox UI (Expo Go / web / Android) ─────────── */
          <>
            <Text className="text-caption text-text-secondary mb-4 leading-5">
              When wired to Apple&apos;s{' '}
              <Text className="font-semibold text-text-primary">Screen Time / FamilyControls</Text> on a real iOS build,
              these choices drive OS-level shields during focus sessions. Native blocking is not available in this build —
              your selections are stored for when the EAS build is installed.
            </Text>

            <View className="rounded-xl overflow-hidden mb-2" style={[shadows.card, { backgroundColor: Surface.container }]}>
              {api.BLOCKABLE_APP_CATEGORIES.map((cat, idx) => {
                const on = selected.includes(cat.id);
                return (
                  <View key={cat.id}>
                    {idx > 0 ? <Divider /> : null}
                    <Pressable
                      onPress={() => toggle(cat.id)}
                      className="flex-row items-center justify-between px-4 py-3.5"
                    >
                      <Text className="text-body text-text-primary flex-1 pr-3">{cat.label}</Text>
                      <View
                        className="w-7 h-7 rounded-full items-center justify-center border-2"
                        style={{
                          borderColor: on ? Colors.accentSuccess : 'rgba(255,255,255,0.15)',
                          backgroundColor: on ? 'rgba(34,197,94,0.12)' : 'transparent',
                        }}
                      >
                        {on ? <Ionicons name="checkmark" size={18} color={Colors.accentSuccess} /> : null}
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <View className="flex-row items-start gap-2 rounded-lg p-3 mb-2" style={{ backgroundColor: Surface.high }}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.textTertiary} style={{ marginTop: 1 }} />
              <Text className="text-caption text-text-secondary flex-1 leading-5">
                {selected.length} {selected.length === 1 ? 'category' : 'categories'} selected. OS-level blocking
                requires a native iOS build.
              </Text>
            </View>
          </>
        )}

        {/* ── US-042: All actions flat list ─────────────────────────── */}
        <SectionHeader title="All actions" />
        <Text className="text-caption text-text-secondary mb-4 leading-5">
          Every action across all your goals. Toggle the switch to temporarily deactivate without losing history.
        </Text>

        {goalGroups.length === 0 ? (
          <View className="rounded-xl p-4 mb-2 items-center" style={[shadows.card, { backgroundColor: Surface.container }]}>
            <Text className="text-body text-text-secondary">No actions yet. Add some from the Goals tab.</Text>
          </View>
        ) : (
          goalGroups.map((group) => (
            <View key={group.goalName} className="mb-3">
              <View className="flex-row items-center gap-2 mb-2">
                <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.goalColor }} />
                <Text className="text-footnote font-semibold uppercase tracking-wider" style={{ color: group.goalColor }}>
                  {group.goalIcon} {group.goalName}
                </Text>
              </View>
              <View className="rounded-xl overflow-hidden" style={[shadows.card, { backgroundColor: Surface.container }]}>
                {group.actions.map((a, idx) => (
                  <View key={a.id}>
                    {idx > 0 ? <Divider /> : null}
                    <View className="flex-row items-center px-4 py-3 gap-3">
                      <View className="flex-1">
                        <Text className="text-body text-text-primary" numberOfLines={1}>{a.name}</Text>
                        <Text className="text-caption text-text-tertiary mt-0.5">
                          {a.type === 'session' ? `Session · ${a.target_minutes} min` : 'Habit'}
                          {a.reminder_time ? ` · ⏰ ${a.reminder_time}` : ''}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => toggleActionActive(a)}
                        hitSlop={8}
                        className="w-8 h-8 rounded-full items-center justify-center"
                        style={{
                          backgroundColor: a.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                        }}
                      >
                        <Ionicons
                          name={a.is_active ? 'flash' : 'flash-off-outline'}
                          size={18}
                          color={a.is_active ? Colors.accentSuccess : Colors.textLabel}
                        />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}

        {/* ── US-036: Weekly review reminder ────────────────────────── */}
        <SectionHeader title="Weekly review" />
        <Text className="text-caption text-text-secondary mb-4 leading-5">
          A Sunday evening nudge to reflect on your week. Fires every Sunday at 8 PM local time.
        </Text>
        <View className="rounded-xl overflow-hidden mb-2" style={[shadows.card, { backgroundColor: Surface.container }]}>
          <View className="flex-row items-center justify-between px-4 py-3.5">
            <View className="flex-1 pr-3">
              <Text className="text-body text-text-primary">Sunday reminder</Text>
              <Text className="text-caption text-text-tertiary mt-0.5">Every Sunday at 8:00 PM</Text>
            </View>
            <Pressable
              onPress={toggleReviewReminder}
              className="w-11 h-6 rounded-full justify-center"
              style={{ backgroundColor: reviewReminderOn ? Colors.accentSuccess : 'rgba(255,255,255,0.15)', paddingHorizontal: 2 }}
            >
              <View
                className="w-5 h-5 rounded-full bg-white"
                style={{ transform: [{ translateX: reviewReminderOn ? 20 : 0 }] }}
              />
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('../weekly-review')}
          className="flex-row items-center justify-between py-3 px-4 rounded-xl mb-2"
          style={[shadows.card, { backgroundColor: Surface.container }]}
        >
          <Text className="text-body text-text-primary">Write this week's review</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </Pressable>

        {/* ── US-053: Replay onboarding ─────────────────────────────── */}
        <SectionHeader title="Onboarding" />
        <Text className="text-caption text-text-secondary mb-3 leading-5">
          Walk through the welcome flow again. Goals, actions, and all session history are kept.
        </Text>
        <Pressable
          onPress={() =>
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
            )
          }
          className="py-3 px-4 rounded-xl items-center mb-2"
          style={[shadows.card, { backgroundColor: Surface.container }]}
        >
          <Text className="text-subheadline font-semibold text-accent-danger">Replay onboarding</Text>
        </Pressable>

        {/* ── US-044 + US-045: Data ─────────────────────────────────── */}
        <SectionHeader title="Data" />
        <Text className="text-caption text-text-secondary mb-3 leading-5">
          Export your session history as a CSV, or permanently wipe all data.
        </Text>

        <Pressable
          onPress={() => void handleExportCsv()}
          className="flex-row items-center justify-between py-3 px-4 rounded-xl mb-3"
          style={[shadows.card, { backgroundColor: Surface.container }]}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="download-outline" size={20} color={Colors.textSecondary} />
            <Text className="text-body text-text-primary">Export sessions as CSV</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </Pressable>

        <Pressable
          onPress={() => { setDeleteInput(''); setShowDeleteModal(true); }}
          className="py-3 px-4 rounded-xl items-center"
          style={[shadows.card, { backgroundColor: 'rgba(220,38,38,0.08)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.2)' }]}
        >
          <Text className="text-subheadline font-semibold" style={{ color: Colors.accentDanger }}>
            Delete all data
          </Text>
        </Pressable>
      </ScrollView>

      {/* Delete all data confirmation modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <KeyboardAvoidingView className="flex-1 justify-center" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable
            className="absolute inset-0 bg-black/60"
            onPress={() => setShowDeleteModal(false)}
          />
          <View
            className="mx-6 rounded-2xl p-6"
            style={{ backgroundColor: Surface.container }}
          >
            <Text className="text-title3 font-bold text-text-primary mb-2">Delete all data?</Text>
            <Text className="text-body text-text-secondary mb-4 leading-6">
              This will permanently erase every goal, action, focus session, and weekly review. The app will restart
              in onboarding. There is no undo.
            </Text>
            <Text className="text-footnote text-text-tertiary mb-2">
              Type <Text className="font-bold text-text-primary">DELETE</Text> to confirm
            </Text>
            <TextInput
              value={deleteInput}
              onChangeText={setDeleteInput}
              autoCapitalize="characters"
              placeholder="DELETE"
              placeholderTextColor={Colors.textLabel}
              className="text-body text-text-primary rounded-xl px-4 py-3 mb-4"
              style={{ backgroundColor: Surface.high, borderWidth: 1, borderColor: deleteInput === 'DELETE' ? Colors.accentDanger : 'rgba(255,255,255,0.1)' }}
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowDeleteModal(false)}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: Surface.high }}
              >
                <Text className="text-subheadline font-semibold text-text-primary">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleDeleteAll}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: deleteInput === 'DELETE' ? Colors.accentDanger : 'rgba(220,38,38,0.25)', opacity: deleteInput === 'DELETE' ? 1 : 0.5 }}
              >
                <Text className="text-subheadline font-semibold text-white">Delete</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
