import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, Pressable, Text, View, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Accent, Colors, FontFamily, Surface } from '@/constants/design';
import { hapticLight, hapticSuccess, hapticTick } from '@/utils/haptics';

/** Onboarding palette — now the app-wide tokens (constants/design). */
export const OB = {
  bg: Surface.canvas,
  hill: Surface.hill,
  card: Surface.surfaceRaised,
  cardOn: Surface.surface,
  ink: Surface.ink,
  muted: Surface.muted,
  faint: Surface.faint,
  blue: Accent.blue,
  blueSoft: Accent.blueSoft,
  red: Accent.red,
  redSoft: Accent.redSoft,
  green: Accent.green,
  greenSoft: Accent.greenSoft,
  orange: Accent.orange,
  track: Surface.rule,
} as const;

export const T = {
  title: { color: OB.ink, fontFamily: FontFamily.bodyBold, fontSize: 28, lineHeight: 34, textAlign: 'center' } as TextStyle,
  titleLeft: { color: OB.ink, fontFamily: FontFamily.bodyBold, fontSize: 28, lineHeight: 34 } as TextStyle,
  huge: { color: OB.ink, fontFamily: FontFamily.bodyBold, fontSize: 72, lineHeight: 78, textAlign: 'center', letterSpacing: -1.5 } as TextStyle,
  lead: { color: OB.ink, fontFamily: FontFamily.bodySemiBold, fontSize: 20, lineHeight: 27, textAlign: 'center' } as TextStyle,
  body: { color: OB.muted, fontFamily: FontFamily.body, fontSize: 17, lineHeight: 24, textAlign: 'center' } as TextStyle,
  accent: { color: OB.blue, fontFamily: FontFamily.bodySemiBold, fontSize: 15, lineHeight: 21, textAlign: 'center' } as TextStyle,
  fine: { color: OB.faint, fontFamily: FontFamily.body, fontSize: 12, lineHeight: 17, textAlign: 'center' } as TextStyle,
};

/** Soft curved floor the mascot stands on. */
export function Hill({ top, color = OB.hill }: { top: number; color?: string }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top, left: '-60%', width: '220%', height: 2000, borderRadius: 1000, backgroundColor: color }}
    />
  );
}

export function CTA({
  label,
  onPress,
  disabled,
  color = OB.ink,
  textColor = '#FFFFFF',
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  color?: string;
  textColor?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        height: 58,
        borderRadius: 29,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.3 : pressed ? 0.85 : 1,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      })}
    >
      <Text style={{ color: textColor, fontFamily: FontFamily.bodyBold, fontSize: 18 }}>{label}</Text>
    </Pressable>
  );
}

export type Option = { id: string; label: string; icon?: keyof typeof Ionicons.glyphMap };

