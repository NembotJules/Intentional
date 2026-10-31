/**
 * "Goal achieved" story card (US-085): the finish line, the hours it took, and Flick blazing.
 * 360 × 640 points, captured at the device pixel ratio (1080 × 1920 at 3×). No task names.
 */
import { Text, View } from 'react-native';
import { Mascot } from '@/components/onboarding/Mascot';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { Accent, FontFamily, Surface, hexToRgba } from '@/constants/design';
import type { CardTheme } from '@/components/share/WeekCard';
import { formatMinutes } from '@/services/weekSummary';

export const GOAL_CARD_W = 360;
export const GOAL_CARD_H = 640;

export interface GoalCardData {
  title: string;
  doneWhen?: string;
  pillar: { name: string; icon: string; color: string };
  minutes: number;
  days: number;
  tasksDone: number;
  reflection?: string | null;
  achievedOn: Date;
  userName?: string;
}

// Fixed confetti so the captured image is always the same.
const DOTS = [
  [16, 64, 7, '#F27B2E'], [54, 96, 5, '#3E6BFF'], [318, 70, 8, '#22A35A'], [336, 128, 5, '#F27B2E'],
  [10, 176, 5, '#22A35A'], [334, 206, 6, '#3E6BFF'], [16, 264, 6, '#B98A3E'], [336, 276, 5, '#F27B2E'],
  [88, 66, 4, '#B98A3E'], [270, 96, 5, '#E5484D'],
] as const;

export function goalShareText(d: GoalCardData): string {
  const bits = [`${formatMinutes(d.minutes)} given`, `${d.days} ${d.days === 1 ? 'day' : 'days'}`];
  if (d.tasksDone > 0) bits.push(`${d.tasksDone} ${d.tasksDone === 1 ? 'step' : 'steps'} done`);
  return [`🏆 Goal achieved: ${d.title}`, bits.join(' · '), d.reflection ? `What made it work: "${d.reflection}"` : null, 'Tracked hour by hour on Intentional.']
    .filter(Boolean)
    .join('\n');
}

export function GoalCard({ data, theme = 'paper' }: { data: GoalCardData; theme?: CardTheme }) {
  const night = theme === 'night';
  const ink = night ? Surface.focusText : Surface.ink;
  const muted = night ? Surface.focusMuted : Surface.muted;
  const tile = night ? Surface.focusSurface : Surface.surfaceRaised;
  const tone = data.pillar.color;
  return (
    <View style={{ width: GOAL_CARD_W, height: GOAL_CARD_H, backgroundColor: night ? Surface.focusCanvas : Surface.canvas, overflow: 'hidden' }}>
      {DOTS.map(([x, y, r, c], i) => (
        <View key={i} style={{ position: 'absolute', left: x, top: y, width: r * 2, height: r * 2, borderRadius: i % 3 === 0 ? 2 : r, backgroundColor: c, opacity: 0.8, transform: [{ rotate: `${i * 37}deg` }] }} />
      ))}
      <View style={{ position: 'absolute', bottom: -170, left: -80, right: -80, height: 340, borderRadius: 200, backgroundColor: hexToRgba(tone, night ? 0.22 : 0.13) }} />

      <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 26, paddingBottom: 22 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 12, letterSpacing: 2.2, color: ink }}>INTENTIONAL</Text>
          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: muted }}>
            {data.achievedOn.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>

        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <View style={{ height: 30, paddingHorizontal: 14, borderRadius: 15, backgroundColor: Accent.green, justifyContent: 'center' }}>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, letterSpacing: 1.4, color: '#FFFFFF' }}>GOAL ACHIEVED</Text>
          </View>
          <Text
            numberOfLines={3}
            adjustsFontSizeToFit
            style={{ fontFamily: FontFamily.bodyBold, fontSize: 36, lineHeight: 41, letterSpacing: -0.8, color: ink, textAlign: 'center', marginTop: 18 }}
          >
            {data.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <PillarIcon icon={data.pillar.icon} name={data.pillar.name} color={tone} size={26} />
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: muted }}>{data.pillar.name}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 30 }}>
          {[
            [formatMinutes(data.minutes), 'given'],
            [String(data.days), data.days === 1 ? 'day' : 'days'],
            ...(data.tasksDone > 0 ? ([[String(data.tasksDone), data.tasksDone === 1 ? 'step done' : 'steps done']] as const) : []),
          ].map(([big, small]) => (
            <View key={small} style={{ flex: 1, paddingVertical: 12, borderRadius: 16, backgroundColor: tile, alignItems: 'center' }}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: FontFamily.bodyBold, fontSize: 24, lineHeight: 28, color: ink }}>
                {big}
              </Text>
              <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: muted }}>{small}</Text>
            </View>
          ))}
        </View>

        {data.reflection ? (
          <View style={{ marginTop: 18, paddingLeft: 14, borderLeftWidth: 3, borderLeftColor: tone }}>
            <Text numberOfLines={3} style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 16, lineHeight: 22, color: ink }}>
              “{data.reflection}”
            </Text>
          </View>
        ) : null}

        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'center' }}>
          {night ? <View style={{ position: 'absolute', top: 10, width: 104, height: 104, borderRadius: 52, backgroundColor: '#FFF3E2' }} /> : null}
          <Mascot mood="proud" size={120} intensity={1} bob={false} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: ink }}>{data.userName ? `${data.userName} did it.` : 'Every hour, on purpose.'}</Text>
          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: muted }}>Intentional app</Text>
        </View>
      </View>
    </View>
  );
}
