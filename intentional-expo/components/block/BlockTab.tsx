/**
 * US-107 · The Block tab, compact (founder 2026-11-07: "way too much text"; "Your apps" shows only the chosen apps;
 * no "Unlocking early" section).
 *   Block  [+ Add blocker]
 *   Blocking now · Scheduled   compact cards: sticker, name, one short line, a status pill, the blocked apps
 *   Presets for you            a swipeable row of illustrated one-tap cards
 *   Your apps                  the chosen apps' icons (iOS) and one "Edit" button
 * A card (or "Add blocker") opens the blocker sheet (BlockerSheet). Blockers are block-hour rules underneath
 * (services/blockers → services/blockRules → iOS DeviceActivity windows), so blocking itself is unchanged.
 */
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import * as api from '@/db/api';
import * as AppBlocking from '@/services/appBlocking';
import { MAX_MONITORED_ACTIVITIES } from '@/services/appBlocking';
import { type BlockRule } from '@/services/blockRules';
import { BLOCK_PRESETS, addPreset, presetIsOn, presetWhen, type PresetRule } from '@/services/blockPresets';
import { blockingNow, type BlockCard, type StrictHabit } from '@/services/blockStatus';
import { blockersFromRules, newBlocker, removeBlocker, upsertBlocker, type Blocker } from '@/services/blockers';
import { syncHabits } from '@/services/habitSync';
import { PressableScale, enter } from '@/components/ui/motion';
import { Sticker, isStickerName } from '@/components/ui/Sticker';
import { StatusPill } from '@/components/block/BlockArt';
import { BlockerSheet } from '@/components/block/BlockerSheet';
import { SelectedApps, canShowSelectedApps } from '@/modules/family-controls/SelectedApps';
import { Accent, Elevation, FontFamily, Radius, Surface, Type } from '@/constants/design';
import { confirmAsync } from '@/utils/confirm';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function strictHabits(): StrictHabit[] {
  return api
    .getAllActionsWithGoal()
    .filter((a) => a.is_active && (a.strict ?? 1) === 1)
    .map((a) => ({ id: a.id, name: a.name, reminder_time: a.reminder_time, target_minutes: a.target_minutes, days_mask: a.days_mask ?? 127 }));
}

const SectionTitle = ({ children }: { children: string }) => (
  <Text accessibilityRole="header" style={{ ...Type.heading, fontSize: 19, lineHeight: 24, marginTop: 26, marginBottom: 10 }}>
    {children}
  </Text>
);

/** The strip at the bottom of a card: the apps it blocks. */
function AppsStrip({ selection, count }: { selection: string | null; count: number }) {
  const icons = canShowSelectedApps() && !!selection;
  // Nothing chosen yet: "Your apps" below asks once, instead of every card repeating it.
  if (!icons && count === 0) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, minHeight: 40, paddingHorizontal: 12, borderRadius: 14, backgroundColor: Surface.surfaceRaised }}>
      <Text style={{ ...Type.meta, color: Surface.ink }}>Your apps</Text>
      {icons ? (
        <SelectedApps selection={selection} maxIcons={6} iconSize={24} style={{ height: 28 }} />
      ) : (
        <Text style={{ ...Type.meta, flex: 1, textAlign: 'right' }}>{count > 0 ? `${count} chosen` : 'None chosen yet'}</Text>
      )}
    </View>
  );
}

function BlockerCard({ card, selection, count, onPress, index }: { card: BlockCard; selection: string | null; count: number; onPress?: () => void; index: number }) {
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
          <Sticker name={isStickerName(card.sticker) ? card.sticker : 'lock'} size={30} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ ...Type.heading, fontSize: 17 }}>
            {card.title}
          </Text>
          <Text numberOfLines={1} style={{ ...Type.meta, marginTop: 1 }}>
            {card.sub}
          </Text>
        </View>
        <StatusPill text={card.pill.text} tone={card.pill.tone} />
      </View>
      <AppsStrip selection={selection} count={count} />
    </>
  );
  const style = { borderRadius: Radius.card, padding: 14, backgroundColor: Surface.surface, ...Elevation.card };
  return (
    <Animated.View entering={enter(index)}>
      {onPress ? (
        <PressableScale onPress={onPress} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={`${card.title}: ${card.pill.text}`} style={style}>
          {body}
        </PressableScale>
      ) : (
        <View accessibilityLabel={`${card.title}: ${card.pill.text}`} style={style}>
          {body}
        </View>
      )}
    </Animated.View>
  );
}

