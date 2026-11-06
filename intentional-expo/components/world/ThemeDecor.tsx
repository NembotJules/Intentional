/**
 * Each world's signature things, drawn in SVG units at (x, y) on the hills: `far` sits on the back hill,
 * `near` on the front one. One place for every world, used by FlickWorld (Today) and WorldStage (unlock).
 */
import { G, Path } from 'react-native-svg';
import type { SkyPhase } from '@/services/worldThemes';

export function ThemeDecor({
  themeId,
  phase,
  x,
  y,
  scale = 1,
  layer,
}: {
  themeId?: string | null;
  phase: SkyPhase;
  x: number;
  y: number;
  scale?: number;
  layer: 'far' | 'near';
}) {
  const night = phase === 'night';
  const id = themeId ?? 'hill';
  if (id === 'hill') {
    if (layer === 'far')
      return (
        <G transform={`translate(${x} ${y}) scale(${scale})`}>
          <Path d="M0 22 L14 0 L28 22 Z" fill={night ? '#5A4B5E' : '#E9C46A'} />
          <Path d="M10 22 L14 13 L18 22 Z" fill={night ? '#FFB547' : '#B5763A'} opacity={night ? 0.9 : 1} />
        </G>
      );
    return null;
  }
  return null;
}
