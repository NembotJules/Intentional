/**
 * US-097 · A Flick you can touch. Wraps `FlickAnimated` (US-118: the Lottie loops; the SVG Mascot when the flame is low) with:
 *  - tap → squash & stretch, a hop, a burst of sparks, a light haptic, a short reaction face
 *    (a sleepy Flick wakes with a start), and a speech bubble with the next of `lines`;
 *  - `pulseKey` changes (a habit checked off…) → a proud hop with sparks, no bubble.
 * The bubble hides itself after a few seconds. Works in Expo Go and on the web (Reanimated only).
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeOut, ZoomIn, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, Easing } from 'react-native-reanimated';
import type { MascotMood } from '@/components/onboarding/Mascot';
import { FlickAnimated } from '@/components/flick/FlickAnimated';
import { FontFamily, Motion, Surface } from '@/constants/design';
import { lineAt } from '@/services/flickLife';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

const SPARKS = 8;
const BUBBLE_MS = 3600;
const REACT_MS = 1100;

function Spark({ index, burst }: { index: number; burst: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!burst) return;
    t.value = 0;
    t.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
  }, [burst, t]);
  const angle = (index / SPARKS) * Math.PI * 2 - Math.PI / 2;
  const style = useAnimatedStyle(() => {
    const d = 18 + 34 * t.value;
    return {
      opacity: t.value === 0 ? 0 : 1 - t.value,
      transform: [{ translateX: Math.cos(angle) * d }, { translateY: Math.sin(angle) * d }, { scale: 1 - 0.5 * t.value }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: '50%', top: '45%', width: 8, height: 8, marginLeft: -4, marginTop: -4, borderRadius: 4, backgroundColor: index % 2 ? '#FFB547' : '#FF7A3A' }, style]}
    />
  );
}

export function LiveFlick({
  mood,
  intensity,
  stage,
  size = 92,
  lines = [],
  pulseKey,
  bubbleSide = 'left',
  label = 'Flick',
}: {
  mood: MascotMood;
  intensity: number;
  stage?: number;
  size?: number;
  /** What Flick says, one per tap (services/flickLife). No lines → no bubble, still reacts. */
  lines?: string[];
  /** Change it to make Flick hop proudly (e.g. the number of habits done). */
  pulseKey?: number | string;
  bubbleSide?: 'left' | 'top';
  label?: string;
}) {
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const y = useSharedValue(0);
  const [burst, setBurst] = useState(0);
  const [reaction, setReaction] = useState<MascotMood | null>(null);
  const [taps, setTaps] = useState(0);
  const [bubble, setBubble] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  const hop = (height: number) => {
    sx.value = withSequence(withTiming(1.14, { duration: 90 }), withTiming(0.92, { duration: 120 }), withSpring(1, Motion.spring));
    sy.value = withSequence(withTiming(0.84, { duration: 90 }), withTiming(1.1, { duration: 120 }), withSpring(1, Motion.spring));
    y.value = withSequence(withTiming(0, { duration: 90 }), withTiming(-height, { duration: 180, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 9, stiffness: 180 }));
    setBurst((b) => b + 1);
  };

  const react = (face: MascotMood) => {
    setReaction(face);
    later(() => setReaction(null), REACT_MS);
  };

  // A habit checked off, a step done…: a proud little hop (skips the first render).
  const firstPulse = useRef(true);
  useEffect(() => {
    if (firstPulse.current) {
      firstPulse.current = false;
      return;
    }
    hapticSuccess();
    hop(size * 0.16);
    react('proud');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseKey]);

  const onPress = () => {
    hapticLight();
    hop(size * 0.12);
    react(mood === 'sleepy' ? 'shock' : mood === 'worried' ? 'worried' : 'happy');
    if (lines.length) {
      setBubble(lineAt(lines, taps));
      setTaps((n) => n + 1);
      timers.current.forEach(clearTimeout);
      timers.current = [];
      later(() => setReaction(null), REACT_MS);
      later(() => setBubble(null), BUBBLE_MS);
    }
  };

  const body = useAnimatedStyle(() => ({
    transformOrigin: 'center bottom',
    transform: [{ translateY: y.value }, { scaleX: sx.value }, { scaleY: sy.value }],
  }));

  const shown = reaction ?? mood;
  return (
    <View style={{ width: size, height: size }}>
      {bubble ? (
        <Animated.View
          key={bubble + taps}
          entering={ZoomIn.springify().damping(Motion.spring.damping)}
          exiting={FadeOut.duration(Motion.durationFast)}
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              zIndex: 10,
              maxWidth: 230,
              minWidth: 150,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 16,
              backgroundColor: Surface.ink,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            },
            bubbleSide === 'left' ? { right: size * 0.82, top: size * 0.05 } : { bottom: size * 0.98, alignSelf: 'center' },
          ]}
        >
          {/* the tail, pointing at Flick */}
          <View
            style={[
              { position: 'absolute', width: 12, height: 12, backgroundColor: Surface.ink, transform: [{ rotate: '45deg' }] },
              bubbleSide === 'left' ? { right: -5, top: 16 } : { bottom: -5, alignSelf: 'center' },
            ]}
          />
          <Text accessibilityLabel={`Flick says: ${bubble}`} accessibilityLiveRegion="polite" style={{ color: Surface.surface, fontFamily: FontFamily.bodySemiBold, fontSize: 14, lineHeight: 19 }}>
            {bubble}
          </Text>
        </Animated.View>
      ) : null}
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Tap Flick" hitSlop={8} style={{ width: size, height: size }}>
        <Animated.View style={body}>
          <FlickAnimated mood={shown} size={size} intensity={reaction ? Math.max(intensity, 0.75) : intensity} stage={stage} />
        </Animated.View>
        {Array.from({ length: SPARKS }, (_, k) => (
          <Spark key={k} index={k} burst={burst} />
        ))}
      </Pressable>
    </View>
  );
}
