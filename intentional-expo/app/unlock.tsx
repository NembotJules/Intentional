/**
 * US-096 · Unlock with intention. Opened from the blocked app's screen ("Unlock with intention" → a
 * notification → here), or from Blocking rules → "Try the unlock screen".
 *
 * One step of friction: type "I choose my phone over Body for 10 minutes." exactly (no pasting), then the
 * apps open for 5, 10 or 15 minutes and iOS blocks them again on its own. "Keep it blocked" is the big
 * button. A focus session can't be unlocked here (it's ended in Focus). In Expo Go / on the web this is a
 * preview: the flow runs, nothing is unlocked.
 */
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { CTA } from '@/components/onboarding/parts';
import { Mascot } from '@/components/onboarding/Mascot';
import { Chip } from '@/components/focus/parts';
import { ProgressBar } from '@/components/ui/motion';
import { Accent, FontFamily, Surface, Type } from '@/constants/design';
import * as AppBlocking from '@/services/appBlocking';
import { isRuleBlockId } from '@/services/blockRules';
import {
  DEFAULT_UNLOCK_MINUTES,
  UNLOCK_MINUTES,
  clockLabel,
  sentenceMatches,
  sentenceOffTrack,
  sentenceProgress,
  unlockErrorText,
  unlockScreenState,
  unlockSentence,
  type UnlockMinutes,
  type UnlockScreenState,
} from '@/services/unlock';
import { hapticSuccess } from '@/utils/haptics';

const card = { backgroundColor: Surface.surfaceRaised, borderRadius: 18, padding: 16 } as const;

function readState(): UnlockScreenState {
  return unlockScreenState({
    native: AppBlocking.canUnlock(),
    focusShieldsOn: AppBlocking.focusShieldsOn(),
    unlockUntil: AppBlocking.getUnlockUntil(),
    activeBlock: AppBlocking.getActiveHabitBlock(),
    now: Date.now(),
  });
}