export function OptionRows({ options, selected, onSelect }: { options: Option[]; selected: string[]; onSelect: (id: string) => void }) {
  return (
    <View style={{ gap: 10 }}>
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <Pressable
            key={o.id}
            onPress={() => {
              hapticLight();
              onSelect(o.id);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              minHeight: 58,
              paddingHorizontal: 18,
              paddingVertical: 12,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: on ? OB.ink : 'transparent',
              backgroundColor: on ? OB.cardOn : OB.card,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            })}
          >
            {o.icon ? <Ionicons name={o.icon} size={21} color={on ? OB.ink : OB.muted} /> : null}
            <Text style={{ flex: 1, color: OB.ink, fontFamily: FontFamily.bodySemiBold, fontSize: 17 }}>{o.label}</Text>
            {on ? <Ionicons name="checkmark-circle" size={22} color={OB.ink} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A card that slides + fades in when `shown` flips on. */
export function Reveal({ shown, children, delay = 0 }: { shown: boolean; children: ReactNode; delay?: number }) {
  const v = useRef(new Animated.Value(shown ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: shown ? 1 : 0, duration: 380, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [shown, v, delay]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

export function FactCard({ icon, text, tone = 'neutral' }: { icon?: keyof typeof Ionicons.glyphMap; text: string; tone?: 'neutral' | 'blue' | 'red' | 'green' }) {
  const bg = tone === 'blue' ? OB.blueSoft : tone === 'red' ? OB.redSoft : tone === 'green' ? OB.greenSoft : '#FFFFFF';
  const fg = tone === 'red' ? OB.red : tone === 'green' ? OB.green : tone === 'blue' ? OB.blue : OB.ink;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: bg,
        shadowColor: '#000',
        shadowOpacity: tone === 'neutral' ? 0.06 : 0,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: tone === 'neutral' ? 2 : 0,
      }}
    >
      {icon ? <Ionicons name={icon} size={22} color={fg} /> : null}
      <Text style={{ flex: 1, color: OB.ink, fontFamily: FontFamily.bodySemiBold, fontSize: 15.5, lineHeight: 21, textAlign: icon ? 'left' : 'center' }}>{text}</Text>
    </View>
  );
}

// ─── Welcome carousel: tiny live previews of the app ─────────────────────────

function PhoneFrame({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <View
      style={{
        width: 210,
        height: 330,
        borderRadius: 36,
        borderWidth: 7,
        borderColor: '#1A1716',
        backgroundColor: dark ? Surface.focusCanvas : Surface.canvas,
        overflow: 'hidden',
        transform: [{ rotate: '-4deg' }],
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
      }}
    >
      <View style={{ alignSelf: 'center', width: 64, height: 16, borderRadius: 8, backgroundColor: '#1A1716', marginTop: 6 }} />
      <View style={{ flex: 1, padding: 12 }}>{children}</View>
    </View>
  );
}

const MOCK_ROWS = [
  { name: 'Morning training', pillar: 'Body', color: Colors.pillarBody, p: 1 },
  { name: 'Deep work', pillar: 'Craft', color: Colors.pillarCraft, p: 0.6 },
  { name: 'Read 20 pages', pillar: 'Mind', color: Colors.pillarMind, p: 0.25 },
];

export function MockToday() {
  return (
    <PhoneFrame>
      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 24, color: OB.ink }}>Today</Text>
      <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 10, color: OB.muted, marginBottom: 10 }}>2h 15m given to your pillars</Text>
      {MOCK_ROWS.map((r) => (
        <View key={r.name} style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 9, marginBottom: 7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: r.color }} />
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 11, color: OB.ink, flex: 1 }}>{r.name}</Text>
            {r.p >= 1 ? <Ionicons name="checkmark-circle" size={13} color={r.color} /> : null}
          </View>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: '#EFE7DC', marginTop: 7 }}>
            <View style={{ width: `${r.p * 100}%`, height: 4, borderRadius: 2, backgroundColor: r.color }} />
          </View>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
        {['Body', 'Craft', 'Mind', 'Money'].map((p, i) => (
          <View key={p} style={{ flex: 1, height: 42, borderRadius: 10, backgroundColor: [Colors.pillarBody, Colors.pillarCraft, Colors.pillarMind, Colors.pillarMoney][i], opacity: 0.85, justifyContent: 'flex-end', padding: 5 }}>
            <Text style={{ color: '#fff', fontFamily: FontFamily.bodyBold, fontSize: 8 }}>{p}</Text>
          </View>
        ))}
      </View>
    </PhoneFrame>
  );
}

export function MockFocus() {
  const R = 62;
  const C = 2 * Math.PI * R;
  return (
    <PhoneFrame dark>
      <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 10, color: Surface.focusMuted, textAlign: 'center', marginTop: 10 }}>DEEP WORK · CRAFT</Text>
      <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 18 }}>
        <Svg width={150} height={150}>
          <Circle cx={75} cy={75} r={R} stroke="rgba(255,248,238,0.15)" strokeWidth={8} fill="none" />
          <Circle cx={75} cy={75} r={R} stroke={Colors.pillarCraft} strokeWidth={8} fill="none" strokeLinecap="round" strokeDasharray={`${C * 0.62} ${C}`} transform="rotate(-90 75 75)" />
        </Svg>
        <Text style={{ position: 'absolute', fontFamily: FontFamily.monoSemiBold, fontSize: 30, color: Surface.focusText }}>27:48</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 }}>
        <Ionicons name="lock-closed" size={11} color={Surface.focusMuted} />
        <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 10, color: Surface.focusMuted }}>Distracting apps blocked</Text>
      </View>
    </PhoneFrame>
  );
}

