/**
 * US-104 · A running focus session as a full-screen moment: Flick's world (the world you chose, the sky of the
 * hour) fills the screen and warms as the session goes on; Flick sits focused on his hill; a huge timer; the
 * pillar and the task small; one big stop button, and pause. Session logic stays in app/(tabs)/focus.tsx.
 */
import { useMemo } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Mascot } from '@/components/onboarding/Mascot';
import { FlickAnimated } from '@/components/flick/FlickAnimated';
import { WorldStage } from '@/components/world/WorldStage';
import { PressableScale } from '@/components/ui/motion';
import { FontFamily, Surface } from '@/constants/design';
import { worldLook } from '@/services/world';
import { getSelectedWorld } from '@/services/worldChoice';

export function SessionScene({
  goalName,
  tone,
  itemName,
  countdown,
  progress,
  isPaused,
  givenMins,
  shieldText,
  shieldOn,
  onTogglePause,
  onEnd,
}: {
  goalName: string;
  tone: string;
  itemName: string;
  countdown: string;
  progress: number;
  isPaused: boolean;
  givenMins: number;
  shieldText: string;
  shieldOn: boolean;
  onTogglePause: () => void;
  onEnd: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const hour = now.getHours();
  // The world warms as the session goes on (a quarter warm at the start, fully alive at the end).
  const warmth = 0.25 + 0.75 * Math.max(0, Math.min(1, progress));
  const themeId = useMemo(() => getSelectedWorld(), []);
  const look = worldLook({ hour, minute: now.getMinutes(), warmth, themeId });
  const darkSky = look.phase === 'night' || look.phase === 'dusk';
  const ink = darkSky ? '#FFFFFF' : Surface.ink;
  const soft = darkSky ? 'rgba(255,255,255,0.78)' : 'rgba(23,20,17,0.62)';
  const shadow = darkSky ? { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 8 } : { textShadowColor: 'rgba(255,255,255,0.5)', textShadowRadius: 6 };
  const groundY = Math.round(height * 0.6);
  // US-120: the meditating Flick is the session's moment: bigger.
  const flickSize = Math.min(230, Math.round(width * 0.56));

  return (
    <View style={{ flex: 1 }}>
      <WorldStage
        look={look}
        themeId={themeId}
        width={width}
        height={height}
        groundY={groundY}
        flickSize={flickSize}
        // US-120: while the session runs, Flick meditates (floating, an aura); paused, he waits, thinking.
        flick={isPaused ? <Mascot mood="think" size={flickSize} intensity={0.5 + 0.5 * progress} bob={false} /> : <FlickAnimated mood="meditate" size={flickSize} intensity={0.5 + 0.5 * progress} />}
      />

      {/* the pillar and what you're on, small */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 18, left: 22, right: 22, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%', minHeight: 36, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.88)' }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: tone }} />
          <Text numberOfLines={1} style={{ flexShrink: 1, color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 15 }}>
            {itemName}
          </Text>
          <Text style={{ color: Surface.muted, fontFamily: FontFamily.bodySemiBold, fontSize: 14 }}>· {goalName}</Text>
        </View>

        {/* the huge timer */}
        <Text
          accessibilityLabel={`${countdown} remaining`}
          style={{ color: isPaused ? soft : ink, fontFamily: FontFamily.monoSemiBold, fontSize: 84, lineHeight: 92, letterSpacing: -3, marginTop: 26, includeFontPadding: false, ...shadow }}
        >
          {countdown}
        </Text>
        <Text style={{ color: soft, fontFamily: FontFamily.bodySemiBold, fontSize: 16, lineHeight: 22, marginTop: 2, textAlign: 'center', ...shadow }}>
          {isPaused ? 'Paused. Resume when you’re ready.' : givenMins > 0 ? `${givenMins}m given to ${goalName} so far` : `Every minute goes to ${goalName}`}
        </Text>
      </View>

      {/* on the ground: the shield line, pause, and the big stop button */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 22, right: 22, bottom: insets.bottom + 26, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18, height: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.72)', opacity: isPaused ? 0 : 1 }}>
          <Ionicons name={shieldOn ? 'lock-closed' : 'lock-open-outline'} size={13} color={Surface.ink} />
          <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodySemiBold, fontSize: 13 }}>{shieldText}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
          <Pressable
            onPress={onTogglePause}
            accessibilityRole="button"
            accessibilityLabel={isPaused ? 'Resume focus session' : 'Pause focus session'}
            style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={isPaused ? 'play' : 'pause'} size={26} color={Surface.ink} />
          </Pressable>
          <PressableScale
            onPress={onEnd}
            accessibilityRole="button"
            accessibilityLabel="End focus session"
            style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: Surface.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.85)' }}
          >
            <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: '#FF6A4D' }} />
          </PressableScale>
          <View style={{ width: 64 }} />
        </View>
      </View>
    </View>
  );
}