export function BlockTab() {
  const insets = useSafeAreaInsets();
  const [auth, setAuth] = useState<AppBlocking.AuthorizationStatus>('unsupported');
  const [selection, setSelection] = useState<string | null>(null);
  const [counts, setCounts] = useState({ apps: 0, categories: 0, sites: 0 });
  const [duringHabits, setDuringHabits] = useState(true);
  const [habitCount, setHabitCount] = useState(0);
  const [rules, setRules] = useState<PresetRule[]>([]);
  const [habits, setHabits] = useState<StrictHabit[]>([]);
  const [unlockUntil, setUnlockUntil] = useState<number | null>(null);
  const [budget, setBudget] = useState({ used: 0, dropped: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [sheet, setSheet] = useState<{ blocker: Blocker; isNew: boolean } | null>(null);
  const native = auth !== 'unsupported';

  const load = useCallback(() => {
    setAuth(AppBlocking.getAuthorizationStatus());
    setSelection(AppBlocking.getStoredSelection());
    setCounts(AppBlocking.selectionCounts());
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

  const saveRules = (next: PresetRule[]) => {
    AppBlocking.saveBlockRules(next as BlockRule[]);
    load();
    void syncHabits();
  };

  const chooseApps = async () => {
    if (busy) return;
    if (!native) {
      setNotice('You choose your apps in the Intentional iPhone app.');
      return;
    }
    setBusy(true);
    setNotice(null);
    let status = AppBlocking.getAuthorizationStatus();
    if (status === 'notDetermined') status = await AppBlocking.requestAuthorization();
    if (status !== 'approved') {
      setBusy(false);
      setAuth(status);
      setNotice('Turn on Screen Time for Intentional in iOS Settings.');
      return;
    }
    const picked = await AppBlocking.presentPicker();
    setBusy(false);
    if (picked) {
      hapticSuccess();
      load();
      void syncHabits();
    }
  };

  const toggleHabits = async () => {
    const ok = await confirmAsync(
      duringHabits
        ? { title: 'Stop blocking during your habits?', confirmLabel: 'Stop', destructive: true }
        : { title: 'Block during your habits?', message: 'Your apps lock while a habit with a start time runs.', confirmLabel: 'Block' }
    );
    if (!ok) return;
    hapticLight();
    AppBlocking.setBlockingDuringHabits(!duringHabits);
    load();
    void syncHabits();
  };

  const blockers = blockersFromRules(rules);
  const openBlocker = (id: string) => {
    const b = blockers.find((x) => x.id === id);
    if (b) setSheet({ blocker: b, isNew: false });
  };
  const tapPreset = (id: string) => {
    if (presetIsOn(rules, id)) {
      openBlocker(`preset:${id}`);
      return;
    }
    hapticSuccess();
    saveRules(addPreset(rules, id, () => newId()));
  };

  const cards = blockingNow({ now, rules, duringHabits, strictHabits: habits, unlockUntil });
  if (!duringHabits && habitCount > 0) {
    cards.push({ id: 'habits', title: 'During my habits', sub: `${habitCount} ${habitCount === 1 ? 'habit' : 'habits'} with a start time`, pill: { text: 'Off', tone: 'off' }, sticker: 'repeat' });
  }
  const live = cards.filter((c) => c.pill.tone === 'active' || c.pill.tone === 'unlocked' || c.pill.tone === 'always');
  const later = cards.filter((c) => !live.includes(c));
  const appCount = counts.apps + counts.categories + counts.sites;
  const onCard = (c: BlockCard) => (c.blockerId ? () => openBlocker(c.blockerId!) : c.id === 'habits' ? () => void toggleHabits() : undefined);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingTop: 10, paddingBottom: 140 + insets.bottom }}>
        <View style={{ paddingHorizontal: 20 }}>
          {/* Header */}
          <Animated.View entering={enter(0)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
            <Text accessibilityRole="header" style={{ ...Type.display, flex: 1 }}>
              Block
            </Text>
            <PressableScale
              onPress={() => setSheet({ blocker: newBlocker(newId()), isNew: true })}
              accessibilityRole="button"
              accessibilityLabel="Add blocker"
              style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: Surface.ink, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Ionicons name="add-circle" size={18} color={Surface.surface} />
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Surface.surface }}>Add blocker</Text>
            </PressableScale>
          </Animated.View>

          <SectionTitle>Blocking now</SectionTitle>
          <View style={{ gap: 10 }}>
            {live.map((c, i) => (
              <BlockerCard key={c.id} card={c} index={i + 1} selection={selection} count={appCount} onPress={onCard(c)} />
            ))}
          </View>

          {later.length ? (
            <>
              <SectionTitle>Scheduled</SectionTitle>
              <View style={{ gap: 10 }}>
                {later.map((c, i) => (
                  <BlockerCard key={c.id} card={c} index={i + 2} selection={selection} count={appCount} onPress={onCard(c)} />
                ))}
              </View>
            </>
          ) : null}

          <SectionTitle>Presets for you</SectionTitle>
        </View>

        {/* Presets: one tap adds; tapping one that's on opens it */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
          {BLOCK_PRESETS.map((p) => {
            const on = presetIsOn(rules, p.id);
            const [days, hours] = presetWhen(p).split(' · ');
            return (
              <PressableScale
                key={p.id}
                onPress={() => tapPreset(p.id)}
                accessibilityRole="switch"
                accessibilityLabel={`Preset ${p.name}`}
                accessibilityState={{ checked: on }}
                aria-checked={on}
                style={{ width: 164, borderRadius: 22, padding: 12, backgroundColor: p.bg, borderWidth: 2, borderColor: on ? p.accent : 'transparent' }}
              >
                <View style={{ alignItems: 'center', paddingTop: 4 }}>
                  <Sticker name={isStickerName(p.sticker) ? p.sticker : 'lock'} size={58} />
                </View>
                <Text numberOfLines={1} style={{ ...Type.heading, fontSize: 15, textAlign: 'center', marginTop: 8 }}>
                  {p.name}
                </Text>
                <Text numberOfLines={1} style={{ ...Type.meta, fontSize: 12, textAlign: 'center' }}>
                  {p.tagline}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 10 }}>
                  {[hours, days].map((t) => (
                    <View key={t} style={{ height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.75)', justifyContent: 'center' }}>
                      <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBold, fontSize: 10, color: p.accent }}>
                        {t}
                      </Text>
                    </View>
                  ))}
                </View>
                {on ? (
                  <View style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark" size={15} color={Surface.surface} />
                  </View>
                ) : null}
              </PressableScale>
            );
          })}
        </ScrollView>

        <View style={{ paddingHorizontal: 20 }}>
          <SectionTitle>Your apps</SectionTitle>
          <View style={{ borderRadius: Radius.card, padding: 14, backgroundColor: Surface.surface, ...Elevation.card }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 }}>
              {canShowSelectedApps() && selection ? (
                <SelectedApps selection={selection} maxIcons={7} iconSize={34} style={{ height: 38 }} />
              ) : (
                <>
                  <Sticker name="phone" size={30} />
                  <Text style={{ ...Type.heading, fontSize: 16, flex: 1 }}>{appCount > 0 ? `${appCount} chosen` : 'No apps chosen yet'}</Text>
                </>
              )}
              <PressableScale
                onPress={() => void chooseApps()}
                accessibilityRole="button"
                accessibilityLabel={selection ? 'Edit apps' : 'Choose apps'}
                style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: Surface.surfaceRaised, justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.ink }}>{selection ? 'Edit' : 'Choose'}</Text>
              </PressableScale>
            </View>
          </View>
          {notice ? <Text style={{ ...Type.meta, color: Accent.amber, marginTop: 10 }}>{notice}</Text> : null}

          {budget.dropped > 0 ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, padding: 14, borderRadius: Radius.md, backgroundColor: Accent.amberSoft }}>
              <Ionicons name="alert-circle" size={20} color={Accent.amber} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 14, lineHeight: 20, color: Surface.ink }}>
                iPhone watches {MAX_MONITORED_ACTIVITIES} blocking windows at most. {budget.dropped} {budget.dropped === 1 ? "doesn't" : "don't"} fit: use fewer days, or every day.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <BlockerSheet
        value={sheet?.blocker ?? null}
        isNew={!!sheet?.isNew}
        onClose={() => setSheet(null)}
        onSave={(b) => {
          hapticSuccess();
          setSheet(null);
          saveRules(upsertBlocker(rules, b, () => newId()));
        }}
        onDelete={async (b) => {
          const ok = await confirmAsync({ title: `Delete ${b.name || 'this blocker'}?`, confirmLabel: 'Delete', destructive: true });
          if (!ok) return;
          setSheet(null);
          saveRules(removeBlocker(rules, b.id));
        }}
      />
    </SafeAreaView>
  );
}
