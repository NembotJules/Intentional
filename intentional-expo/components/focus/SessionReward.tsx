/**
 * US-084 · The end-of-session reward: Flick flares up, "+30m to Body" counts up, the stage bar moves toward
 * the next stage ("12h to Torch"), the goal's hours count up and its bar shows (and moves when the task is done),
 * and a reached stage or milestone is named before the full celebration takes over (the hand-off).
 */
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Mascot } from '@/components/onboarding/Mascot';
import { ProgressBar } from '@/components/ui/motion';
import { Accent, FontFamily, Surface } from '@/constants/design';
import { formatGiven, type SessionReward as Reward } from '@/services/sessionReward';

/** Total length of the reward's animations; the hand-off to celebrations follows. */
export const REWARD_MS = 2200;

/** Eases from `from` to `to` over `duration`, after `delay`. */
function useTween(from: number, to: number, duration: number, delay = 0): number {
  const [v, setV] = useState(from);
  const key = `${from}|${to}`;
  const last = useRef(from);
  useEffect(() => {
    const start = Date.now() + delay;
    const origin = last.current; // a new target eases on from where it is
    let frame: ReturnType<typeof requestAnimationFrame>;
    const tick = () => {
      const t = Math.max(0, Math.min(1, (Date.now() - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = origin + (to - origin) * eased;
      last.current = cur;
      setV(cur);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [key, duration, delay]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

/** A bar that starts at `from` and moves to `to` once mounted (ProgressBar springs to its value). */
function MovingBar({ from, to, color, delay }: { from: number; to: number; color: string; delay: number }) {
  const [p, setP] = useState(from);
  useEffect(() => {
    const id = setTimeout(() => setP(to), delay);
    return () => clearTimeout(id);
  }, [to, delay]);
  return <ProgressBar progress={p} color={color} trackColor={Surface.hill} height={8} />;
}

export function RewardHero({
  reward,
  fullComplete,
  goalName,
  tone,
}: {
  reward: Reward;
  fullComplete: boolean;
  goalName: string;
  tone: string;
}) {
  const intensity = useTween(reward.flick.from, fullComplete ? reward.flick.to : Math.min(reward.flick.to, 0.8), 1400, 200);
  const minutes = useTween(0, reward.minutes, 1200, 300);
  return (
    <>
      <View style={{ alignItems: 'center' }} accessibilityLabel={`Flick, ${reward.stage.name}`}>
        <Mascot mood={fullComplete ? 'proud' : 'happy'} size={140} intensity={intensity} stage={reward.stage.index} />
      </View>
      <Text
        style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 15, marginTop: 10, textAlign: 'center' }}
      >
        {fullComplete ? 'Session complete' : 'Session ended early'}
      </Text>
      <Text
        accessibilityLabel={`+${formatGiven(reward.minutes)} to ${goalName}`}
        style={{
          color: Surface.ink,
          fontFamily: FontFamily.bodyBold,
          fontSize: 40,
          lineHeight: 46,
          letterSpacing: -0.8,
          textAlign: 'center',
          marginTop: 4,
        }}
      >
        +{formatGiven(Math.round(minutes))} to <Text style={{ color: tone }}>{goalName}</Text>
      </Text>
    </>
  );
}

export function RewardCard({
  reward,
  tone,
  handOff,
}: {
  reward: Reward;
  tone: string;
  /** What the celebration that follows will show ("Flick is now a Torch", "100 hours to Body."). */
  handOff: string[];
}) {
  const { stage, goal } = reward;
  const goalMinutes = useTween(goal?.minutesBefore ?? 0, goal?.minutesAfter ?? 0, 1200, 700);
  return (
    <View style={{ marginTop: 20, backgroundColor: Surface.surfaceRaised, borderRadius: 18, padding: 18, gap: 16 }}>
      <View accessibilityLabel={`Flick stage ${stage.name}, ${stage.toNextLabel}`}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>
            <Ionicons name="flame" size={14} color={Accent.orange} /> Flick · {stage.name}
          </Text>
          <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 14 }}>{stage.toNextLabel}</Text>
        </View>
        <MovingBar from={stage.from} to={stage.to} color={Accent.orange} delay={500} />
      </View>

      {goal ? (
        <View accessibilityLabel={`Goal ${goal.title}, ${formatGiven(goal.minutesAfter)} given`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: goal.progress === null ? 0 : 8, gap: 12 }}>
            <Text numberOfLines={1} style={{ flexShrink: 1, color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>
              {goal.title}
            </Text>
            <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 14 }}>
              {formatGiven(Math.round(goalMinutes))} given
            </Text>
          </View>
          {goal.progress !== null ? (
            <View accessibilityLabel={`Goal progress ${Math.round(goal.progress * 100)}%`}>
              <MovingBar from={0} to={goal.progress} color={tone} delay={700} />
            </View>
          ) : null}
        </View>
      ) : null}

      {handOff.map((line) => (
        <View
          key={line}
          accessibilityLabel={`Reached: ${line}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Accent.orangeSoft, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}
        >
          <Ionicons name="sparkles" size={16} color={Accent.orange} />
          <Text style={{ flex: 1, color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>{line}</Text>
        </View>
      ))}
    </View>
  );
}
