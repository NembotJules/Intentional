/**
 * The weekly card (US-085): a 9:16 story card of the week, made to be shared.
 *
 * Rendered at 360 × 640 points; captured at the device's pixel ratio (3× → 1080 × 1920, Instagram/WhatsApp
 * story size). Two looks: "paper" (the app's warm canvas) and "night" (the focus room's charcoal).
 * It shows hours, never task names or notes, so it is always safe to post.
 */
import { View, Text } from 'react-native';
import { Mascot } from '@/components/onboarding/Mascot';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { Accent, FontFamily, Surface, hexToRgba } from '@/constants/design';
import { formatMinutes, headlineFor, type WeekSummary } from '@/services/weekSummary';
import { localDayStart } from '@/utils/dates';

export const WEEK_CARD_W = 360;
export const WEEK_CARD_H = 640;

export type CardTheme = 'paper' | 'night';

const THEMES = {
  paper: {
    bg: Surface.canvas,
    ink: Surface.ink,
    muted: Surface.muted,
    faint: Surface.faint,
    track: Surface.rule,
    tile: Surface.surfaceRaised,
    bar: Surface.ink,
    up: Accent.green,
    upBg: Accent.greenSoft,
  },
  night: {
    bg: Surface.focusCanvas,
    ink: Surface.focusText,
    muted: Surface.focusMuted,
    faint: Surface.focusFaint,
    track: Surface.focusRule,
    tile: Surface.focusSurface,
    bar: Surface.focusText,
    up: '#5BD38A',
    upBg: 'rgba(91,211,138,0.14)',
  },
} as const;

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Flick's brightness for a week: any time given is a healthy flame; ~11 h+ a week is blazing. */
export function weekIntensity(totalMinutes: number): number {
  if (totalMinutes <= 0) return 0.25;
  return Math.min(1, 0.55 + totalMinutes / 60 / 25);
}

/** "13h 55m" must fit next to Flick: adjustsFontSizeToFit is native-only, so size by length too. */
function heroSize(label: string): number {
  return label.length <= 5 ? 64 : label.length <= 6 ? 54 : 46;
}

