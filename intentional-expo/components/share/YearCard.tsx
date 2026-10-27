/**
 * "Year in Hours" story card (US-086 / US-085): the year's total, where it went, the streak, Flick at its stage.
 * 360 × 640 points, captured at the device pixel ratio (1080 × 1920 at 3×). Hours only, never task names.
 */
import { Text, View } from 'react-native';
import { Mascot } from '@/components/onboarding/Mascot';
import { FontFamily, Surface } from '@/constants/design';
import type { CardTheme } from '@/components/share/WeekCard';
import { yearHours, type YearSummary } from '@/services/yearInHours';

export const YEAR_CARD_W = 360;
export const YEAR_CARD_H = 640;

export function YearCard({ year, final, theme = 'paper', userName }: { year: YearSummary; final: boolean; theme?: CardTheme; userName?: string }) {
  const night = theme === 'night';
  const ink = night ? Surface.focusText : Surface.ink;
  const muted = night ? Surface.focusMuted : Surface.muted;
  const tile = night ? Surface.focusSurface : Surface.surfaceRaised;
  const top = year.pillars.slice(0, 4);
  const stats = [
    [String(year.activeDays), year.activeDays === 1 ? 'day' : 'days'],
    [year.longestStreak ? String(year.longestStreak.days) : '0', 'in a row'],
    [String(year.goalsAchieved.length), year.goalsAchieved.length === 1 ? 'goal' : 'goals'],
  ] as const;
  return (
    <View style={{ width: YEAR_CARD_W, height: YEAR_CARD_H, backgroundColor: night ? Surface.focusCanvas : Surface.canvas, overflow: 'hidden' }}>
      <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 26, paddingBottom: 22 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 12, letterSpacing: 2.2, color: ink }}>INTENTIONAL</Text>
          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: muted }}>{final ? `${year.year} in hours` : `${year.year} so far`}</Text>
        </View>

        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 92, lineHeight: 100, letterSpacing: -3, color: ink, marginTop: 36 }}>{yearHours(year.totalMinutes)}</Text>
        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 20, lineHeight: 26, color: ink }}>given to the life I chose</Text>

        <View style={{ marginTop: 22, gap: 10 }}>
          {top.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text numberOfLines={1} style={{ width: 86, fontFamily: FontFamily.bodyBold, fontSize: 14, color: ink }}>
                {p.name}
              </Text>
              <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: tile, overflow: 'hidden' }}>
                <View style={{ width: `${Math.max(4, (p.minutes / Math.max(1, top[0]!.minutes)) * 100)}%`, height: 10, borderRadius: 5, backgroundColor: p.color }} />
              </View>
              <Text style={{ width: 52, textAlign: 'right', fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: muted }}>{yearHours(p.minutes)}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
          {stats.map(([big, small]) => (
            <View key={small} style={{ flex: 1, paddingVertical: 12, borderRadius: 16, backgroundColor: tile, alignItems: 'center' }}>
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 24, lineHeight: 28, color: ink }}>{big}</Text>
              <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: muted }}>{small}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingBottom: 6 }}>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: ink }}>Flick: {year.stageEnd.name}</Text>
            <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: muted, marginTop: 2 }}>
              {year.bestMonth ? `Best month: ${year.bestMonth.long}` : 'Every hour, on purpose.'}
            </Text>
          </View>
          <View>
            {night ? <View style={{ position: 'absolute', top: 14, left: 12, width: 96, height: 96, borderRadius: 48, backgroundColor: '#FFF3E2' }} /> : null}
            <Mascot mood="proud" size={120} intensity={1} bob={false} stage={year.stageEnd.index} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: ink }}>{userName ? `${userName}'s year` : 'My year'}</Text>
          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: muted }}>Intentional app</Text>
        </View>
      </View>
    </View>
  );
}
