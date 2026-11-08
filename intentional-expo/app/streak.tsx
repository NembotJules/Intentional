/**
 * US-111 · The streak moment: a full screen opened from the flame on Today. Warm sunburst, Flick holding up a
 * flame, the huge day count, one short line, and this week's seven days (a flame on each day given).
 * A day counts when you gave a pillar any time (a focus session or a habit done): services/dayStreak.
 */
import { useMemo } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { X } from 'lucide-react-native';
import * as api from '@/db/api';
import { Mascot } from '@/components/onboarding/Mascot';
import { Sticker } from '@/components/ui/Sticker';
import { PressableScale } from '@/components/ui/motion';
import { Elevation, FontFamily, Surface } from '@/constants/design';
import { currentDayStreak, streakLine, weekDays } from '@/services/dayStreak';
import { localDayKey } from '@/utils/dates';

const RAYS = 16;

export default function StreakScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { n, week, stage } = useMemo(() => {
    const today = localDayKey();
    const days = api.getGivenDays();
    return { n: currentDayStreak(days, today), week: weekDays(days, today), stage: api.getFlickState().stage.index };
  }, []);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/today'));
  const cx = width / 2;
  const cy = height * 0.3;
  const R = Math.max(width, height);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFE3C2' }}>
      <Stack.Screen options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
      <StatusBar style="dark" />
      {/* the sunburst */}
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="streakGlow" cx={cx} cy={cy} r={R * 0.7} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFF4E2" />
            <Stop offset="0.5" stopColor="#FFD9AE" />
            <Stop offset="1" stopColor="#FFC68C" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#streakGlow)" />
        <G opacity={0.35}>
          {Array.from({ length: RAYS }, (_, i) => {
            const a = (i / RAYS) * Math.PI * 2;
            const b = a + Math.PI / RAYS;
            return <Path key={i} d={`M${cx} ${cy} L${cx + Math.cos(a) * R} ${cy + Math.sin(a) * R} L${cx + Math.cos(b) * R} ${cy + Math.sin(b) * R} Z`} fill="#FFFFFF" />;
          })}
        </G>
      </Svg>

      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 6 }}>
          <PressableScale
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} color={Surface.ink} strokeWidth={2.6} />
          </PressableScale>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Animated.View entering={ZoomIn.springify().damping(14)} style={{ alignItems: 'center' }}>
            <View>
              <Mascot mood="proud" size={150} intensity={1} arms="lift" stage={stage} />
              <View style={{ position: 'absolute', right: -26, top: 6 }}>
                <Sticker name="flame" size={48} />
              </View>
            </View>
          </Animated.View>
          <Animated.Text
            entering={FadeIn.delay(150).duration(300)}
            accessibilityLabel={`${n} day streak`}
            style={{ marginTop: 18, fontFamily: FontFamily.bodyBlack, fontSize: 104, lineHeight: 112, color: Surface.ink, fontVariant: ['tabular-nums'] }}
          >
            {n}
          </Animated.Text>
          <Text style={{ fontFamily: FontFamily.bodyBlack, fontSize: 30, lineHeight: 36, color: Surface.ink, marginTop: -6 }}>day streak!</Text>
          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 16, lineHeight: 22, color: '#6E5A48', marginTop: 8, textAlign: 'center' }}>{streakLine(n)}</Text>
        </View>

        {/* this week */}
        <Animated.View
          entering={FadeIn.delay(300).duration(300)}
          style={{ marginHorizontal: 20, marginBottom: 24, padding: 16, borderRadius: 24, backgroundColor: Surface.surface, ...Elevation.card }}
        >
          <Text style={{ fontFamily: FontFamily.bodyBlack, fontSize: 17, color: Surface.ink, marginBottom: 12 }}>This week</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {week.map((d) => (
              <View key={d.key} accessible accessibilityLabel={`${d.key}: ${d.done ? 'given' : d.future ? 'to come' : 'not given'}`} style={{ alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: d.done ? '#FFE1C2' : Surface.track,
                    borderWidth: d.isToday ? 2.5 : 0,
                    borderColor: '#F27B2E',
                  }}
                >
                  {d.done ? <Sticker name="flame" size={26} /> : null}
                </View>
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 12, color: d.isToday ? '#F27B2E' : Surface.greyText }}>{d.isToday ? 'Today' : d.letter}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: Surface.greyText, marginTop: 12 }}>A day counts when you give a pillar any time.</Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
