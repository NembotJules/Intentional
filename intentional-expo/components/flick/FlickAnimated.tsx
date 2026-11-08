/**
 * US-118 · Flick, animated by Lottie (assets/lottie/flick-<mood>.json, built by scripts/build-flick-lottie.mjs):
 * the flame bends and breathes, the arms swing, blinks, glances, embers, a twinkling star (proud), drifting z's (sleepy).
 *
 * Same props and footprint as `Mascot` (a `size`×`size` box, the 120 drawing inside), so it drops in where Flick is live.
 * Falls back to the SVG `Mascot` for what the loops don't cover: a low, smoking flame (intensity < 0.45), the moods
 * without a loop (wave, sad, mystery), a custom arm pose, or `bob={false}` (a still Flick).
 *
 *   - intensity scales the flame like Mascot does (a healthy loop is drawn at intensity 0.75);
 *   - `stage` (US-079) grows Flick and draws the glow, sun rays, ember ring and crown of sparks behind it.
 */
import { LottiePlayer } from '@/components/flick/LottiePlayer';
import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { Mascot, STAGE_LOOK, type MascotArms, type MascotMood } from '@/components/onboarding/Mascot';
import FRAME from '@/assets/lottie/flick-frame.json';
import { loopScale, usesLoop, type LoopMood } from '@/services/flickLoop';

const LOOPS: Record<LoopMood, unknown> = {
  happy: require('@/assets/lottie/flick-happy.json'),
  calm: require('@/assets/lottie/flick-calm.json'),
  worried: require('@/assets/lottie/flick-worried.json'),
  sleepy: require('@/assets/lottie/flick-sleepy.json'),
  focus: require('@/assets/lottie/flick-focus.json'),
  proud: require('@/assets/lottie/flick-proud.json'),
  think: require('@/assets/lottie/flick-think.json'),
  shock: require('@/assets/lottie/flick-shock.json'),
  meditate: require('@/assets/lottie/flick-meditate.json'),
};

/** US-120: `meditate` (a running focus session) exists only as a loop; the still fallback is a calm Flick. */
export type FlickMood = MascotMood | 'meditate';

export function FlickAnimated({
  mood = 'happy',
  size = 140,
  intensity = 0.65,
  stage,
  arms,
  bob = true,
}: {
  mood?: FlickMood;
  size?: number;
  intensity?: number;
  stage?: number;
  arms?: MascotArms;
  bob?: boolean;
}) {
  if (!usesLoop({ mood, intensity, arms, bob })) return <Mascot mood={mood === 'meditate' ? 'calm' : mood} size={size} intensity={intensity} stage={stage} arms={arms} bob={bob} />;

  const look = stage === undefined ? null : STAGE_LOOK[Math.min(5, Math.max(0, Math.round(stage)))]!;
  // Mascot scales the flame from its base and then the whole Flick by the stage's body size, from the ground (y 118).
  const k = loopScale(intensity, look?.body ?? 1);
  const u = size / 120; // px per drawing unit
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {look ? <StageDecor size={size} look={look} /> : null}
      <View
        style={{
          position: 'absolute',
          left: -FRAME.padX * u,
          top: -FRAME.padY * u,
          width: FRAME.w * u,
          height: FRAME.h * u,
          // scale around Flick's feet (x 60, y 118 of the drawing)
          transformOrigin: `${((FRAME.padX + 60) / FRAME.w) * 100}% ${((FRAME.padY + 118) / FRAME.h) * 100}%`,
          transform: [{ scale: k }],
        }}
      >
        <LottiePlayer key={mood} source={LOOPS[mood as LoopMood]} width={FRAME.w * u} height={FRAME.h * u} />
      </View>
    </View>
  );
}

/** US-079 stage extras (as in Mascot), drawn behind the animated flame. */
function StageDecor({ size, look }: { size: number; look: (typeof STAGE_LOOK)[number] }) {
  const midY = 118 - (118 - 66) * look.body;
  const grow = `translate(60 118) scale(${look.body}) translate(-60 -118)`;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" style={{ position: 'absolute', left: 0, top: 0 }}>
      {look.rays ? (
        <G opacity={0.9}>
          {Array.from({ length: 12 }, (_, k) => {
            const a = (k / 12) * Math.PI * 2;
            const r1 = k % 2 ? 54 : 58;
            return (
              <Path
                key={k}
                d={`M${(60 + Math.cos(a) * 47).toFixed(1)} ${(midY + Math.sin(a) * 47).toFixed(1)} L${(60 + Math.cos(a) * r1).toFixed(1)} ${(midY + Math.sin(a) * r1).toFixed(1)}`}
                stroke="#FFB547"
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })}
        </G>
      ) : null}
      {look.glow > 0 ? <Circle cx={60} cy={midY} r={44} fill="#FFD27A" opacity={0.22 * look.glow} /> : null}
      <G transform={grow}>
        {look.embers > 0
          ? Array.from({ length: look.embers }, (_, k) => {
              const a = Math.PI * (0.08 + (0.84 * k) / Math.max(1, look.embers - 1));
              return <Circle key={k} cx={60 - Math.cos(a) * 40} cy={116 - Math.sin(a) * 9} r={k % 3 === 1 ? 2.6 : 1.9} fill={k % 2 ? '#FFB547' : '#FF7A3A'} />;
            })
          : null}
        {look.crown
          ? [-1, 1].map((side) =>
              [0, 1, 2].map((k) => {
                const x = 60 + side * (30 + k * 7);
                const y = 22 + k * 11;
                return (
                  <Path
                    key={`${side}${k}`}
                    d={`M${x} ${y - 4.5} L${x + 1.4} ${y - 1.4} L${x + 4.5} ${y} L${x + 1.4} ${y + 1.4} L${x} ${y + 4.5} L${x - 1.4} ${y + 1.4} L${x - 4.5} ${y} L${x - 1.4} ${y - 1.4} Z`}
                    fill="#FFD23F"
                  />
                );
              })
            )
          : null}
      </G>
    </Svg>
  );
}
