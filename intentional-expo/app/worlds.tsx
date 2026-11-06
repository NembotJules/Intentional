/**
 * US-101 · Flick's worlds: every world, earned with real lifetime hours given (services/worldUnlocks).
 * Unlocked worlds can be chosen (stored as a setting; Today and the unlock scene draw it). Locked ones show as
 * dark silhouettes with the hours still to give, and can't be chosen.
 * Opened from the globe on Today's world, and from Settings → Flick's worlds.
 */
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { PressableScale, enter } from '@/components/ui/motion';
import { WorldPreview } from '@/components/world/WorldPreview';
import { Accent, FontFamily, Surface, Type } from '@/constants/design';
import { getSelectedWorld, getWorldStatuses, lifetimeHours, setSelectedWorld } from '@/services/worldChoice';
import { unlockLabel, type WorldStatus } from '@/services/worldUnlocks';
import { worldTheme } from '@/services/worldThemes';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

export default function WorldsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [worlds, setWorlds] = useState<WorldStatus[]>(() => getWorldStatuses());
  const [chosen, setChosen] = useState(() => getSelectedWorld());
  const [note, setNote] = useState<string | null>(null);
  const stage = api.getFlickState().stage.index;

  useFocusEffect(
    useCallback(() => {
      setWorlds(getWorldStatuses());
      setChosen(getSelectedWorld());
    }, [])
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/today'));
  const cardW = Math.min(440, width) - 40;

  const pick = (w: WorldStatus) => {
    if (!w.unlocked) {
      hapticLight();
      setNote(`${w.name} opens after ${w.hoursToUnlock.toLocaleString('en-US')} more ${w.hoursToUnlock === 1 ? 'hour' : 'hours'} given to your pillars.`);
      return;
    }
    if (setSelectedWorld(w.id)) {
      hapticSuccess();
      setChosen(w.id);
      setNote(`Flick now lives in ${w.name}.`);
    }
  };

  const hours = Math.floor(lifetimeHours());
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 }}>
        <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
          <Pressable
            onPress={back}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={22} color={Surface.ink} />
          </Pressable>
          <Text accessibilityRole="header" style={{ ...Type.display, marginTop: 14 }}>
            Flick’s worlds
          </Text>
          <Text style={{ ...Type.body, color: Surface.muted, marginTop: 6 }}>
            Every world is earned with hours given to your pillars. You’ve given {hours.toLocaleString('en-US')} {hours === 1 ? 'hour' : 'hours'} so far.
          </Text>
          {note ? (
            <Animated.Text key={note} entering={FadeIn.duration(220)} accessibilityLiveRegion="polite" style={{ ...Type.meta, color: Surface.ink, marginTop: 10 }}>
              {note}
            </Animated.Text>
          ) : null}

          <View style={{ gap: 14, marginTop: 18 }}>
            {worlds.map((w, i) => {
              const isChosen = w.id === chosen;
              return (
                <Animated.View key={w.id} entering={enter(i)}>
                  <PressableScale
                    onPress={() => pick(w)}
                    scaleTo={0.98}
                    accessibilityRole="button"
                    accessibilityLabel={w.unlocked ? `World: ${w.name}${isChosen ? ', chosen' : ''}` : `World: ${w.name}, locked, ${unlockLabel(w)}`}
                    accessibilityState={{ selected: isChosen, disabled: !w.unlocked }}
                    style={{ borderRadius: 26, padding: 6, backgroundColor: isChosen ? Surface.ink : Surface.surface, borderWidth: 1, borderColor: Surface.rule }}
                  >
                    <View>
                      <WorldPreview themeId={w.id} width={cardW - 12} height={Math.round((cardW - 12) * 0.46)} locked={!w.unlocked} stage={stage} />
                      {!w.unlocked ? (
                        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: 'rgba(255,252,247,0.92)' }}>
                            <Ionicons name="lock-closed" size={14} color={Surface.ink} />
                            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.ink }}>{unlockLabel(w)}</Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 17, color: isChosen ? Surface.surface : Surface.ink }}>{w.name}</Text>
                        <Text style={{ ...Type.meta, color: isChosen ? Surface.focusMuted : Surface.muted }}>
                          {w.unlocked ? worldTheme(w.id).tagline : `Opens at ${w.unlockHours.toLocaleString('en-US')} hours`}
                        </Text>
                      </View>
                      {isChosen ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="checkmark-circle" size={20} color={Accent.green} />
                          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.surface }}>Flick lives here</Text>
                        </View>
                      ) : null}
                    </View>
                  </PressableScale>
                </Animated.View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
