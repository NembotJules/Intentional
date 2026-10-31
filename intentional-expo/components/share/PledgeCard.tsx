/**
 * The signed pledge as a story card (US-085): the app's own look, made to be reposted.
 * Night is the commit screen (warm charcoal, the rings, the pledge box, the gold line); paper is the app's
 * canvas with the blue accent. The hook is the number onboarding found ("I'm taking back 12 years of my life"),
 * then the pledge as signed (pillars, every goal with its date), the fingerprint seal, Flick lit, and the invitation
 * with the link. 360 × 640 points (1080 × 1920 at 3×).
 */
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Mascot } from '@/components/onboarding/Mascot';
import { Accent, FontFamily, Surface, hexToRgba } from '@/constants/design';
import { APP_LINK_LABEL } from '@/constants/links';
import { listOf, pledgeShareText, shortDate, yearsLabel, type PledgeData } from '@/services/pledge';
import type { CardTheme } from '@/components/share/WeekCard';

export const PLEDGE_CARD_W = 360;
export const PLEDGE_CARD_H = 640;

export type PledgeCardData = PledgeData;
export { listOf, pledgeShareText };

const THEMES = {
  night: {
    bg: Surface.focusCanvas,
    ink: Surface.focusText,
    muted: Surface.focusMuted,
    box: 'rgba(255,255,255,0.06)',
    boxRule: 'rgba(255,255,255,0.12)',
    ring: 'rgba(255,255,255,0.08)',
    accent: '#FFD43B',
    onAccent: Surface.ink,
    chip: 'rgba(255,255,255,0.10)',
    glow: '#FF9F3A',
  },
  paper: {
    bg: Surface.canvas,
    ink: Surface.ink,
    muted: Surface.muted,
    box: Surface.surface,
    boxRule: Surface.rule,
    ring: 'rgba(23,20,17,0.06)',
    accent: Accent.blue,
    onAccent: '#FFFFFF',
    chip: Surface.surfaceRaised,
    glow: '#FFB547',
  },
} as const;

/** The commit screen's rings, centred on Flick. */
function CardRings({ color, cx, cy }: { color: string; cx: number; cy: number }) {
  return (
    <Svg pointerEvents="none" width={PLEDGE_CARD_W} height={PLEDGE_CARD_H} style={{ position: 'absolute', left: 0, top: 0 }}>
      {[54, 96, 138, 180, 222].map((r) => (
        <Circle key={r} cx={cx} cy={cy} r={r} stroke={color} strokeWidth={1.3} fill="none" />
      ))}
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const rad = (a * Math.PI) / 180;
        return <Circle key={a} cx={cx + Math.cos(rad) * 96} cy={cy + Math.sin(rad) * 96} r={96} stroke={color} strokeWidth={1} fill="none" />;
      })}
    </Svg>
  );
}

export function PledgeCard({ data, theme = 'night' }: { data: PledgeCardData; theme?: CardTheme }) {
  const c = THEMES[theme === 'paper' ? 'paper' : 'night'];
  const goals = data.goals.slice(0, 3);
  const more = data.goals.length - goals.length;
  const name = data.firstName?.trim();
  const flickX = 76;
  const flickY = PLEDGE_CARD_H - 74;

  return (
    <View style={{ width: PLEDGE_CARD_W, height: PLEDGE_CARD_H, backgroundColor: c.bg, overflow: 'hidden' }}>
      <CardRings color={c.ring} cx={flickX} cy={flickY} />
      {[190, 124].map((d, i) => (
        <View
          key={d}
          pointerEvents="none"
          style={{ position: 'absolute', width: d, height: d, borderRadius: d / 2, left: flickX - d / 2, top: flickY - d / 2, backgroundColor: hexToRgba(c.glow, 0.1 + i * 0.08) }}
        />
      ))}

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 26, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 12, letterSpacing: 2.4, color: c.ink }}>INTENTIONAL</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: c.accent }}>
            <Ionicons name="flame" size={13} color={c.onAccent} />
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 12, color: c.onAccent }}>Day 1</Text>
          </View>
        </View>

        {/* The hook */}
        {data.yearsBack ? (
          <View style={{ marginTop: 22 }}>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 22, lineHeight: 26, color: c.ink }}>I'm taking back</Text>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 68, lineHeight: 72, letterSpacing: -1.5, color: c.accent }}>{yearsLabel(data.yearsBack)}</Text>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 22, lineHeight: 26, color: c.ink }}>of my life.</Text>
          </View>
        ) : (
          <View style={{ marginTop: 22 }}>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 40, lineHeight: 44, letterSpacing: -0.8, color: c.ink }}>I stop drifting.</Text>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 40, lineHeight: 44, letterSpacing: -0.8, color: c.accent }}>Every hour counts.</Text>
          </View>
        )}

        {/* The pledge, as signed */}
        <View style={{ marginTop: 18, borderRadius: 20, borderWidth: 1, borderColor: c.boxRule, backgroundColor: c.box, padding: 16 }}>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, lineHeight: 20, color: c.ink }}>
            I{name ? `, ${name},` : ''} decide to stop drifting through my days.
          </Text>
          {data.pillars.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {data.pillars.slice(0, 5).map((p) => (
                <View key={p.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: c.chip }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color }} />
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 12, color: c.ink }}>{p.name}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {goals.length ? (
            <View style={{ marginTop: 12, gap: 7 }}>
              {goals.map((g) => (
                <View key={g.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: g.color }} />
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 15, color: c.ink }}>
                    {g.title}
                  </Text>
                  {g.deadline ? <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: c.muted }}>by {shortDate(g.deadline)}</Text> : null}
                </View>
              ))}
              {more > 0 ? <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: c.muted }}>+{more} more</Text> : null}
            </View>
          ) : null}
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: c.accent, marginTop: 12 }}>This is who I am becoming.</Text>
          <View style={{ height: 1, backgroundColor: c.boxRule, marginTop: 12 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 }}>
            <Ionicons name="finger-print" size={16} color={c.accent} />
            <Text style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 12, color: c.muted }}>Signed{name ? ` by ${name}` : ''}</Text>
            <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: c.muted }}>
              {data.signedOn.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        {/* Flick lit + the invitation */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 100, alignItems: 'center' }}>
            <Mascot mood="proud" size={100} intensity={1} bob={false} stage={0} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 17, lineHeight: 21, color: c.ink }}>Where are your hours going?</Text>
            <View style={{ alignSelf: 'flex-start', marginTop: 8, height: 30, paddingHorizontal: 14, borderRadius: 15, backgroundColor: c.accent, justifyContent: 'center' }}>
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: c.onAccent }}>Make your own pledge →</Text>
            </View>
            <Text numberOfLines={1} style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: c.muted, marginTop: 6 }}>{APP_LINK_LABEL}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
