/**
 * Each world's signature things, in one place, used by FlickWorld (Today), WorldStage (the unlock scene) and the
 * world previews (app/worlds.tsx). Three layers:
 *   `sky`  behind the back hill (mountains, a skyline), anchored on the back hill's top line (y), across `width`;
 *   `far`  on the back hill (a tent, pines, a sailboat, a cabin, a water tower) at (x, y);
 *   `near` on the front hill (mushrooms, a palm, reeds, string lights) at (x, y).
 */
import { Circle, G, Path, Rect } from 'react-native-svg';
import type { SkyPhase } from '@/services/worldThemes';

function Pine({ x, y, s, dark }: { x: number; y: number; s: number; dark: boolean }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Rect x={-1.6} y={-6} width={3.2} height={7} fill={dark ? '#2A1E16' : '#6B4A2E'} />
      <Path d="M0 -40 L11 -18 L5 -18 L14 -4 L-14 -4 L-5 -18 L-11 -18 Z" fill={dark ? '#14281F' : '#2E6B45'} />
    </G>
  );
}

export function ThemeDecor({
  themeId,
  phase,
  x,
  y,
  scale = 1,
  width = 390,
  layer,
}: {
  themeId?: string | null;
  phase: SkyPhase;
  x: number;
  y: number;
  scale?: number;
  width?: number;
  layer: 'sky' | 'far' | 'near';
}) {
  const night = phase === 'night';
  const dusk = phase === 'dusk';
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

  if (id === 'forest') {
    if (layer === 'far')
      return (
        <G accessibilityLabel="pines">
          {[0.06, 0.16, 0.27, 0.66, 0.77, 0.9].map((f, i) => (
            <Pine key={i} x={f * width} y={y + 26 + (i % 2) * 6} s={scale * (i % 3 === 1 ? 1.15 : 0.95)} dark={night} />
          ))}
        </G>
      );
    if (layer === 'near')
      return (
        <G transform={`translate(${x} ${y}) scale(${scale})`}>
          <Rect x={-2} y={-8} width={4} height={8} rx={1.5} fill="#F4EBDD" />
          <Path d="M-8 -8 Q0 -19 8 -8 Z" fill="#E8443A" />
          <Circle cx={-3} cy={-12} r={1.4} fill="#FFFFFF" />
          <Circle cx={3} cy={-11} r={1.2} fill="#FFFFFF" />
          <Rect x={13} y={-5} width={3} height={5} rx={1} fill="#F4EBDD" />
          <Path d="M9 -5 Q14.5 -12 20 -5 Z" fill="#E8443A" />
        </G>
      );
    return null;
  }

  if (id === 'beach') {
    if (layer === 'far')
      return (
        <G>
          {/* wave lines on the sea, and a little sailboat */}
          {[0.12, 0.34, 0.58].map((f, i) => (
            <Path key={i} d={`M${f * width} ${y + 18 + i * 5} q6 -4 12 0 q6 4 12 0`} stroke="rgba(255,255,255,0.65)" strokeWidth={1.6} fill="none" strokeLinecap="round" />
          ))}
          <G transform={`translate(${x} ${y}) scale(${scale})`}>
            <Path d="M0 14 L26 14 L22 20 L4 20 Z" fill={night ? '#3A2E3E' : '#B5763A'} />
            <Path d="M12 13 L12 -10 L24 11 Z" fill={night ? '#C9C2D6' : '#FFFFFF'} />
            <Path d="M11 13 L11 -4 L3 11 Z" fill={night ? '#9A90AE' : '#FF8A65'} />
          </G>
        </G>
      );
    if (layer === 'near')
      return (
        <G transform={`translate(${x} ${y}) scale(${scale})`}>
          <Path d="M0 0 C2 -18 6 -34 12 -48" stroke={night ? '#3A2B22' : '#8A5A3B'} strokeWidth={4} fill="none" strokeLinecap="round" />
          {[
            'M12 -48 C2 -52 -10 -46 -16 -38',
            'M12 -48 C22 -54 34 -50 40 -42',
            'M12 -48 C6 -58 -2 -62 -10 -62',
            'M12 -48 C20 -60 30 -62 36 -60',
            'M12 -48 C12 -56 16 -62 20 -66',
          ].map((d, i) => (
            <Path key={i} d={d} stroke={night ? '#1F3A2E' : '#2F9E58'} strokeWidth={5} fill="none" strokeLinecap="round" />
          ))}
          <Circle cx={10} cy={-45} r={3} fill={night ? '#3A2B22' : '#7A4E2E'} />
        </G>
      );
    return null;
  }

  if (id === 'lake') {
    if (layer === 'sky')
      return (
        <G>
          {/* snowy peaks behind the hills */}
          <Path d={`M${width * 0.02} ${y + 10} L${width * 0.2} ${y - 70} L${width * 0.38} ${y + 10} Z`} fill={night ? '#2E3A55' : dusk ? '#6E6A92' : '#8C9DC0'} />
          <Path d={`M${width * 0.2} ${y - 70} L${width * 0.15} ${y - 48} L${width * 0.19} ${y - 52} L${width * 0.22} ${y - 46} L${width * 0.25} ${y - 54} Z`} fill={night ? '#C9D2E6' : '#FFFFFF'} />
          <Path d={`M${width * 0.5} ${y + 10} L${width * 0.74} ${y - 92} L${width * 1.0} ${y + 10} Z`} fill={night ? '#26304A' : dusk ? '#5E5A85' : '#7889AE'} />
          <Path d={`M${width * 0.74} ${y - 92} L${width * 0.68} ${y - 64} L${width * 0.72} ${y - 68} L${width * 0.76} ${y - 61} L${width * 0.8} ${y - 70} Z`} fill={night ? '#C9D2E6' : '#FFFFFF'} />
        </G>
      );
    if (layer === 'far')
      return (
        <G transform={`translate(${x} ${y}) scale(${scale})`}>
          {/* a little cabin with a lit window at night */}
          <Rect x={0} y={6} width={24} height={16} fill={night ? '#3B2C24' : '#8A5A3B'} />
          <Path d="M-3 7 L12 -5 L27 7 Z" fill={night ? '#2A1E18' : '#5E3B26'} />
          <Rect x={9} y={11} width={6} height={6} fill={night ? '#FFD27A' : '#CFE6F5'} />
        </G>
      );
    if (layer === 'near')
      return (
        <G transform={`translate(${x} ${y}) scale(${scale})`}>
          {[0, 5, 10, 15].map((dx, i) => (
            <G key={i}>
              <Path d={`M${dx} 0 L${dx + (i % 2 ? 2 : -2)} -${16 + (i % 3) * 5}`} stroke={night ? '#1F3029' : '#4E7A3E'} strokeWidth={1.8} strokeLinecap="round" />
              <Rect x={dx + (i % 2 ? 0.5 : -3.5)} y={-(20 + (i % 3) * 5)} width={3} height={7} rx={1.5} fill={night ? '#3A2B22' : '#7A4E2E'} />
            </G>
          ))}
        </G>
      );
    return null;
  }

  if (id === 'rooftop') {
    if (layer === 'sky') {
      // A city skyline behind the roofs; windows light up at dusk and night.
      const blocks = [
        [0.0, 0.1, 64], [0.1, 0.08, 92], [0.18, 0.12, 48], [0.3, 0.07, 110], [0.37, 0.1, 70], [0.47, 0.09, 54],
        [0.56, 0.11, 96], [0.67, 0.08, 62], [0.75, 0.1, 120], [0.85, 0.08, 80], [0.93, 0.07, 58],
      ] as const;
      const lit = night || dusk;
      return (
        <G>
          {blocks.map(([fx, fw, h], i) => {
            const bx = fx * width;
            const bw = fw * width;
            return (
              <G key={i}>
                <Rect x={bx} y={y + 12 - h} width={bw - 2} height={h} fill={night ? '#1E1C38' : dusk ? '#463E66' : '#8F9BB8'} />
                {Array.from({ length: Math.floor(h / 14) }, (_, r) =>
                  [0, 1].map((c) => (
                    <Rect
                      key={`${r}-${c}`}
                      x={bx + 4 + c * (bw / 2 - 2)}
                      y={y + 12 - h + 6 + r * 14}
                      width={Math.max(3, bw / 2 - 8)}
                      height={6}
                      fill={lit && (r + c + i) % 3 !== 0 ? '#FFD27A' : night ? '#2A2848' : 'rgba(255,255,255,0.35)'}
                    />
                  ))
                )}
              </G>
            );
          })}
        </G>
      );
    }
    if (layer === 'far')
      return (
        <G transform={`translate(${x} ${y}) scale(${scale})`}>
          {/* a water tower on the next roof */}
          <Path d="M2 26 L6 10 M20 26 L16 10" stroke={night ? '#2A2235' : '#5E4E5A'} strokeWidth={2} />
          <Rect x={2} y={-4} width={18} height={15} rx={3} fill={night ? '#3A2E3E' : '#8A5A3B'} />
          <Path d="M0 -4 L11 -12 L22 -4 Z" fill={night ? '#2A1E28' : '#5E3B26'} />
        </G>
      );
    if (layer === 'near')
      return (
        <G>
          {/* string lights between two poles */}
          <Path d={`M${width * 0.08} ${y} L${width * 0.08} ${y - 44} M${width * 0.92} ${y} L${width * 0.92} ${y - 44}`} stroke={night ? '#1A1626' : '#4A3E48'} strokeWidth={2.4} />
          <Path d={`M${width * 0.08} ${y - 44} Q${width * 0.5} ${y - 14} ${width * 0.92} ${y - 44}`} stroke={night ? '#2A2235' : '#4A3E48'} strokeWidth={1.2} fill="none" />
          {Array.from({ length: 11 }, (_, i) => {
            const t = (i + 1) / 12;
            const px = width * (0.08 + 0.84 * t);
            const py = y - 44 + 4 * t * (1 - t) * 30;
            return <Circle key={i} cx={px} cy={py + 3} r={2.6} fill={['#FFD23F', '#FF8FA3', '#7FDBFF', '#FFB547'][i % 4]} opacity={night || dusk ? 1 : 0.8} />;
          })}
        </G>
      );
    return null;
  }
  return null;
}
