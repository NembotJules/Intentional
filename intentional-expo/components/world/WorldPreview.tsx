/**
 * US-101 · A world in a small frame: its sky (by day, alive), hills, signature things and Flick by his hearth.
 * Locked worlds are drawn as a dark silhouette. Used by the picker (app/worlds.tsx) and the unlock celebration.
 */
import { View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Mascot } from '@/components/onboarding/Mascot';
import { ThemeDecor } from '@/components/world/ThemeDecor';
import { worldLook } from '@/services/world';

const VW = 390;
const VH = 300;

export function WorldPreview({
  themeId,
  width,
  height,
  locked = false,
  stage = 0,
  hideFlick = false,
}: {
  themeId: string;
  width: number;
  height: number;
  locked?: boolean;
  stage?: number;
  /** US-126: the unlock reveal draws its own (animated) Flick. */
  hideFlick?: boolean;
}) {
  const look = worldLook({ hour: 13, warmth: 1, themeId });
  const sil = '#2B2733';
  const gid = `prevSky${themeId}${locked ? 'L' : ''}`;
  return (
    <View style={{ width, height, borderRadius: 22, overflow: 'hidden', backgroundColor: locked ? '#3A3542' : look.skyBottom }}>
      <Svg width={width} height={height} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMax slice">
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={locked ? '#4A4456' : look.skyTop} />
            <Stop offset="1" stopColor={locked ? '#5E5868' : look.skyBottom} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={VW} height={VH} fill={`url(#${gid})`} />
        {!locked ? <ThemeDecor themeId={themeId} phase="day" x={0} y={198} width={VW} layer="sky" /> : null}
        <Path d={`M0 214 C70 180 140 186 200 204 C260 222 320 190 ${VW} 196 L${VW} ${VH} L0 ${VH} Z`} fill={locked ? sil : look.hillBack} />
        {!locked ? <ThemeDecor themeId={themeId} phase="day" x={300} y={182} width={VW} layer="far" /> : null}
        <Path d={`M0 250 C80 226 150 232 195 238 C250 246 320 224 ${VW} 236 L${VW} ${VH} L0 ${VH} Z`} fill={locked ? '#24212B' : look.hillFront} />
        {!locked ? <ThemeDecor themeId={themeId} phase="day" x={64} y={246} width={VW} layer="near" /> : null}
        <Ellipse cx={195} cy={272} rx={44} ry={8} fill={locked ? '#1B1920' : 'rgba(30,20,10,0.18)'} />
      </Svg>
      {!locked && !hideFlick ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: height * 0.07, alignItems: 'center' }}>
          <Mascot mood="happy" size={Math.round(height * 0.42)} intensity={0.9} bob={false} stage={stage} />
        </View>
      ) : null}
    </View>
  );
}
