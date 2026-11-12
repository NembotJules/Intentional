/**
 * US-126 · "New world unlocked!", a reveal instead of a still card (drawn by CelebrationHost after the stage-up that
 * earns the world, or from the development-only preview in Settings).
 *
 *   0.0 s  the world is its dark locked silhouette, a padlock on it; "10 hours given" above
 *   0.5 s  the padlock wobbles…
 *   1.0 s  …and pops open, flying off (a heavy thud)
 *   1.05 s colour sweeps in over the silhouette, the frame swells a little, light rays turn behind it
 *   1.5 s  Flick jumps in cheering (the cheer clip, then he stays proud), confetti, the success buzz, the title zooms in
 *   1.9 s  the name, its line and "Move Flick there" / "Later"
 *
 * With Reduce Motion it opens on the final state (no wobble, no confetti). Campfire look: a white frame with a bottom
 * lip in the world's darker colour, a white stomp button.
 */
import { useEffect, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { FlickAnimated } from '@/components/flick/FlickAnimated';
import { Confetti } from '@/components/onboarding/FlickScenes';
import { WorldPreview } from '@/components/world/WorldPreview';
import { PressableScale } from '@/components/ui/motion';
import { Sticker } from '@/components/ui/Sticker';
import { FontFamily, Type } from '@/constants/design';
import { worldTheme } from '@/services/worldThemes';
import { hapticHeavy, hapticSuccess } from '@/utils/haptics';
import { playJingle } from '@/services/sounds';

/** The world's colour, darker: the frame's lip and the button's text. */
function deeper(hex: string, f = 0.72): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.round(((n >> s) & 255) * f);
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
}

/** Soft light rays, turning slowly behind the frame. */
function Rays({ size }: { size: number }) {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(360, { duration: 40000, easing: Easing.linear }), -1, false);
  }, [spin]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const r = size / 2;
  const wedges = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const b = a + Math.PI / 24;
    return `M${r} ${r} L${r + r * Math.cos(a)} ${r + r * Math.sin(a)} L${r + r * Math.cos(b)} ${r + r * Math.sin(b)} Z`;
  }).join(' ');
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Path d={wedges} fill="#FFFFFF" opacity={0.13} />
      </Svg>
    </Animated.View>
  );
}