export default function UnlockScreen() {
  const router = useRouter();
  const [state, setState] = useState<UnlockScreenState>(readState);
  const [minutes, setMinutes] = useState<UnlockMinutes>(DEFAULT_UNLOCK_MINUTES);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [previewDone, setPreviewDone] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setState(readState());
    }, [])
  );

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/today'));

  // What the sentence trades the phone against: the blocked habit's pillar; block hours (or a preview) → a pillar or "my goals".
  const pillarName = useMemo(() => {
    const habitId = state.kind === 'blocked' ? state.habitId : null;
    if (habitId && !isRuleBlockId(habitId)) {
      const h = api.getAllActionsWithGoal().find((a) => a.id === habitId);
      if (h?.goal_name) return h.goal_name;
    }
    if (state.kind === 'preview') return api.getAllPillarsSync().find((p) => !p.is_archived)?.name ?? null;
    return null;
  }, [state]);
  const habitName = useMemo(() => {
    const habitId = state.kind === 'blocked' ? state.habitId : null;
    if (!habitId || isRuleBlockId(habitId)) return null;
    return api.getAllActionsWithGoal().find((a) => a.id === habitId)?.name ?? null;
  }, [state]);

  const sentence = unlockSentence(pillarName, minutes);
  const matched = sentenceMatches(typed, sentence);
  const offTrack = sentenceOffTrack(typed, sentence);

  const unlock = () => {
    if (!matched) return;
    setError(null);
    if (state.kind === 'preview') {
      hapticSuccess();
      setPreviewDone(true);
      return;
    }
    const r = AppBlocking.unlockFor(minutes);
    if (!r.ok || !r.until) {
      setError(unlockErrorText(r.error));
      setState(readState());
      return;
    }
    hapticSuccess();
    setTyped('');
    setState({ kind: 'unlocked', until: r.until });
  };

  const relock = () => {
    AppBlocking.relockNow();
    setState(readState());
  };

  const showFlow = (state.kind === 'blocked' || state.kind === 'preview') && !previewDone;
  const title =
    state.kind === 'unlocked' || previewDone
      ? 'Unlocked, on purpose'
      : state.kind === 'focus'
        ? 'You’re in a focus session'
        : state.kind === 'not-blocked'
          ? 'Nothing is blocked'
          : 'Is this intentional?';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
            <Pressable
              onPress={leave}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-back" size={22} color={Surface.ink} />
            </Pressable>
            <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 12 }}>
              <Mascot mood={showFlow ? 'think' : state.kind === 'unlocked' || previewDone ? 'calm' : 'happy'} size={104} intensity={0.7} />
            </View>
            <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center' }}>
              {title}
            </Text>

            {state.kind === 'preview' && !previewDone ? (
              <Text style={{ ...Type.meta, textAlign: 'center', marginTop: 8 }}>Preview: on our iPhone build, a blocked app sends you here. Nothing is unlocked in this version.</Text>
            ) : null}

            {showFlow ? (
              <>
                <Text style={{ ...Type.body, textAlign: 'center', marginTop: 8 }}>
                  {state.kind === 'blocked' && state.until
                    ? `Your apps are blocked until ${clockLabel(state.until)}${habitName ? `, for ${habitName}` : ''}.`
                    : 'Your apps are blocked so your hours go where you chose.'}{' '}
                  If you really need one, say it.
                </Text>

                <Text style={{ ...Type.meta, marginTop: 22, marginBottom: 8 }}>For how long</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {UNLOCK_MINUTES.map((m) => (
                    <Chip
                      key={m}
                      label={`${m} min`}
                      on={minutes === m}
                      onPress={() => {
                        setMinutes(m);
                        setTyped('');
                      }}
                      accessibilityLabel={`Unlock for ${m} minutes`}
                    />
                  ))}
                </View>

                <View style={{ ...card, marginTop: 18 }}>
                  <Text style={{ ...Type.meta }}>Type this to unlock</Text>
                  <Text accessibilityLabel={`Sentence: ${sentence}`} style={{ ...Type.heading, marginTop: 6 }}>
                    {sentence}
                  </Text>
                </View>
                <TextInput
                  value={typed}
                  onChangeText={(v) => {
                    setTyped(v);
                    if (error) setError(null);
                  }}
                  placeholder="Type the sentence…"
                  placeholderTextColor={Surface.faint}
                  accessibilityLabel="Type the sentence"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="off"
                  contextMenuHidden
                  multiline
                  style={{
                    marginTop: 10,
                    minHeight: 76,
                    backgroundColor: Surface.surface,
                    borderWidth: 2,
                    borderColor: matched ? Accent.green : offTrack ? Accent.amber : Surface.ruleStrong,
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: Surface.ink,
                    fontFamily: FontFamily.bodySemiBold,
                    fontSize: 17,
                    textAlignVertical: 'top',
                  }}
                />
                <View style={{ marginTop: 8 }}>
                  <ProgressBar progress={sentenceProgress(typed, sentence)} color={offTrack ? Accent.amber : Surface.ink} trackColor={Surface.hill} height={4} />
                </View>
                <Text style={{ ...Type.meta, marginTop: 6, color: offTrack ? Accent.amber : Surface.muted }}>
                  {matched ? 'That’s it.' : offTrack ? 'Not quite: check the words.' : 'Word for word. No pasting.'}
                </Text>

                <View style={{ marginTop: 22 }}>
                  <CTA label="Keep it blocked" onPress={leave} />
                </View>
                <Pressable
                  onPress={unlock}
                  disabled={!matched}
                  accessibilityRole="button"
                  accessibilityLabel={`Unlock for ${minutes} min`}
                  accessibilityState={{ disabled: !matched }}
                  style={{ marginTop: 10, height: 54, borderRadius: 27, borderWidth: 2, borderColor: Surface.ink, alignItems: 'center', justifyContent: 'center', opacity: matched ? 1 : 0.3 }}
                >
                  <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 17 }}>Unlock for {minutes} min</Text>
                </Pressable>
              </>
            ) : null}

            {previewDone ? (
              <>
                <Text style={{ ...Type.body, textAlign: 'center', marginTop: 8 }}>
                  On our iPhone build, your apps would open now for {minutes} minutes, then block again on their own.
                </Text>
                <View style={{ marginTop: 22 }}>
                  <CTA label="Done" onPress={leave} />
                </View>
              </>
            ) : null}

            {state.kind === 'unlocked' ? (
              <>
                <Text accessibilityLabel={`Open until ${clockLabel(state.until)}`} style={{ ...Type.body, textAlign: 'center', marginTop: 8 }}>
                  Your apps are open until {clockLabel(state.until)}. They block again on their own.
                </Text>
                <View style={{ marginTop: 22 }}>
                  <CTA label="Block again now" onPress={relock} />
                </View>
                <Pressable onPress={() => router.replace('/(tabs)/today')} accessibilityRole="button" accessibilityLabel="Back to Today" style={{ paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>Back to Today</Text>
                </Pressable>
              </>
            ) : null}

            {state.kind === 'focus' ? (
              <>
                <Text style={{ ...Type.body, textAlign: 'center', marginTop: 8 }}>Your apps open when the session ends. Ending it early counts as ended early.</Text>
                <View style={{ marginTop: 22 }}>
                  <CTA label="Go to Focus" onPress={() => router.replace('/(tabs)/focus')} />
                </View>
              </>
            ) : null}

            {state.kind === 'not-blocked' ? (
              <>
                <Text style={{ ...Type.body, textAlign: 'center', marginTop: 8 }}>No habit or block hour is blocking your apps right now.</Text>
                <View style={{ marginTop: 22 }}>
                  <CTA label="Back to Today" onPress={() => router.replace('/(tabs)/today')} />
                </View>
              </>
            ) : null}

            {error ? <Text style={{ ...Type.meta, color: Accent.amber, textAlign: 'center', marginTop: 14 }}>{error}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
