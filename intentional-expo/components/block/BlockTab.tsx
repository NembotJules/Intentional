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
import { PillButton } from '@/components/ui/kit';
import { Mascot, type MascotMood } from '@/components/onboarding/Mascot';
import type { StickerName } from '@/components/ui/Sticker';
import { Sticker, isStickerName } from '@/components/ui/Sticker';
import { StatusPill } from '@/components/block/BlockArt';
import { BlockerSheet } from '@/components/block/BlockerSheet';
import { SelectedApps, canShowSelectedApps } from '@/modules/family-controls/SelectedApps';
import { Accent, Elevation, FontFamily, Radius, Surface, hexToRgba } from '@/constants/design';
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
  <Text accessibilityRole="header" style={{ fontFamily: FontFamily.bodyBlack, fontSize: 20, lineHeight: 26, color: Surface.ink, marginTop: 24, marginBottom: 10 }}>
    {children}
  </Text>
);

/** US-112: the light strip inside a card: "Your apps" on the left, the blocked apps' icons on the right. */
function AppsStrip({ selection, count }: { selection: string | null; count: number }) {
  const icons = canShowSelectedApps() && !!selection;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, height: 48, paddingHorizontal: 14, borderRadius: 16, backgroundColor: Surface.field }}>
      <Text style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.greyText }}>Your apps</Text>
      {icons ? (
        <SelectedApps selection={selection} maxIcons={6} iconSize={28} style={{ height: 32 }} />
      ) : count > 0 ? (
        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.ink }}>{count} chosen</Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: 5 }}>
          {[0, 1].map((k) => (
            <View key={k} style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Surface.fieldBorder, backgroundColor: Surface.surface }} />
          ))}
        </View>
      )}
    </View>
  );
}

function BlockerCard({ card, selection, count, onPress, index }: { card: BlockCard; selection: string | null; count: number; onPress?: () => void; index: number }) {
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: Surface.field, alignItems: 'center', justifyContent: 'center' }}>
          <Sticker name={isStickerName(card.sticker) ? card.sticker : 'lock'} size={34} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBlack, fontSize: 17, lineHeight: 22, color: Surface.ink }}>
            {card.title}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: Surface.greyText, marginTop: 1 }}>
            {card.sub}
          </Text>
        </View>
        <StatusPill text={card.pill.text} tone={card.pill.tone} />
      </View>
      <AppsStrip selection={selection} count={count} />
    </>
  );
  const style = { borderRadius: 24, padding: 14, backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.hairline, ...Elevation.card };
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

/** US-112: a preset's picture: Flick in the mood of the moment, holding up its sticker (a moon, a cup, a briefcase…). */
const PRESET_MOOD: Record<string, MascotMood> = { bedtime: 'sleepy', winddown: 'calm', morning: 'happy', work: 'focus', dinner: 'proud' };
function PresetScene({ presetId, sticker }: { presetId: string; sticker: StickerName }) {
  return (
    <View style={{ height: 92, alignItems: 'center', justifyContent: 'flex-end' }}>
      <Mascot mood={PRESET_MOOD[presetId] ?? 'happy'} size={84} intensity={0.7} bob={false} />
      <View style={{ position: 'absolute', right: 22, top: 2 }}>
        <Sticker name={sticker} size={40} />
      </View>
    </View>
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
  const appCount = counts.apps + counts.categories;
  const onCard = (c: BlockCard) => (c.blockerId ? () => openBlocker(c.blockerId!) : c.id === 'habits' ? () => void toggleHabits() : undefined);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.neutral }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingTop: 10, paddingBottom: 140 + insets.bottom }}>
        <View style={{ paddingHorizontal: 20 }}>
          {/* Header */}
          <Animated.View entering={enter(0)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
            <Text accessibilityRole="header" style={{ fontFamily: FontFamily.bodyBlack, fontSize: 34, lineHeight: 40, color: Surface.ink, flex: 1 }}>
              Block
            </Text>
            <PillButton
              label="Add blocker"
              size="sm"
              icon={<Ionicons name="add-circle" size={18} color={Surface.surface} />}
              onPress={() => setSheet({ blocker: newBlocker(newId()), isNew: true })}
              style={{ paddingHorizontal: 0 }}
            />
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
                style={{ width: 168, borderRadius: 24, padding: 12, paddingTop: 10, backgroundColor: p.bg, borderWidth: 2.5, borderColor: on ? p.accent : 'transparent' }}
              >
                <PresetScene presetId={p.id} sticker={isStickerName(p.sticker) ? p.sticker : 'lock'} />
                <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBlack, fontSize: 16, lineHeight: 21, color: Surface.ink, textAlign: 'center', marginTop: 6 }}>
                  {p.name}
                </Text>
                <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBold, fontSize: 12, color: hexToRgba(Surface.ink, 0.55), textAlign: 'center' }}>
                  {p.tagline}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 10 }}>
                  {[hours, days].map((t) => (
                    <View key={t} style={{ height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center' }}>
                      <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodyBold, fontSize: 11, color: Surface.ink }}>
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
          {/* Founder 2026-11-07: the real app icons (TikTok, Instagram…), never categories. On the web / Expo Go there are
              no app tokens, so empty icon slots stand in. */}
          <View style={{ borderRadius: 24, padding: 16, backgroundColor: Surface.surface, borderWidth: 1, borderColor: Surface.hairline, ...Elevation.card }}>
            <Text style={{ fontFamily: FontFamily.bodyBlack, fontSize: 17, color: Surface.ink }}>Blocked apps</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 10 }}>
              {canShowSelectedApps() && selection && counts.apps + counts.categories > 0 ? (
                <SelectedApps selection={selection} maxIcons={7} iconSize={36} style={{ height: 40 }} />
              ) : (
                <View accessibilityLabel="No apps chosen yet" style={{ flexDirection: 'row', gap: 8 }}>
                  {[0, 1, 2, 3].map((k) => (
                    <View key={k} style={{ width: 40, height: 40, borderRadius: 11, borderWidth: 2, borderStyle: 'dashed', borderColor: Surface.fieldBorder, backgroundColor: Surface.field }} />
                  ))}
                </View>
              )}
            </View>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: Surface.greyText, marginTop: 8 }}>Pick the apps themselves, like TikTok or Instagram.</Text>
          </View>
          <PillButton
            label={counts.apps > 0 ? 'Edit apps' : 'Choose apps'}
            variant="secondary"
            icon={<Ionicons name={counts.apps > 0 ? 'create-outline' : 'add-circle'} size={18} color={Surface.ink} />}
            onPress={() => void chooseApps()}
            style={{ marginTop: 10 }}
          />
          {notice ? <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: Accent.amber, marginTop: 10 }}>{notice}</Text> : null}

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
