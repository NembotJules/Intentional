/**
 * Blocking (founder feedback 2026-10-30): one place for the apps to block and when they're blocked.
 *
 * Apps: Apple's picker on the iOS build (FamilyControls), the category list elsewhere (saved, not enforced).
 * When: every focus session (always) · during my habits (switch) · block hours (fixed windows on chosen days).
 * Rules live in settings (services/blockRules) and are registered with iOS through syncHabits.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as api from '@/db/api';
import * as AppBlocking from '@/services/appBlocking';
import { MAX_MONITORED_ACTIVITIES } from '@/services/appBlocking';
import { describeRule, ruleError, type BlockRule } from '@/services/blockRules';
import { syncHabits } from '@/services/habitSync';
import { PrimaryButton } from '@/components/PrimaryButton';
import { PressableScale } from '@/components/ui/motion';
import { FieldLabel, WeekdayPicker } from '@/components/ui/PillarForm';
import { Accent, Elevation, FontFamily, Radius, Surface, Type } from '@/constants/design';
import { confirmAsync } from '@/utils/confirm';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

function Card({ children }: { children: ReactNode }) {
  return <View style={{ backgroundColor: Surface.surfaceRaised, borderRadius: 18, overflow: 'hidden' }}>{children}</View>;
}

const Divider = () => <View style={{ height: 1, backgroundColor: Surface.rule, marginLeft: 66 }} />;

function Row({
  icon,
  label,
  sub,
  right,
  onPress,
  a11y,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  right?: ReactNode;
  onPress?: () => void;
  a11y?: string;
}) {
  const body = (
    <>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: Surface.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={19} color={Surface.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 17, lineHeight: 22, color: Surface.ink }}>{label}</Text>
        {sub ? <Text style={{ fontFamily: FontFamily.body, fontSize: 14, lineHeight: 19, color: Surface.muted, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      {right}
    </>
  );
  const style = { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 62, paddingHorizontal: 16, paddingVertical: 11 } as const;
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y ?? label} style={[style, { backgroundColor: 'transparent' }]}>
      {body}
    </Pressable>
  );
}

function Switch({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      aria-checked={on}
      hitSlop={8}
      style={{ width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: on ? Accent.green : Surface.ruleStrong, alignItems: on ? 'flex-end' : 'flex-start' }}
    >
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: Surface.surface }} />
    </Pressable>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginTop: 28, marginBottom: 12 }}>
      <Text accessibilityRole="header" style={{ fontFamily: FontFamily.bodyBold, fontSize: 20, lineHeight: 26, color: Surface.ink }}>
        {title}
      </Text>
      {sub ? <Text style={{ fontFamily: FontFamily.body, fontSize: 15, lineHeight: 21, color: Surface.muted, marginTop: 3 }}>{sub}</Text> : null}
    </View>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: Surface.muted, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^\d:]/g, '').slice(0, 5))}
        accessibilityLabel={label}
        placeholder="09:00"
        placeholderTextColor={Surface.faint}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        style={{ height: 50, borderRadius: Radius.md, backgroundColor: Surface.surfaceRaised, textAlign: 'center', fontFamily: FontFamily.bodyBold, fontSize: 18, color: Surface.ink }}
      />
    </View>
  );
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default function BlockingScreen() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/focus'));

  const [auth, setAuth] = useState<AppBlocking.AuthorizationStatus>('unsupported');
  const [hasSelection, setHasSelection] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [duringHabits, setDuringHabits] = useState(true);
  const [habitCount, setHabitCount] = useState(0);
  const [rules, setRules] = useState<BlockRule[]>([]);
  const [budget, setBudget] = useState({ used: 0, dropped: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Block-hours form (new or editing)
  const [form, setForm] = useState<{ id: string | null; days_mask: number; start: string; end: string } | null>(null);
  const [formTried, setFormTried] = useState(false);

  const native = auth !== 'unsupported';

  const load = useCallback(() => {
    setAuth(AppBlocking.getAuthorizationStatus());
    setHasSelection(AppBlocking.hasSelection());
    setCategories(api.getBlockedCategoryIds());
    setDuringHabits(AppBlocking.isBlockingDuringHabits());
    setHabitCount(AppBlocking.strictHabitCount());
    setRules(AppBlocking.getBlockRules());
    setBudget(AppBlocking.windowBudget());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const resync = () => {
    load();
    void syncHabits();
  };

  // ── Apps ──────────────────────────────────────────────────────────────────
  const chooseApps = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    let status = AppBlocking.getAuthorizationStatus();
    if (status === 'notDetermined') status = await AppBlocking.requestAuthorization();
    if (status !== 'approved') {
      setBusy(false);
      setAuth(status);
      setNotice('Intentional needs Screen Time access to block apps. Turn it on in iOS Settings → Screen Time → Intentional.');
      return;
    }
    const picked = await AppBlocking.presentPicker();
    setBusy(false);
    if (picked) {
      hapticSuccess();
      resync();
    }
  };

  const toggleCategory = (id: string) => {
    hapticLight();
    const next = categories.includes(id) ? categories.filter((x) => x !== id) : [...categories, id];
    api.setBlockedCategoryIds(next);
    setCategories(api.getBlockedCategoryIds());
  };

  // ── When ──────────────────────────────────────────────────────────────────
  const toggleHabits = () => {
    hapticLight();
    AppBlocking.setBlockingDuringHabits(!duringHabits);
    resync();
  };

  const saveRules = (next: BlockRule[]) => {
    AppBlocking.saveBlockRules(next);
    resync();
  };

  const toggleRule = (id: string) => {
    hapticLight();
    saveRules(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const openNew = () => {
    setFormTried(false);
    setForm({ id: null, days_mask: 0, start: '09:00', end: '12:00' });
  };

  const openEdit = (r: BlockRule) => {
    setFormTried(false);
    setForm({ id: r.id, days_mask: r.days_mask, start: r.start, end: r.end });
  };

  const formError = form ? ruleError(form) : null;

  const saveForm = () => {
    if (!form) return;
    setFormTried(true);
    if (formError) return;
    const fields = { days_mask: form.days_mask & 127, start: form.start, end: form.end };
    const next = form.id
      ? rules.map((r) => (r.id === form.id ? { ...r, ...fields } : r))
      : [...rules, { id: newId(), enabled: true, ...fields }];
    hapticSuccess();
    setForm(null);
    saveRules(next);
  };

  const deleteForm = async () => {
    if (!form?.id) return;
    const r = rules.find((x) => x.id === form.id);
    const ok = await confirmAsync({
      title: 'Delete these block hours?',
      message: r ? describeRule(r) : undefined,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setForm(null);
    saveRules(rules.filter((x) => x.id !== form.id));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 56 }} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={back}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={22} color={Surface.ink} />
          </Pressable>

          <Text accessibilityRole="header" style={{ ...Type.title, marginTop: 16 }}>
            Blocking
          </Text>
          <Text style={{ fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22, color: Surface.muted, marginTop: 4 }}>
            Keep distracting apps out of the hours you chose.
          </Text>

          {!native ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, padding: 14, borderRadius: Radius.md, backgroundColor: Accent.blueSoft }}>
              <Ionicons name="information-circle" size={20} color={Accent.blue} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 14, lineHeight: 20, color: Surface.ink }}>
                Blocking runs on Apple&apos;s Screen Time, so it only works in the Intentional iPhone app, not here. What you set is saved and
                switches on there.
              </Text>
            </View>
          ) : null}

          {/* ── Apps ── */}
          <SectionTitle title="Apps to block" sub={native ? 'Pick the apps and categories that pull you away.' : 'The kinds of apps that pull you away.'} />
          {native ? (
            <Card>
              <Row
                icon={hasSelection ? 'apps' : 'apps-outline'}
                label={hasSelection ? 'Your blocked apps' : 'Choose apps to block'}
                sub={hasSelection ? 'Chosen. Tap to change them.' : 'None chosen yet. Nothing can be blocked until you pick some.'}
                onPress={() => void chooseApps()}
                right={<Ionicons name="chevron-forward" size={18} color={Surface.faint} />}
              />
            </Card>
          ) : (
            <Card>
              {api.BLOCKABLE_APP_CATEGORIES.map((cat, idx) => {
                const on = categories.includes(cat.id);
                return (
                  <View key={cat.id}>
                    {idx > 0 ? <View style={{ height: 1, backgroundColor: Surface.rule, marginLeft: 16 }} /> : null}
                    <Pressable
                      onPress={() => toggleCategory(cat.id)}
                      accessibilityRole="checkbox"
                      accessibilityLabel={cat.label}
                      accessibilityState={{ checked: on }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 50, backgroundColor: 'transparent' }}
                    >
                      <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: Surface.ink }}>{cat.label}</Text>
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
          )}
          {notice ? <Text style={{ ...Type.meta, color: Accent.amber, marginTop: 10 }}>{notice}</Text> : null}

          {/* ── When ── */}
          <SectionTitle title="When they're blocked" />
          <Card>
            <Row icon="timer-outline" label="Every focus session" sub="While a session runs" right={<Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.muted }}>Always</Text>} />
            <Divider />
            <Row
              icon="repeat"
              label="During my habits"
              sub={
                habitCount > 0
                  ? `${habitCount} ${habitCount === 1 ? 'habit' : 'habits'} with a start time, for as long as each one lasts`
                  : 'Give a habit a start time and its apps lock at that time'
              }
              right={<Switch on={duringHabits} onPress={toggleHabits} label="Block during my habits" />}
            />
            {rules.map((r) => (
              <View key={r.id}>
                <Divider />
                <Row
                  icon="time-outline"
                  label={describeRule(r)}
                  sub="Block hours · tap to edit"
                  onPress={() => openEdit(r)}
                  a11y={`Edit block hours ${describeRule(r)}`}
                  right={<Switch on={r.enabled} onPress={() => toggleRule(r.id)} label={`Block hours ${describeRule(r)}`} />}
                />
              </View>
            ))}
          </Card>

          {form ? (
            <Animated.View entering={FadeInDown.springify().damping(20)} style={{ marginTop: 12, backgroundColor: Surface.surface, borderRadius: Radius.lg, padding: 16, ...Elevation.card }}>
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 17, color: Surface.ink, marginBottom: 12 }}>{form.id ? 'Edit block hours' : 'New block hours'}</Text>
              <FieldLabel>Days</FieldLabel>
              <WeekdayPicker mask={form.days_mask} color={Accent.blue} onChange={(m) => setForm({ ...form, days_mask: m })} emptyHint="Tap the days to block." />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TimeField label="From" value={form.start} onChange={(v) => setForm({ ...form, start: v })} />
                <TimeField label="To" value={form.end} onChange={(v) => setForm({ ...form, end: v })} />
              </View>
              {formTried && formError ? <Text style={{ ...Type.meta, color: Accent.amber, marginTop: 10 }}>{formError}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Cancel" appearance="ghost" color={Surface.muted} size="small" onPress={() => setForm(null)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title={form.id ? 'Save' : 'Add'} size="small" onPress={saveForm} />
                </View>
              </View>
              {form.id ? (
                <PressableScale onPress={() => void deleteForm()} accessibilityRole="button" accessibilityLabel="Delete block hours" style={{ height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Accent.red }}>Delete</Text>
                </PressableScale>
              ) : null}
            </Animated.View>
          ) : (
            <PressableScale
              onPress={openNew}
              accessibilityRole="button"
              accessibilityLabel="Add block hours"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, marginTop: 12, borderRadius: 26, borderWidth: 2, borderColor: Surface.rule }}
            >
              <Ionicons name="add" size={20} color={Surface.ink} />
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>Add block hours</Text>
            </PressableScale>
          )}
          <Text style={{ ...Type.meta, marginTop: 10 }}>Block hours lock your apps at the same times every week, like weekdays 9:00–12:00.</Text>

          {/* US-096: unlock with intention */}
          <SectionTitle title="Unlocking early" sub="When you open a blocked app, Intentional asks: is this intentional? To open it anyway, you type one sentence; it opens for 5, 10 or 15 minutes, then blocks again." />
          <Card>
            <Row
              icon="create-outline"
              label="Try the unlock screen"
              sub={AppBlocking.canUnlock() ? 'See what a blocked app asks' : 'A preview: nothing is unlocked in this version'}
              onPress={() => router.push('/unlock')}
              a11y="Try the unlock screen"
              right={<Ionicons name="chevron-forward" size={18} color={Surface.faint} />}
            />
          </Card>
          <Text style={{ ...Type.meta, marginTop: 10 }}>A focus session can’t be unlocked this way: its apps open when you end the session.</Text>

          {budget.dropped > 0 ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, padding: 14, borderRadius: Radius.md, backgroundColor: Accent.amberSoft }}>
              <Ionicons name="alert-circle" size={20} color={Accent.amber} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 14, lineHeight: 20, color: Surface.ink }}>
                iPhone watches at most {MAX_MONITORED_ACTIVITIES} blocking windows (each day of a habit or of block hours counts; every-day ones count once).{' '}
                {budget.dropped} {budget.dropped === 1 ? "doesn't" : "don't"} fit. Use fewer days, or "Every day".
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
