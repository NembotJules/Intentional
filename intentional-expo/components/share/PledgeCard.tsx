/**
 * The signed pledge as a story card (US-085): dark like the signing screen, the pledge in white,
 * the last line in gold, a signature line, and Flick lit. 360 × 640 points (1080 × 1920 at 3×).
 */
import { Text, View } from 'react-native';
import { Mascot } from '@/components/onboarding/Mascot';
import { FontFamily } from '@/constants/design';
import type { CardTheme } from '@/components/share/WeekCard';

export const PLEDGE_CARD_W = 360;
export const PLEDGE_CARD_H = 640;

const GOLD = '#FFD23F';

export interface PledgeCardData {
  /** The pledge sentences, in order (the last one is highlighted). */
  lines: string[];
  firstName?: string;
  signedOn: Date;
}

export function pledgeShareText(d: PledgeCardData): string {
  return [...d.lines, '', `Signed${d.firstName ? `, ${d.firstName}` : ''} · ${d.signedOn.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 'On Intentional.'].join('\n');
}

export function PledgeCard({ data, theme = 'night' }: { data: PledgeCardData; theme?: CardTheme }) {
  const paper = theme === 'paper';
  const bg = paper ? '#FFFCF7' : '#2B2826';
  const ink = paper ? '#171411' : '#FFFFFF';
  const soft = paper ? 'rgba(23,20,17,0.55)' : 'rgba(255,255,255,0.6)';
  const accent = paper ? '#3E6BFF' : GOLD;
  const lines = data.lines.length ? data.lines : ['This is who I am becoming.'];
  return (
    <View style={{ width: PLEDGE_CARD_W, height: PLEDGE_CARD_H, backgroundColor: bg, overflow: 'hidden' }}>
      {/* Rings, like the signing screen */}
      {[420, 320, 220].map((d) => (
        <View
          key={d}
          style={{
            position: 'absolute',
            width: d,
            height: d,
            borderRadius: d / 2,
            left: PLEDGE_CARD_W / 2 - d / 2,
            top: PLEDGE_CARD_H - 150 - d / 2,
            borderWidth: 1,
            borderColor: paper ? 'rgba(23,20,17,0.07)' : 'rgba(255,255,255,0.07)',
          }}
        />
      ))}
      <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 26, paddingBottom: 24 }}>
        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 12, letterSpacing: 2.2, color: ink }}>INTENTIONAL</Text>
        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 30, lineHeight: 36, color: ink, marginTop: 28 }}>My pledge</Text>
        <View style={{ marginTop: 16, gap: 12 }}>
          {lines.map((l, i) => (
            <Text
              key={i}
              style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 17, lineHeight: 24, color: i === lines.length - 1 ? accent : ink }}
            >
              {l}
            </Text>
          ))}
        </View>
        <View style={{ marginTop: 22, borderTopWidth: 1, borderTopColor: soft, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: accent }}>Signed{data.firstName ? `, ${data.firstName}` : ''}</Text>
          <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: soft }}>
            {data.signedOn.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'center' }}>
          {!paper ? <View style={{ position: 'absolute', top: 8, width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFF3E2' }} /> : null}
          <Mascot mood="proud" size={116} intensity={1} bob={false} />
        </View>
        <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: soft, textAlign: 'center', marginTop: 8 }}>Day 1 · Intentional app</Text>
      </View>
    </View>
  );
}