export function WorldUnlockReveal({
  worldId,
  stage,
  onTry,
  onLater,
}: {
  worldId: string;
  stage: number;
  onTry: () => void;
  onLater: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const theme = worldTheme(worldId);
  const lip = deeper(theme.celebrate);
  const pw = Math.min(width, 440) - 48;
  const ph = Math.round(pw * 0.66);
  const flickSize = Math.round(ph * 0.64);

  // 0 locked · 1 the padlock opened · 2 Flick is in (title, confetti) · 3 the buttons
  const [step, setStep] = useState(reduce ? 3 : 0);
  const color = useSharedValue(reduce ? 1 : 0);
  const swell = useSharedValue(reduce ? 1 : 0.94);
  const wobble = useSharedValue(0);
  const lockGone = useSharedValue(reduce ? 1 : 0);

  // US-129: its own music, timed to the reveal (the harp opens with the padlock at 1.0 s)
  useEffect(() => {
    playJingle('world');
  }, [worldId]);

  useEffect(() => {
    if (reduce) return;
    swell.value = withTiming(0.96, { duration: 400 });
    wobble.value = withDelay(500, withSequence(...[-14, 14, -12, 12, -6, 0].map((d) => withTiming(d, { duration: 80 }))));
    const timers = [
      setTimeout(() => {
        setStep(1);
        hapticHeavy();
        lockGone.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
        color.value = withDelay(50, withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }));
        swell.value = withDelay(50, withSequence(withTiming(1.04, { duration: 360, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 300 })));
      }, 1000),
      setTimeout(() => {
        setStep(2);
        hapticSuccess();
      }, 1500),
      setTimeout(() => setStep(3), 1900),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reduce, color, swell, wobble, lockGone]);

  const frameStyle = useAnimatedStyle(() => ({ transform: [{ scale: swell.value }] }));
  const colorStyle = useAnimatedStyle(() => ({ opacity: color.value }));
  const lockStyle = useAnimatedStyle(() => ({
    opacity: 1 - lockGone.value,
    transform: [{ translateY: -70 * lockGone.value }, { rotate: `${wobble.value + 25 * lockGone.value}deg` }, { scale: 1 + 0.25 * lockGone.value }],
  }));

  const hours = theme.unlockHours.toLocaleString('en-US');
  return (
    <View
      accessibilityViewIsModal
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000, backgroundColor: theme.celebrate }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <Text style={{ ...Type.eyebrow, color: '#FFFFFF', textAlign: 'center' }}>{`${hours} hours given`}</Text>
          </View>
          <View style={{ height: 96, justifyContent: 'center' }}>
            {step >= 2 ? (
              <Animated.Text
                entering={reduce ? undefined : ZoomIn.springify().damping(11)}
                accessibilityRole="header"
                style={{ ...Type.displayXL, fontSize: 38, lineHeight: 44, color: '#FFFFFF', textAlign: 'center' }}
              >
                New world unlocked!
              </Animated.Text>
            ) : (
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 18, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>Something opens…</Text>
            )}
          </View>

          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            {step >= 1 ? <Rays size={pw * 1.5} /> : null}
            <Animated.View
              style={[{ borderRadius: 30, padding: 7, backgroundColor: '#FFFFFF', borderBottomWidth: 6, borderBottomColor: lip }, frameStyle]}
              accessible
              accessibilityLabel={step >= 1 ? `${theme.name}, unlocked, with Flick celebrating` : `${theme.name}, locked`}
            >
              <View style={{ width: pw - 14, height: ph }}>
                <WorldPreview themeId={worldId} width={pw - 14} height={ph} locked />
                <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, colorStyle]}>
                  <WorldPreview themeId={worldId} width={pw - 14} height={ph} hideFlick />
                </Animated.View>
                {step >= 2 ? (
                  <Animated.View
                    entering={reduce ? undefined : ZoomIn.springify().damping(9).stiffness(140)}
                    pointerEvents="none"
                    style={{ position: 'absolute', left: 0, right: 0, bottom: ph * 0.04, alignItems: 'center' }}
                  >
                    <FlickAnimated mood={reduce ? 'proud' : 'cheer'} size={flickSize} intensity={1} stage={stage} />
                  </Animated.View>
                ) : null}
                <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, top: ph * 0.3, alignItems: 'center' }, lockStyle]}>
                  <Sticker name={step >= 1 ? 'unlock' : 'lock'} size={Math.round(ph * 0.34)} />
                </Animated.View>
              </View>
            </Animated.View>
          </View>

          <View style={{ height: 70, marginTop: 18, alignItems: 'center' }}>
            {step >= 3 ? (
              <Animated.View entering={reduce ? undefined : FadeInDown.duration(320)} style={{ alignItems: 'center' }}>
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 26, color: '#FFFFFF', textAlign: 'center' }}>{theme.name}</Text>
                <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: 'rgba(255,255,255,0.9)', marginTop: 4, textAlign: 'center' }}>{theme.tagline}</Text>
              </Animated.View>
            ) : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, paddingBottom: 16, gap: 6, width: '100%', maxWidth: 480, alignSelf: 'center', height: 124 }}>
          {step >= 3 ? (
            <Animated.View entering={reduce ? undefined : FadeIn.duration(300)} style={{ gap: 6 }}>
              <PressableScale
                onPress={onTry}
                accessibilityRole="button"
                accessibilityLabel="Move Flick there"
                style={{ height: 58, borderRadius: 999, backgroundColor: '#FFFFFF', borderBottomWidth: 5, borderBottomColor: lip, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 18, color: lip }}>Move Flick there</Text>
              </PressableScale>
              <PressableScale onPress={onLater} accessibilityRole="button" accessibilityLabel="Later" style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: 'rgba(255,255,255,0.9)' }}>Later</Text>
              </PressableScale>
            </Animated.View>
          ) : null}
        </View>
      </SafeAreaView>
      {step >= 2 && !reduce ? <Confetti key={`world-${worldId}`} width={width} height={height} /> : null}
    </View>
  );
}
