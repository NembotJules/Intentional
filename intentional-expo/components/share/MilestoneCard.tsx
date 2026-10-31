/**
 * "Milestone" story card (US-080 / US-085): the line crossed, big, with Flick at its stage.
 * 360 × 640 points, captured at the device pixel ratio (1080 × 1920 at 3×). Hours only, never task names.
 */
import { Text, View } from 'react-native';
import { Mascot } from '@/components/onboarding/Mascot';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { Accent, FontFamily, Surface, hexToRgba } from '@/constants/design';
import type { CardTheme } from '@/components/share/WeekCard';

export const MILESTONE_CARD_W = 360;
export const MILESTONE_CARD_H = 640;

export interface MilestoneCardData {
  /** "100h", "4 weeks", "7 days" */
  big: string;
  title: string;
  pillar?: { name: string; icon: string; color: string } | null;
  achievedOn: Date;
  stage: number;
  userName?: string;
}

// Fixed sparks so the captured image is always the same.
const DOTS = [
  [20, 70, 6, '#F27B2E'], [60, 110, 4, '#3E6BFF'], [316, 64, 7, '#22A35A'], [332, 140, 5, '#F27B2E'],
  [14, 190, 5, '#B98A3E'], [330, 220, 6, '#3E6BFF'], [96, 60, 4, '#E5484D'], [262, 100, 5, '#B98A3E'],
] as const;

export function MilestoneCard({ data, theme = 'paper' }: { data: MilestoneCardData; theme?: CardTheme }) {
  const night = theme === 'night';
  const ink = night ? Surface.focusText : Surface.ink;
  const muted = night ? Surface.focusMuted : Surface.muted;
  const tone = data.pillar?.color ?? Accent.orange;
  return (
    <View style={{ width: MILESTONE_CARD_W, height: MILESTONE_CARD_H, backgroundColor: night ? Surface.focusCanvas : Surface.canvas, overflow: 'hidden' }}>
      {DOTS.map(([x, y, r, c], i) => (
        <View key={i} style={{ position: 'absolute', left: x, top: y, width: r * 2, height: r * 2, borderRadius: i % 3 === 0 ? 2 : r, backgroundColor: c, opacity: 0.8, transform: [{ rotate: `${i * 41}deg` }] }} />
      ))}
      <View style={{ position: 'absolute', bottom: -170, left: -80, right: -80, height: 340, borderRadius: 200, backgroundColor: hexToRgba(tone, night ? 0.22 : 0.13) }} />

      <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 26, paddingBottom: 22 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 12, letterSpacing: 2.2, color: ink }}>INTENTIONAL</Text>
          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: muted }}>
            {data.achievedOn.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>

        <View style={{ alignItems: 'center', marginTop: 44 }}>
          <View style={{ height: 30, paddingHorizontal: 14, borderRadius: 15, backgroundColor: tone, justifyContent: 'center' }}>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, letterSpacing: 1.4, color: '#FFFFFF' }}>MILESTONE</Text>
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: FontFamily.bodyBold, fontSize: data.big.length > 6 ? 64 : 88, lineHeight: data.big.length > 6 ? 72 : 96, letterSpacing: -2.4, color: ink, marginTop: 16 }}>
            {data.big}
          </Text>
          <Text numberOfLines={3} style={{ fontFamily: FontFamily.bodyBold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4, color: ink, textAlign: 'center', marginTop: 4 }}>
            {data.title}
          </Text>
          {data.pillar ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
              <PillarIcon icon={data.pillar.icon} name={data.pillar.name} color={tone} size={26} />
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: muted }}>{data.pillar.name}</Text>
            </View>
          ) : null}
        </View>

        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'center' }}>
          {night ? <View style={{ position: 'absolute', top: 14, width: 110, height: 110, borderRadius: 55, backgroundColor: '#FFF3E2' }} /> : null}
          <Mascot mood="proud" size={140} intensity={1} bob={false} stage={data.stage} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: ink }}>{data.userName ? `${data.userName}, hour by hour.` : 'Every hour, on purpose.'}</Text>
          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: muted }}>Intentional app</Text>
        </View>
      </View>
    </View>
  );
}
