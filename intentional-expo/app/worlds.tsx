/**
 * US-101 · Flick's worlds: every world, earned with real lifetime hours given (services/worldUnlocks).
 * Unlocked worlds can be chosen (stored as a setting; Today and the unlock scene draw it). Locked ones show as
 * dark silhouettes with the hours still to give, and can't be chosen.
 * Opened from the worlds button on Today, and from Settings → Flick's worlds.
 * US-114: drawn as a winding path of world stops, coloured up to where you are, with Flick at "You're here".
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
import { Accent, Elevation, FontFamily, Surface, Type } from '@/constants/design';
import Svg, { Path } from 'react-native-svg';
import { Mascot } from '@/components/onboarding/Mascot';
import { Sticker } from '@/components/ui/Sticker';
import { STOP, pathHeight, pathStops, segment, youAreHere } from '@/services/worldPath';
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
  const pathW = Math.min(440, width) - 40;
  const stops = pathStops(worlds, pathW);
  const here = youAreHere(stops, lifetimeHours());
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.neutral }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 }}>
        <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
          <Pressable
            onPress={back}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: Surface.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={22} color={Surface.ink} />
          </Pressable>
          <Text accessibilityRole="header" style={{ fontFamily: FontFamily.bodyBlack, fontSize: 32, lineHeight: 38, color: Surface.ink, marginTop: 14 }}>
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

          {/* US-114: the worlds as a winding path, coloured up to where you are */}
          <View style={{ height: pathHeight(stops.length), marginTop: 18 }}>
            <Svg width={pathW} height={pathHeight(stops.length)} style={{ position: 'absolute', left: 0, top: 0 }}>
              {stops.slice(1).map((st, i) => {
                const reached = st.status.unlocked;
                return (
                  <Path
                    key={st.id}
                    d={segment(stops[i]!, st)}
                    stroke={reached ? '#FF9F43' : '#D8D5E0'}
                    strokeWidth={12}
                    strokeLinecap="round"
                    strokeDasharray={reached ? undefined : '2 18'}
                    fill="none"
                  />
                );
              })}
            </Svg>
            {stops.map((st, i) => {
              const w = st.status;
              const isChosen = w.id === chosen;
              return (
                <Animated.View key={w.id} entering={enter(i)} style={{ position: 'absolute', left: st.x, top: st.y, width: STOP }}>
                  <PressableScale
                    onPress={() => pick(w)}
                    scaleTo={0.96}
                    accessibilityRole="button"
                    accessibilityLabel={w.unlocked ? `World: ${w.name}${isChosen ? ', chosen' : ''}` : `World: ${w.name}, locked, ${unlockLabel(w)}`}
                    accessibilityState={{ selected: isChosen, disabled: !w.unlocked }}
                    style={{ borderRadius: 26, padding: 4, backgroundColor: Surface.surface, borderWidth: 3, borderColor: isChosen ? '#FF9F43' : Surface.surface, ...Elevation.card }}
                  >
                    <WorldPreview themeId={w.id} width={STOP - 14} height={STOP - 14} locked={!w.unlocked} stage={stage} />
                    {!w.unlocked ? (
                      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                        <Sticker name="lock" size={34} />
                      </View>
                    ) : null}
                  </PressableScale>
                  <View
                    pointerEvents="none"
                    style={{ position: 'absolute', top: 18, width: Math.max(120, pathW - STOP - 70), ...(st.side === 'left' ? { left: STOP + 14 } : { right: STOP + 14, alignItems: 'flex-end' }) }}
                  >
                    <Text style={{ fontFamily: FontFamily.bodyBlack, fontSize: 18, color: Surface.ink }}>{w.name}</Text>
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: Surface.greyText, textAlign: st.side === 'left' ? 'left' : 'right' }}>
                      {w.unlocked ? (isChosen ? 'Flick lives here' : worldTheme(w.id).tagline) : `Opens at ${w.unlockHours.toLocaleString('en-US')} hours`}
                    </Text>
                    {isChosen ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Ionicons name="checkmark-circle" size={18} color={Accent.green} />
                      </View>
                    ) : null}
                  </View>
                </Animated.View>
              );
            })}
            {here ? (
              <View pointerEvents="none" style={{ position: 'absolute', left: here.x - 70, top: here.y - 34, width: 140, alignItems: 'center' }}>
                <Mascot mood="happy" size={50} intensity={0.9} bob={false} stage={stage} />
                <Text style={{ fontFamily: FontFamily.bodyBlack, fontSize: 14, color: Surface.ink, marginTop: -2 }}>You’re here</Text>
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 12, color: Surface.greyText }}>
                  {here.next.status.hoursToUnlock.toLocaleString('en-US')} h to {here.next.status.name}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