export function WeekCard({ summary, theme = 'paper', userName }: { summary: WeekSummary; theme?: CardTheme; userName?: string }) {
  const c = THEMES[theme];
  const s = summary;
  const pillars = s.pillars.slice(0, 6);
  const maxPillar = Math.max(1, ...pillars.map((p) => p.minutes));
  const maxDay = Math.max(1, ...s.days.map((d) => d.minutes));
  const top = [...pillars].sort((a, b) => b.minutes - a.minutes)[0];
  const tone = top && top.minutes > 0 ? top.color : Accent.blue;
  const diff = s.totalMinutes - s.prevTotalMinutes;
  const compact = pillars.length > 4;
  const goal = !compact ? [...s.goals].sort((a, b) => b.minutes - a.minutes)[0] : undefined;
  const bestDayName = s.bestDay ? localDayStart(s.bestDay.dayKey).toLocaleDateString('en-US', { weekday: 'short' }) : null;
  const intensity = weekIntensity(s.totalMinutes);

  return (
    <View style={{ width: WEEK_CARD_W, height: WEEK_CARD_H, backgroundColor: c.bg, overflow: 'hidden' }}>
      {/* A soft glow of the leading pillar's colour behind Flick */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: -120, right: -110, width: 300, height: 300, borderRadius: 150, backgroundColor: hexToRgba(tone, theme === 'night' ? 0.22 : 0.12) }}
      />

      <View style={{ flex: 1, paddingHorizontal: 26, paddingTop: 26, paddingBottom: 20 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 12, letterSpacing: 2.2, color: c.ink }}>INTENTIONAL</Text>
          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, letterSpacing: 0.4, color: c.muted }}>{s.label}</Text>
        </View>

        {/* Hero */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 18 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: c.muted }}>{userName ? `${userName}'s week` : 'My week'}</Text>
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={{ fontFamily: FontFamily.bodyBold, fontSize: heroSize(formatMinutes(s.totalMinutes)), lineHeight: 70, letterSpacing: -2.4, color: c.ink, marginTop: 2 }}
            >
              {formatMinutes(s.totalMinutes)}
            </Text>
            <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 16, lineHeight: 20, color: c.ink }}>given to the life I chose</Text>
          </View>
          <View style={{ marginRight: -8, marginBottom: -4, alignItems: 'center', justifyContent: 'center' }}>
            {/* Flick is drawn with dark ink: on the night card it stands on a warm disc so it stays readable. */}
            {theme === 'night' ? <View style={{ position: 'absolute', width: 92, height: 92, borderRadius: 46, backgroundColor: '#FFF3E2' }} /> : null}
            <Mascot mood={intensity > 0.75 ? 'proud' : s.totalMinutes > 0 ? 'happy' : 'calm'} size={96} intensity={intensity} bob={false} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          {s.prevTotalMinutes > 0 && Math.abs(diff) >= 1 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', height: 26, paddingHorizontal: 11, borderRadius: 13, backgroundColor: diff > 0 ? c.upBg : c.tile }}>
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: diff > 0 ? c.up : c.muted }}>
                {diff > 0 ? `↑ ${formatMinutes(diff)} more than last week` : `${formatMinutes(-diff)} less than last week`}
              </Text>
            </View>
          ) : (
            <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 13, lineHeight: 18, color: c.muted }} numberOfLines={2}>
              {headlineFor(s)}
            </Text>
          )}
        </View>

        {/* Days */}
        <View style={{ marginTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 52, gap: 8 }}>
            {s.days.map((d, i) => (
              <View key={d.dayKey} style={{ flex: 1, height: 52, justifyContent: 'flex-end', alignItems: 'center' }}>
                {d.minutes > 0 ? (
                  <View
                    style={{
                      width: '100%',
                      height: Math.max(8, (d.minutes / maxDay) * 52),
                      borderRadius: 6,
                      backgroundColor: s.bestDay?.dayKey === d.dayKey ? tone : hexToRgba(theme === 'night' ? '#FFF8EE' : '#171411', 0.82),
                    }}
                  />
                ) : (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.track }} />
                )}
                <Text style={{ position: 'absolute', bottom: -18, fontFamily: FontFamily.bodyBold, fontSize: 11, color: c.faint }}>{DAY_LETTERS[i]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Pillars */}
        <View style={{ marginTop: 34, gap: compact ? 9 : 12 }}>
          {pillars.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <PillarIcon icon={p.icon} name={p.name} color={p.color} size={compact ? 24 : 28} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: compact ? 13 : 14, color: c.ink, paddingRight: 6 }}>
                    {p.name}
                  </Text>
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: compact ? 13 : 14, color: p.minutes > 0 ? c.ink : c.faint }}>{formatMinutes(p.minutes)}</Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: c.track, overflow: 'hidden' }}>
                  {p.minutes > 0 ? <View style={{ height: 6, borderRadius: 3, width: `${Math.max(4, (p.minutes / maxPillar) * 100)}%`, backgroundColor: p.color }} /> : null}
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: compact ? 16 : 20 }}>
          <Stat c={c} big={`${s.daysShowedUp}/7`} small="days with time" />
          {s.habitsDue > 0 ? <Stat c={c} big={`${s.habitsKept}/${s.habitsDue}`} small="habits kept" /> : null}
          {bestDayName && s.bestDay ? <Stat c={c} big={formatMinutes(s.bestDay.minutes)} small={`best day · ${bestDayName}`} /> : null}
        </View>

        {/* One goal */}
        {goal ? (
          <View style={{ marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: c.tile }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 13, color: c.ink }}>
                {goal.title}
              </Text>
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 12, color: goal.pace === 'behind' ? Accent.amber : c.muted }}>
                {goal.progress !== null ? `${Math.round(goal.progress * 100)}%` : formatMinutes(goal.minutes)}
                {goal.pace === 'ahead' ? ' · ahead' : goal.pace === 'on_track' ? ' · on track' : ''}
              </Text>
            </View>
            {goal.progress !== null ? (
              <View style={{ height: 5, borderRadius: 3, backgroundColor: c.track, overflow: 'hidden', marginTop: 8 }}>
                <View style={{ height: 5, borderRadius: 3, width: `${Math.min(100, Math.max(3, goal.progress * 100))}%`, backgroundColor: s.pillars.find((p) => p.id === goal.pillar_id)?.color ?? tone }} />
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Footer */}
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: c.ink }}>Every hour, on purpose.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
            <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: c.muted }}>Intentional app</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function Stat({ c, big, small }: { c: (typeof THEMES)[CardTheme]; big: string; small: string }) {
  return (
    <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 11, borderRadius: 14, backgroundColor: c.tile }}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: FontFamily.bodyBold, fontSize: 20, lineHeight: 24, color: c.ink }}>
        {big}
      </Text>
      <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: c.muted, marginTop: 1 }}>
        {small}
      </Text>
    </View>
  );
}
