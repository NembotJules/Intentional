import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, PanResponder, Pressable, Text, View, type ImageSourcePropType, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Accent, FontFamily, Surface } from '@/constants/design';
import { hapticLight, hapticSuccess, hapticTick } from '@/utils/haptics';
import { PressableScale } from '@/components/ui/motion';

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
  // A little pop when the button wakes up (e.g. right after an answer is picked).
  const pop = useRef(new Animated.Value(1)).current;
  const wasDisabled = useRef(disabled);
  useEffect(() => {
    if (wasDisabled.current && !disabled) {
      pop.setValue(0.94);
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
    }
    wasDisabled.current = disabled;
  }, [disabled, pop]);
  return (
    <Animated.View style={{ alignSelf: 'stretch', transform: [{ scale: pop }] }}>
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic={false}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{
        height: 58,
        borderRadius: 29,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <Text style={{ color: textColor, fontFamily: FontFamily.bodyBold, fontSize: 18 }}>{label}</Text>
    </PressableScale>
    </Animated.View>
  );
}

export type Option = { id: string; label: string; icon?: keyof typeof Ionicons.glyphMap };

export function OptionRows({ options, selected, onSelect }: { options: Option[]; selected: string[]; onSelect: (id: string) => void }) {
  return (
    <View style={{ gap: 10 }}>
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <PressableScale
            key={o.id}
            haptic={false}
            scaleTo={0.985}
            onPress={() => {
              hapticLight();
              onSelect(o.id);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
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
                  }}
          >
            {o.icon ? <Ionicons name={o.icon} size={21} color={on ? OB.ink : OB.muted} /> : null}
            <Text style={{ flex: 1, color: OB.ink, fontFamily: FontFamily.bodySemiBold, fontSize: 17 }}>{o.label}</Text>
            {on ? <Ionicons name="checkmark-circle" size={22} color={OB.ink} /> : null}
          </PressableScale>
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

// ─── Welcome carousel: real screenshots of the app ───────────────────────────

/**
 * A real screenshot of the app in a phone, with a status bar — the welcome carousel shows the actual
 * product, the way top apps do. Screenshots live in assets/images/onboarding (390×812 @2x).
 */
export function AppShot({ source, dark, tilt = -4, height = 420 }: { source: ImageSourcePropType; dark?: boolean; tilt?: number; height?: number }) {
  const H = height;
  const W = Math.round(H * 0.476);
  return (
    <View
      style={{
        width: W,
        height: H,
        borderRadius: 34,
        borderWidth: 6,
        borderColor: '#1A1716',
        backgroundColor: dark ? Surface.focusCanvas : Surface.canvas,
        overflow: 'hidden',
        transform: [{ rotate: `${tilt}deg` }],
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 12 },
        elevation: 10,
      }}
    >
      <View style={{ height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
        <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 9, color: dark ? Surface.focusText : Surface.ink }}>9:41</Text>
        <View style={{ width: 54, height: 14, borderRadius: 7, backgroundColor: '#1A1716' }} />
        <Ionicons name="battery-full" size={11} color={dark ? Surface.focusText : Surface.ink} />
      </View>
      <Image source={source} resizeMode="cover" style={{ flex: 1, width: '100%' }} />
    </View>
  );
}

// ─── Hours slider (colour shifts as it climbs) ───────────────────────────────

export function hoursColor(h: number): string {
  if (h < 3) return OB.green;
  if (h < 6) return OB.orange;
  return OB.red;
}

export function HoursSlider({
  value,
  min,
  max,
  step,
  onChange,
  label = 'Hours a day that drift by',
  colorFor = hoursColor,
  thumb,
  thumbSize = 34,
  showEnds = true,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label?: string;
  colorFor?: (v: number) => string;
  /** Custom thumb content (defaults to an hourglass). */
  thumb?: ReactNode;
  thumbSize?: number;
  showEnds?: boolean;
}) {
  const viewRef = useRef<View>(null);
  const originRef = useRef({ x: 0, w: 1 });
  const valueRef = useRef(value);
  valueRef.current = value;
  const THUMB = thumbSize;

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
  const color = colorFor(value);

  return (
    <View>
      <View
        ref={viewRef}
        onLayout={(e) => {
          setW(e.nativeEvent.layout.width);
          measure();
        }}
        style={{ height: Math.max(52, THUMB + 8), justifyContent: 'center' }}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
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
          {thumb ?? <Ionicons name="hourglass-outline" size={16} color={OB.ink} />}
        </View>
      </View>
      {showEnds ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: OB.ink }}>{min}h</Text>
          <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: OB.ink }}>{max}h+</Text>
        </View>
      ) : null}
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
