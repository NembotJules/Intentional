/**
 * US-099 · "Start focusing": the sheet behind the big Focus button in the tab bar. Three choices, one button:
 *  - what: today's "Up next" pre-chosen (services/focusOptions), changeable from a short list;
 *  - how long: preset chips (+ the suggested length);
 *  - block apps: on/off on our iPhone build; on the web / Expo Go it shows on, with a note;
 *  - Start → the running-session screen, starting right away (focusStartHref).
 * "More options" opens the full Focus screen (pickers, history).
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown, Lock } from 'lucide-react-native';
import Animated, { Easing, FadeIn, SlideInDown } from 'react-native-reanimated';
import { Mascot } from '@/components/onboarding/Mascot';
import { Chip } from '@/components/focus/parts';
import { PillButton } from '@/components/ui/kit';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { PressableScale } from '@/components/ui/motion';
import { FontFamily, Radius, Surface, Type, hexToRgba } from '@/constants/design';
import * as AppBlocking from '@/services/appBlocking';
import { closeFocusSheet, focusStartHref, useFocusSheetOpen } from '@/services/focusSheet';
import { loadFocusOptions, type FocusOption } from '@/services/focusOptions';
import { durationChoices } from '@/services/upNext';
import { hapticLight, hapticMedium } from '@/utils/haptics';

function OptionRow({ o, selected, onPress }: { o: FocusOption; selected?: boolean; onPress?: () => void }) {
  const body = (
    <>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: hexToRgba(o.color, 0.14), alignItems: 'center', justifyContent: 'center' }}>
        <PillarIcon icon={o.icon} name={o.pillarName} color={o.color} size={40} tinted={false} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[Type.heading, { fontSize: 16 }]}>
          {o.title}
        </Text>
        <Text numberOfLines={1} style={[Type.meta, { marginTop: 1 }]}>
          {o.subtitle}
        </Text>
      </View>
    </>
  );
  const style = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: selected ? hexToRgba(o.color, 0.1) : Surface.surfaceRaised,
    borderWidth: 2,
    borderColor: selected ? hexToRgba(o.color, 0.5) : 'transparent',
  };
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Focus on ${o.title}`} style={style}>
      {body}
    </PressableScale>
  );
}

export function FocusSheet() {
  const router = useRouter();
  const open = useFocusSheetOpen();
  const [options, setOptions] = useState<FocusOption[]>([]);
  const [choice, setChoice] = useState<FocusOption | null>(null);
  const [minutes, setMinutes] = useState(25);
  const [picking, setPicking] = useState(false);
  const [block, setBlock] = useState(true);
  // US-125: the sheet slides in only once its options are loaded, so it never grows (jumps) mid-slide.
  const [ready, setReady] = useState(false);
  const nativeBlocking = AppBlocking.getAuthorizationStatus() !== 'unsupported';

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    setPicking(false);
    setBlock(true);
    let live = true;
    void loadFocusOptions().then(({ options: o, suggested }) => {
      if (!live) return;
      setOptions(o);
      setChoice(suggested);
      setMinutes(suggested?.minutes ?? 25);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [open]);

  const choose = (o: FocusOption) => {
    hapticLight();
    setChoice(o);
    setMinutes(o.minutes);
    setPicking(false);
  };

  const start = () => {
    if (!choice) return;
    hapticMedium();
    closeFocusSheet();
    router.push(focusStartHref({ pillarId: choice.pillarId, actionId: choice.actionId, taskId: choice.taskId, minutes, block: nativeBlocking ? block : true }) as never);
  };

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={closeFocusSheet}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View entering={FadeIn.duration(180)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Pressable style={{ flex: 1, backgroundColor: hexToRgba(Surface.ink, 0.45) }} onPress={closeFocusSheet} accessibilityRole="button" accessibilityLabel="Close Start focusing" />
        </Animated.View>
        {ready ? (
        <Animated.View
          entering={SlideInDown.duration(320).easing(Easing.out(Easing.cubic))}
          accessibilityLabel="Start focusing"
          style={{ maxHeight: '88%', backgroundColor: Surface.canvas, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 10, paddingBottom: 30 }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: Surface.ruleStrong, marginBottom: 10 }} />
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Mascot mood="focus" size={56} intensity={0.8} />
              <View style={{ flex: 1 }}>
                <Text accessibilityRole="header" style={Type.display}>
                  Start focusing
                </Text>
                <Text style={[Type.meta, { marginTop: 2 }]}>Your time goes to one pillar.</Text>
              </View>
            </View>

            <Text style={[Type.label, { marginTop: 22, marginBottom: 8 }]}>What</Text>
            {choice ? (
              <>
                <OptionRow o={choice} selected />
                <PressableScale
                  onPress={() => setPicking((p) => !p)}
                  accessibilityRole="button"
                  accessibilityLabel={picking ? 'Hide choices' : 'Change what to focus on'}
                  style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingVertical: 8 }}
                >
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.ink }}>{picking ? 'Hide choices' : 'Change'}</Text>
                  <View style={{ transform: [{ rotate: picking ? '180deg' : '0deg' }] }}>
                    <ChevronDown size={16} color={Surface.ink} strokeWidth={2.4} />
                  </View>
                </PressableScale>
                {picking ? (
                  <View style={{ gap: 8, marginBottom: 6 }}>
                    {options
                      .filter((o) => o.key !== choice.key)
                      .map((o) => (
                        <OptionRow key={o.key} o={o} onPress={() => choose(o)} />
                      ))}
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={Type.body}>Add a pillar first, in Goals.</Text>
            )}

            <Text style={[Type.label, { marginTop: 16, marginBottom: 8 }]}>How long</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {durationChoices(choice?.minutes ?? 25).map((m) => (
                <Chip key={m} label={`${m} min`} on={minutes === m} onPress={() => setMinutes(m)} accessibilityLabel={`${m} minutes`} />
              ))}
            </View>

            <Text style={[Type.label, { marginTop: 18, marginBottom: 8 }]}>Block apps</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Radius.md, backgroundColor: Surface.surfaceRaised }}>
              <Lock size={18} color={Surface.ink} strokeWidth={2.2} />
              <View style={{ flex: 1 }}>
                <Text style={[Type.heading, { fontSize: 16 }]}>Block distracting apps</Text>
                <Text style={[Type.meta, { marginTop: 1 }]}>{nativeBlocking ? 'The apps in your Blocking rules' : 'Works in the iPhone app. Here the timer runs alone.'}</Text>
              </View>
              <Pressable
                onPress={() => nativeBlocking && setBlock((b) => !b)}
                disabled={!nativeBlocking}
                accessibilityRole="switch"
                accessibilityLabel="Block apps"
                accessibilityState={{ checked: block, disabled: !nativeBlocking }}
                aria-checked={block}
                style={{ width: 52, height: 32, borderRadius: 16, padding: 3, justifyContent: 'center', backgroundColor: block ? Surface.ink : Surface.ruleStrong, opacity: nativeBlocking ? 1 : 0.55 }}
              >
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: Surface.surface, transform: [{ translateX: block ? 20 : 0 }] }} />
              </Pressable>
            </View>

            <PillButton label={`Start · ${minutes} min`} accessibilityLabel="Start focusing now" size="lg" onPress={start} disabled={!choice} style={{ marginTop: 22 }} />
            <PressableScale
              onPress={() => {
                closeFocusSheet();
                router.push('/(tabs)/focus' as never);
              }}
              accessibilityRole="button"
              accessibilityLabel="More focus options"
              style={{ height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}
            >
              <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Surface.muted }}>More options</Text>
            </PressableScale>
          </ScrollView>
        </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}