export function MockWeek() {
  const days = [
    [0.5, 0.3, 0.2],
    [0.6, 0.5, 0.25],
    [0.4, 0.6, 0.3],
    [0.7, 0.45, 0.35],
    [0.5, 0.7, 0.3],
    [0.8, 0.5, 0.4],
    [0.9, 0.6, 0.45],
  ];
  const colors = [Colors.pillarBody, Colors.pillarCraft, Colors.pillarMind];
  return (
    <PhoneFrame>
      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 22, color: OB.ink }}>This week</Text>
      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 30, color: OB.ink, marginTop: 6 }}>14h 20m</Text>
      <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 10, color: Colors.pillarMoney, marginBottom: 14 }}>▲ 3h 05m more than last week</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 7, height: 130 }}>
        {days.map((d, i) => (
          <View key={i} style={{ flex: 1, justifyContent: 'flex-end', gap: 2 }}>
            {d.map((h, j) => (
              <View key={j} style={{ height: h * 40, borderRadius: 3, backgroundColor: colors[j] }} />
            ))}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontFamily: FontFamily.bodySemiBold, fontSize: 9, color: OB.faint }}>{d}</Text>
        ))}
      </View>
    </PhoneFrame>
  );
}

// ─── Hours slider (colour shifts as it climbs) ── ──────────────────

export function hoursColor(h: number): string {
  if (h < 3) return OB.green;
  if (h < 6) return OB.orange;
  return OB.red;
}

export function HoursSlider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const viewRef = useRef<View>(null);
  const originRef = useRef({ x: 0, w: 1 });
  const valueRef = useRef(value);
  valueRef.current = value;
  const THUMB = 34;

  const measure = () => {
    viewRef.current?.measureInWindow((x, _y, w) => {
      originRef.current = { x, w: Math.max(1, w) };
    });
  };

  const setFromX = (pageX: number) => {
    const { x, w } = originRef.current;
    const usable = w - THUMB;
    const f = Math.min(1, Math.max(0, (pageX - x - THUMB / 2) / usable));
    const raw = min + f * (max - min);
    const next = Math.min(max, Math.max(min, Math.round(raw / step) * step));
    if (next !== valueRef.current) {
      hapticTick();
      onChange(next);
    }
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          measure();
          setFromX(e.nativeEvent.pageX);
        },
        onPanResponderMove: (e) => setFromX(e.nativeEvent.pageX),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [min, max, step]
  );

  const [w, setW] = useState(300);
  const f = (value - min) / (max - min);
  const left = f * (w - THUMB);
  const color = hoursColor(value);

  return (
    <View>
      <View
        ref={viewRef}
        onLayout={(e) => {
          setW(e.nativeEvent.layout.width);
          measure();
        }}
        style={{ height: 52, justifyContent: 'center' }}
        accessibilityRole="adjustable"
        accessibilityLabel="Hours a day that drift by"
        accessibilityValue={{ min, max, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onChange(Math.min(max, value + step));
          if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(min, value - step));
        }}
        {...responder.panHandlers}
      >
        <View style={{ height: 12, borderRadius: 6, backgroundColor: OB.track, overflow: 'hidden' }}>
          <View style={{ width: left + THUMB / 2, height: 12, borderRadius: 6, backgroundColor: color }} />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left,
            width: THUMB,
            height: THUMB,
            borderRadius: THUMB / 2,
            borderWidth: 3,
            borderColor: OB.ink,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="hourglass-outline" size={16} color={OB.ink} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: OB.ink }}>{min}h</Text>
        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: OB.ink }}>{max}h+</Text>
      </View>
    </View>
  );
}

// ─── Loading bars ("Personalizing your experience") ──────────────────────────

