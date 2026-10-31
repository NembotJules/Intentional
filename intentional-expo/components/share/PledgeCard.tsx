/**
 * The signed pledge as a story card (US-085): something worth posting, that makes a friend want their own.
 * Editorial, like a certificate: a thin gold frame, a serif promise, the pillars, every goal with its date,
 * the signature in script, Flick glowing, and an invitation with the link. 360 × 640 points (1080 × 1920 at 3×).
 */
import { Text, View } from 'react-native';
import { Mascot } from '@/components/onboarding/Mascot';
import { FontFamily } from '@/constants/design';
import { APP_LINK_LABEL } from '@/constants/links';
import { listOf, pledgeShareText, shortDate, type PledgeData } from '@/services/pledge';
import type { CardTheme } from '@/components/share/WeekCard';

export const PLEDGE_CARD_W = 360;
export const PLEDGE_CARD_H = 640;

export type PledgeCardData = PledgeData;
export { listOf, pledgeShareText };

const THEMES = {
  night: { bg: '#16120F', ink: '#FFF8EE', soft: 'rgba(255,248,238,0.58)', faint: 'rgba(255,248,238,0.14)', gold: '#F5C451', glow: '#FF9F3A' },
  paper: { bg: '#FBF6EC', ink: '#1A1511', soft: 'rgba(26,21,17,0.55)', faint: 'rgba(26,21,17,0.12)', gold: '#B5832A', glow: '#FFB547' },
} as const;

export function PledgeCard({ data, theme = 'night' }: { data: PledgeCardData; theme?: CardTheme }) {
  const c = THEMES[theme === 'paper' ? 'paper' : 'night'];
  const goals = data.goals.slice(0, 3);
  const more = data.goals.length - goals.length;
  return (
    <View style={{ width: PLEDGE_CARD_W, height: PLEDGE_CARD_H, backgroundColor: c.bg, overflow: 'hidden' }}>
      {/* Warm glow rising behind Flick */}
      {[260, 190, 130].map((d, i) => (
        <View
          key={d}
          style={{ position: 'absolute', width: d, height: d, borderRadius: d / 2, left: 74 - d / 2, top: PLEDGE_CARD_H - 84 - d / 2, backgroundColor: c.glow, opacity: 0.035 + i * 0.025 }}
        />
      ))}
      {/* Certificate frame */}
      <View style={{ position: 'absolute', left: 14, top: 14, right: 14, bottom: 14, borderWidth: 1, borderColor: c.gold, opacity: 0.45, borderRadius: 6 }} />

      <View style={{ flex: 1, paddingHorizontal: 32, paddingTop: 34, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 2.6, color: c.ink }}>INTENTIONAL</Text>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 2, color: c.gold }}>DAY 1</Text>
        </View>

        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 2.4, color: c.gold, marginTop: 34 }}>A PLEDGE TO MYSELF</Text>
        <Text style={{ fontFamily: FontFamily.display, fontSize: 42, lineHeight: 44, letterSpacing: -0.6, color: c.ink, marginTop: 10 }}>
          I stop drifting.
        </Text>
        <Text style={{ fontFamily: FontFamily.displayItalic, fontSize: 42, lineHeight: 46, letterSpacing: -0.6, color: c.gold }}>Every hour has a purpose.</Text>

        {data.pillars.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 18 }}>
            {data.pillars.slice(0, 5).map((p) => (
              <View key={p.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: 13, borderWidth: 1, borderColor: c.faint }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: p.color }} />
                <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: c.ink }}>{p.name}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {goals.length ? (
          <View style={{ marginTop: 18, gap: 10 }}>
            {goals.map((g) => (
              <View key={g.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: g.color }} />
                <Text numberOfLines={2} style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 16, lineHeight: 20, color: c.ink }}>
                  {g.title}
                </Text>
                {g.deadline ? <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: c.soft }}>by {shortDate(g.deadline)}</Text> : null}
              </View>
            ))}
            {more > 0 ? <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: c.soft }}>+{more} more</Text> : null}
          </View>
        ) : null}

        {/* The vow */}
        <Text style={{ fontFamily: FontFamily.displayItalic, fontSize: 19, lineHeight: 24, color: c.soft, marginTop: 18 }}>
          “I show up every day, even for a few minutes. This is who I am becoming.”
        </Text>

        <View style={{ flex: 1, minHeight: 8 }} />

        {/* Signature */}
        <Text numberOfLines={1} style={{ fontFamily: FontFamily.displayItalic, fontSize: 34, lineHeight: 38, color: c.ink, alignSelf: 'flex-end' }}>
          {data.firstName || 'Me'}
        </Text>
        <View style={{ height: 1, backgroundColor: c.soft, marginTop: 2 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 10, letterSpacing: 1.8, color: c.soft }}>SIGNED</Text>
          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: c.soft }}>
            {data.signedOn.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>

        {/* Flick + the invitation */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 14 }}>
          <Mascot mood="proud" size={84} intensity={1} bob={false} stage={0} />
          <View style={{ flex: 1, paddingBottom: 10 }}>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: c.ink }}>Make your own pledge</Text>
            <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: c.gold, marginTop: 2 }}>{APP_LINK_LABEL}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
