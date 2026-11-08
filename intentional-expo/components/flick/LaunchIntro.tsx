/**
 * US-121 · The launch moment: the native splash (assets/images/splash-icon.png = the hearth stones with one ember,
 * on cream) hands over to this overlay, which plays `flick-ignite.json` from that same picture: the ember catches,
 * Flick pops up and waves, "Intentional" fades in, then the overlay fades away over the app.
 *
 * The overlay never takes taps (pointerEvents none), shows once per cold start, and is skipped with Reduce Motion.
 * The Lottie box is 200 × 200 in the middle of the screen, like the splash image (`imageWidth: 200` in app.json).
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text } from 'react-native';
import LottieView from 'lottie-react-native';
import { Camp, FontFamily } from '@/constants/design';

const IGNITE = require('@/assets/lottie/flick-ignite.json');
export const LAUNCH_BOX = 200;
const CLIP_MS = 2000;

export function LaunchIntro({ ready }: { ready: boolean }) {
  const [gone, setGone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const word = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!alive) return;
        if (reduce) {
          setGone(true);
          return;
        }
        Animated.timing(word, { toValue: 1, duration: 420, delay: 1250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        timers.push(
          setTimeout(() => {
            Animated.timing(fade, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => alive && setGone(true));
          }, CLIP_MS + 250)
        );
      });
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [ready, fade, word]);

  if (gone) return null;
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { backgroundColor: Camp.canvas, alignItems: 'center', justifyContent: 'center', opacity: fade, zIndex: 1000 }]}>
      {ready ? (
        <LottieView source={IGNITE} autoPlay loop={false} style={{ width: LAUNCH_BOX, height: LAUNCH_BOX }} webStyle={{ width: LAUNCH_BOX, height: LAUNCH_BOX }} />
      ) : null}
      <Animated.View style={{ position: 'absolute', top: '50%', marginTop: LAUNCH_BOX / 2 + 8, opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
        <Text style={{ fontFamily: FontFamily.bodyBlack, fontSize: 30, letterSpacing: -0.5, color: Camp.bark }}>Intentional</Text>
      </Animated.View>
    </Animated.View>
  );
}
