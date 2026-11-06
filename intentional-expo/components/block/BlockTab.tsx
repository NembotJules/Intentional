/**
 * US-103 · The Block tab (founder 2026-11-06: "each tab does exactly what it is for").
 *   Blocking now · status pills (Always / Active / Unlocked until… / Next at…)
 *   Presets · illustrated one-tap cards made of block hours (Bedtime, Work hours, Morning focus)
 *   During my habits · Your block hours (add, edit, switch off) · Your apps · Unlocking
 * The rules and windows are the same as before (services/blockRules, services/appBlocking); only the screen is new.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as api from '@/db/api';
import * as AppBlocking from '@/services/appBlocking';
import { MAX_MONITORED_ACTIVITIES } from '@/services/appBlocking';
import { describeRule, ruleError, type BlockRule } from '@/services/blockRules';
import { BLOCK_PRESETS, addPreset, presetIsOn, presetWhen, removePreset, type PresetRule } from '@/services/blockPresets';
import { blockingNow, type StrictHabit } from '@/services/blockStatus';
import { syncHabits } from '@/services/habitSync';
import { PrimaryButton } from '@/components/PrimaryButton';
import { PressableScale, enter } from '@/components/ui/motion';
import { Card, PillButton } from '@/components/ui/kit';
import { Mascot } from '@/components/onboarding/Mascot';
import { FieldLabel, WeekdayPicker } from '@/components/ui/PillarForm';
import { PresetIllustration, StatusPill } from '@/components/block/BlockArt';
import { Accent, Elevation, FontFamily, Radius, Surface, Type } from '@/constants/design';
import { confirmAsync } from '@/utils/confirm';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

function Section({ title, sub, right, children }: { title: string; sub?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ marginTop: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 }}>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={{ ...Type.title, fontSize: 22, lineHeight: 28 }}>
            {title}
          </Text>
          {sub ? <Text style={{ ...Type.meta, marginTop: 2 }}>{sub}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
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
      style={{ width: 52, height: 32, borderRadius: 16, padding: 3, justifyContent: 'center', backgroundColor: on ? Surface.ink : Surface.ruleStrong }}
    >
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: Surface.surface, transform: [{ translateX: on ? 20 : 0 }] }} />
    </Pressable>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <FieldLabel>{label}</FieldLabel>
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

function strictHabits(): StrictHabit[] {
  return api
    .getAllActionsWithGoal()
    .filter((a) => a.is_active && (a.strict ?? 1) === 1)
    .map((a) => ({ id: a.id, name: a.name, reminder_time: a.reminder_time, target_minutes: a.target_minutes, days_mask: a.days_mask ?? 127 }));
}

export function BlockTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [auth, setAuth] = useState<AppBlocking.AuthorizationStatus>('unsupported');
  const [hasSelection, setHasSelection] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [duringHabits, setDuringHabits] = useState(true);
  const [habitCount, setHabitCount] = useState(0);
  const [rules, setRules] = useState<PresetRule[]>([]);
  const [habits, setHabits] = useState<StrictHabit[]>([]);
  const [unlockUntil, setUnlockUntil] = useState<number | null>(null);
  const [budget, setBudget] = useState({ used: 0, dropped: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [form, setForm] = useState<{ id: string | null; days_mask: number; start: string; end: string } | null>(null);
  const [formTried, setFormTried] = useState(false);
  const native = auth !== 'unsupported';

  const load = useCallback(() => {
    setAuth(AppBlocking.getAuthorizationStatus());
    setHasSelection(AppBlocking.hasSelection());
    setCategories(api.getBlockedCategoryIds());
    setDuringHabits(AppBlocking.isBlockingDuringHabits());
    setHabitCount(AppBlocking.strictHabitCount());
    setRules(AppBlocking.getBlockRules() as PresetRule[]);
    setHabits(strictHabits());
    setUnlockUntil(AppBlocking.getUnlockUntil());
    setBudget(AppBlocking.windowBudget());
    setNow(new Date());
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
  const saveRules = (next: PresetRule[]) => {
    AppBlocking.saveBlockRules(next as BlockRule[]);
    resync();
  };

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
  const toggleHabits = () => {
    hapticLight();
    AppBlocking.setBlockingDuringHabits(!duringHabits);
    resync();
  };
  const togglePreset = (id: string) => {
    if (presetIsOn(rules, id)) {
      hapticLight();
      saveRules(removePreset(rules, id));
    } else {
      hapticSuccess();
      saveRules(addPreset(rules, id, () => newId()));
    }
  };
  const ownRules = rules.filter((r) => !r.preset);
  const toggleRule = (id: string) => {
    hapticLight();
    saveRules(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const formError = form ? ruleError(form) : null;
  const saveForm = () => {
    if (!form) return;
    setFormTried(true);
    if (formError) return;
    const fields = { days_mask: form.days_mask & 127, start: form.start, end: form.end };
    const next = form.id ? rules.map((r) => (r.id === form.id ? { ...r, ...fields } : r)) : [...rules, { id: newId(), enabled: true, ...fields }];
    hapticSuccess();
    setForm(null);
    saveRules(next);
  };
  const deleteForm = async () => {
    if (!form?.id) return;
    const r = rules.find((x) => x.id === form.id);
    const ok = await confirmAsync({ title: 'Delete these block hours?', message: r ? describeRule(r) : undefined, confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    setForm(null);
    saveRules(rules.filter((x) => x.id !== form.id));
  };
  const openNew = () => {
    setFormTried(false);
    setForm({ id: null, days_mask: 0, start: '09:00', end: '12:00' });
  };

  const cards = blockingNow({ now, rules, duringHabits, strictHabits: habits, unlockUntil });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 140 + insets.bottom }} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <Animated.View entering={enter(0)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={Type.display}>
                Block
              </Text>
              <Text style={{ ...Type.body, color: Surface.muted, marginTop: 2 }}>Keep distracting apps out of the hours you chose.</Text>
            </View>
            <Mascot mood="focus" size={64} intensity={0.75} />
          </Animated.View>

          {!native ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, padding: 12, borderRadius: Radius.md, backgroundColor: Accent.blueSoft }}>
              <Ionicons name="information-circle" size={18} color={Accent.blue} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 13, lineHeight: 18, color: Surface.ink }}>
                Blocking runs on Apple&apos;s Screen Time, so it only works in the Intentional iPhone app. What you set here is saved and switches on there.
              </Text>
            </View>
          ) : null}

          {/* Blocking now */}
          <Section title="Blocking now">
            <View style={{ gap: 10 }}>
              {cards.map((c, i) => (
                <Animated.View key={c.id} entering={enter(i + 1)}>
                  <Card accessibilityLabel={`${c.title}: ${c.pill.text}`}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...Type.heading, fontSize: 17 }}>{c.title}</Text>
                        <Text style={{ ...Type.meta, marginTop: 2 }}>{c.sub}</Text>
                      </View>
                      <StatusPill text={c.pill.text} tone={c.pill.tone} />
                    </View>
                  </Card>
                </Animated.View>
              ))}
            </View>
          </Section>

          {/* Presets */}
          <Section title="Presets" sub="One tap. Change your mind any time.">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {BLOCK_PRESETS.map((p) => {
                const on = presetIsOn(rules, p.id);
                return (
                  <PressableScale
                    key={p.id}
                    onPress={() => togglePreset(p.id)}
                    accessibilityRole="switch"
                    accessibilityLabel={`Preset ${p.name}`}
                    accessibilityState={{ checked: on }}
                    aria-checked={on}
                    style={{ width: '48%', flexGrow: 1, borderRadius: Radius.card, padding: 14, backgroundColor: p.bg, borderWidth: 2, borderColor: on ? p.accent : 'transparent' }}
                  >
                    <PresetIllustration art={p.art} accent={p.accent} size={60} />
                    <Text style={{ ...Type.heading, fontSize: 17, marginTop: 6 }}>{p.name}</Text>
                    <Text style={{ ...Type.meta, fontSize: 13 }}>{p.tagline}</Text>
                    <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: p.accent, marginTop: 6 }}>{presetWhen(p)}</Text>
                    <View style={{ marginTop: 10, height: 30, borderRadius: 15, alignSelf: 'flex-start', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: on ? p.accent : Surface.surface }}>
                      <Ionicons name={on ? 'checkmark' : 'add'} size={15} color={on ? Surface.surface : Surface.ink} />
                      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: on ? Surface.surface : Surface.ink }}>{on ? 'On' : 'Add'}</Text>
                    </View>
                  </PressableScale>
                );
              })}
              <Card style={{ width: '48%', flexGrow: 1 }} accessibilityLabel="During my habits">
                <Ionicons name="repeat" size={26} color={Surface.ink} />
                <Text style={{ ...Type.heading, fontSize: 17, marginTop: 8 }}>During my habits</Text>
                <Text style={{ ...Type.meta, fontSize: 13 }}>
                  {habitCount > 0 ? `${habitCount} ${habitCount === 1 ? 'habit' : 'habits'} with a start time` : 'Give a habit a start time'}
                </Text>
                <View style={{ marginTop: 10 }}>
                  <Switch on={duringHabits} onPress={toggleHabits} label="Block during my habits" />
                </View>
              </Card>
            </View>
          </Section>

          {/* Your own block hours */}
          <Section title="Your block hours" right={!form ? <PillButton size="sm" label="Add" accessibilityLabel="Add block hours" icon={<Ionicons name="add" size={16} color={Surface.surface} />} onPress={openNew} /> : null}>
            {ownRules.length ? (
              <Card style={{ paddingVertical: 4, paddingHorizontal: 0 }}>
                {ownRules.map((r, k) => (
                  <View key={r.id}>
                    {k > 0 ? <View style={{ height: 1, backgroundColor: Surface.rule, marginLeft: 16 }} /> : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 58 }}>
                      <Pressable
                        style={{ flex: 1, paddingVertical: 10 }}
                        onPress={() => {
                          setFormTried(false);
                          setForm({ id: r.id, days_mask: r.days_mask, start: r.start, end: r.end });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit block hours ${describeRule(r)}`}
                      >
                        <Text style={{ ...Type.heading, fontSize: 16 }}>{describeRule(r)}</Text>
                        <Text style={{ ...Type.meta, fontSize: 13 }}>Tap to edit</Text>
                      </Pressable>
                      <Switch on={r.enabled} onPress={() => toggleRule(r.id)} label={`Block hours ${describeRule(r)}`} />
                    </View>
                  </View>
                ))}
              </Card>
            ) : !form ? (
              <Text style={{ ...Type.meta }}>Lock your apps at the same times every week, like weekdays 9:00–12:00.</Text>
            ) : null}
            {form ? (
              <Animated.View entering={FadeInDown.springify().damping(20)} style={{ marginTop: 12, backgroundColor: Surface.surface, borderRadius: Radius.card, padding: 16, ...Elevation.card }}>
                <Text style={{ ...Type.heading, fontSize: 17, marginBottom: 12 }}>{form.id ? 'Edit block hours' : 'New block hours'}</Text>
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
            ) : null}
          </Section>

          {/* Apps */}
          <Section title="Your apps" sub={native ? 'The apps and categories that pull you away.' : 'The kinds of apps that pull you away.'}>
            {native ? (
              <Card onPress={() => void chooseApps()} accessibilityLabel={hasSelection ? 'Your blocked apps' : 'Choose apps to block'}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Ionicons name={hasSelection ? 'apps' : 'apps-outline'} size={22} color={Surface.ink} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...Type.heading, fontSize: 16 }}>{hasSelection ? 'Your blocked apps' : 'Choose apps to block'}</Text>
                    <Text style={{ ...Type.meta, fontSize: 13 }}>{hasSelection ? 'Chosen. Tap to change them.' : 'Nothing can be blocked until you pick some.'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Surface.faint} />
                </View>
              </Card>
            ) : (
              <Card style={{ paddingVertical: 4, paddingHorizontal: 0 }}>
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
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 48 }}
                      >
                        <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Surface.ink }}>{cat.label}</Text>
                        <View
                          style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 0 : 2, borderColor: Surface.ruleStrong, backgroundColor: on ? Surface.ink : Surface.surface }}
                        >
                          {on ? <Ionicons name="checkmark" size={15} color={Surface.surface} /> : null}
                        </View>
                      </Pressable>
                    </View>
                  );
                })}
              </Card>
            )}
            {notice ? <Text style={{ ...Type.meta, color: Accent.amber, marginTop: 10 }}>{notice}</Text> : null}
          </Section>

          {/* Unlocking (US-096) */}
          <Section title="Unlocking early">
            <Card onPress={() => router.push('/unlock')} accessibilityLabel="Try the unlock screen">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Mascot mood="think" size={48} intensity={0.6} bob={false} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...Type.heading, fontSize: 16 }}>Try the unlock screen</Text>
                  <Text style={{ ...Type.meta, fontSize: 13 }}>{AppBlocking.canUnlock() ? 'See what a blocked app asks' : 'A preview: nothing is unlocked in this version'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Surface.faint} />
              </View>
            </Card>
            <Text style={{ ...Type.meta, marginTop: 10 }}>
              Open a blocked app and Intentional asks: do you really need it now? To open it anyway, you see your pillars first, choose up to 30 minutes and type one sentence. Then it blocks again on its own.
            </Text>
            <Text style={{ ...Type.meta, marginTop: 6 }}>A focus session can’t be unlocked this way: its apps open when you end the session.</Text>
          </Section>

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