export function LoadBar({ progress }: { progress: number }) {
  return (
    <View style={{ height: 5, borderRadius: 3, backgroundColor: OB.track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`, height: 5, borderRadius: 3, backgroundColor: OB.blue }} />
    </View>
  );
}

// ─── Life in dots ────────────────────────────────────────────────────────────

/**
 * 80 dots = 80 years. Phase 0: the whole life. 1: years lived fill blue.
 * 2: lived years vanish ("what you have left"). 3: drifting years fill red from the end.
 */
export function LifeGrid({ total, lived, livedShown, lost, lostShown, hideLived }: { total: number; lived: number; livedShown: number; lost: number; lostShown: number; hideLived: boolean }) {
  const COLS = 8;
  const dots = Array.from({ length: total }, (_, i) => i);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: COLS * 30, alignSelf: 'center' }}>
      {dots.map((i) => {
        const isLived = i < lived;
        const fromEnd = total - 1 - i;
        const isLost = !isLived && fromEnd < lost;
        let bg: string = '#DCD3C8';
        if (isLived && i < livedShown) bg = '#8EC9FF';
        if (isLost && fromEnd < lostShown) bg = OB.red;
        return (
          <View key={i} style={{ width: 30, height: 26, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: bg, opacity: hideLived && isLived ? 0 : 1 }} />
          </View>
        );
      })}
    </View>
  );
}

// ─── Hold to commit ──────────────────────────────────────────────────────────

export function HoldCircle({ onComplete, label, onProgress }: { onComplete: () => void; label: string; onProgress?: (p: number) => void }) {
  const fill = useRef(new Animated.Value(0)).current;
  const [p, setP] = useState(0);
  const doneRef = useRef(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const SIZE = 104;
  const R = 46;
  const C = 2 * Math.PI * R;

  useEffect(() => {
    const id = fill.addListener(({ value }) => {
      setP(value);
      onProgressRef.current?.(value);
    });
    return () => {
      fill.removeListener(id);
      if (tick.current) clearInterval(tick.current);
    };
  }, [fill]);

  const stopTicks = () => {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
  };

  const start = () => {
    if (doneRef.current) return;
    hapticLight();
    tick.current = setInterval(hapticTick, 90);
    Animated.timing(fill, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      stopTicks();
      if (finished && !doneRef.current) {
        doneRef.current = true;
        hapticSuccess();
        onComplete();
      }
    });
  };
  const cancel = () => {
    stopTicks();
    if (doneRef.current) return;
    Animated.timing(fill, { toValue: 0, duration: 250, useNativeDriver: false }).start();
  };

  return (
    <Pressable onPressIn={start} onPressOut={cancel} accessibilityRole="button" accessibilityLabel={label} style={{ alignSelf: 'center' }}>
      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', transform: [{ scale: 1 + p * 0.08 }] }}>
        <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(255,255,255,0.25)" strokeWidth={6} fill="rgba(255,255,255,0.08)" />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke="#FFFFFF"
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${C * p} ${C}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="finger-print" size={34} color={OB.ink} />
        </View>
      </View>
    </Pressable>
  );
}

/** Concentric rings behind the commitment screen. */
export function Rings() {
  return (
    <Svg pointerEvents="none" width="100%" height="100%" style={{ position: 'absolute' }} viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
      {[60, 110, 160, 210, 260].map((r) => (
        <Circle key={r} cx={200} cy={470} r={r} stroke="rgba(255,255,255,0.09)" strokeWidth={1.5} fill="none" />
      ))}
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const rad = (a * Math.PI) / 180;
        return <Circle key={a} cx={200 + Math.cos(rad) * 110} cy={470 + Math.sin(rad) * 110} r={110} stroke="rgba(255,255,255,0.05)" strokeWidth={1.2} fill="none" />;
      })}
    </Svg>
  );
}

/** Dusk sky → ash floor, for the "years of your life" verdict. */
export function DuskBackground() {
  return (
    <Svg pointerEvents="none" width="100%" height="100%" style={{ position: 'absolute' }}>
      <Defs>
        <LinearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8E5CF6" />
          <Stop offset="0.45" stopColor="#D58CC8" />
          <Stop offset="0.62" stopColor="#B9A6B8" />
          <Stop offset="1" stopColor="#6E6870" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#dusk)" />
    </Svg>
  );
}

/** Sunburst behind the "good news" moments. */
export function Sunburst({ height }: { height: number }) {
  const rays = 16;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height, overflow: 'hidden', backgroundColor: '#BFE3FF' }}>
      <Svg width="100%" height="100%" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: rays }, (_, i) => {
          const a0 = (i / rays) * Math.PI * 2;
          const a1 = a0 + Math.PI / rays;
          const cx = 200;
          const cy = 250;
          const L = 700;
          const d = `M${cx} ${cy} L${cx + Math.cos(a0) * L} ${cy + Math.sin(a0) * L} L${cx + Math.cos(a1) * L} ${cy + Math.sin(a1) * L} Z`;
          return <Path key={i} d={d} fill="#8FD0FF" opacity={0.75} />;
        })}
      </Svg>
    </View>
  );
}
