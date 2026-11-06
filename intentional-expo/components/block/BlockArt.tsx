/**
 * US-103 · Little illustrations for the Block tab's presets and the status pills of "Blocking now".
 * Drawn in react-native-svg so they work in Expo Go and on the web.
 */
import { Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { FontFamily } from '@/constants/design';
import type { PresetArt } from '@/services/blockPresets';
import type { PillTone } from '@/services/blockStatus';

const INK = '#1E1A17';

/** A preset's picture: a sleepy moon with stars, a briefcase, a sunrise over a hill. */
export function PresetIllustration({ art, accent, size = 72 }: { art: PresetArt; accent: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      {art === 'moon' ? (
        <G>
          <Path d="M44 14 A22 22 0 1 0 58 50 A18 18 0 1 1 44 14 Z" fill="#FFE27A" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
          <Path d="M30 40 Q33 42.5 36 40" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" />
          <Path d="M40 36 Q43 38.5 46 36" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" />
          <Path d="M14 18 L16 22 L20 23 L16 24.5 L14 29 L12 24.5 L8 23 L12 22 Z" fill={accent} />
          <Circle cx={60} cy={20} r={2.4} fill={accent} />
          <Circle cx={22} cy={56} r={1.8} fill={accent} />
        </G>
      ) : art === 'briefcase' ? (
        <G>
          <Rect x={12} y={24} width={48} height={34} rx={8} fill={accent} stroke={INK} strokeWidth={2.4} />
          <Path d="M27 24 V19 Q27 15 31 15 H41 Q45 15 45 19 V24" stroke={INK} strokeWidth={2.4} fill="none" />
          <Rect x={12} y={36} width={48} height={4} fill={INK} opacity={0.18} />
          <Rect x={32} y={34} width={8} height={8} rx={2} fill="#FFE27A" stroke={INK} strokeWidth={2} />
        </G>
      ) : (
        <G>
          <Circle cx={36} cy={44} r={14} fill="#FFC94A" stroke={INK} strokeWidth={2.4} />
          {[0, 1, 2, 3, 4].map((k) => {
            const a = Math.PI + (k / 4) * Math.PI;
            return (
              <Path
                key={k}
                d={`M${36 + Math.cos(a) * 19} ${44 + Math.sin(a) * 19} L${36 + Math.cos(a) * 25} ${44 + Math.sin(a) * 25}`}
                stroke={accent}
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })}
          <Path d="M6 52 Q24 40 40 50 T70 48 V66 H6 Z" fill="#8CC084" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
        </G>
      )}
    </Svg>
  );
}

const TONES: Record<PillTone, { bg: string; fg: string; dot: string }> = {
  active: { bg: '#DDF3E4', fg: '#1F7A45', dot: '#2FB463' },
  unlocked: { bg: '#FFF1D6', fg: '#9A5B00', dot: '#F2A13A' },
  next: { bg: '#ECE7DF', fg: '#5E554C', dot: '#A49A90' },
  always: { bg: '#1E1A17', fg: '#FFFFFF', dot: '#FFB547' },
  off: { bg: '#ECE7DF', fg: '#8C847B', dot: '#C6BDB3' },
};

/** A status pill: "● Active", "● Next at 9:00"… */
export function StatusPill({ text, tone }: { text: string; tone: PillTone }) {
  const t = TONES[tone];
  return (
    <View accessibilityLabel={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: t.bg, alignSelf: 'flex-start' }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.dot }} />
      <Text style={{ color: t.fg, fontFamily: FontFamily.bodyBold, fontSize: 13 }}>{text}</Text>
    </View>
  );
}
