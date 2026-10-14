/**
 * Motion primitives — every animated surface in the app is built from these,
 * so press feedback, entrances and progress all share one physical feel.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Motion, Surface } from '@/constants/design';
import { hapticLight } from '@/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Staggered entrance for list items: fade + rise with a soft spring. */
export function enter(index = 0) {
  return FadeInDown.delay(index * Motion.stagger)
    .springify()
    .damping(Motion.springSoft.damping)
    .stiffness(Motion.springSoft.stiffness);
}

type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far the surface sinks on press. */
  scaleTo?: number;
  haptic?: boolean;
};

/** A pressable that sinks slightly under the finger and springs back. */
export function PressableScale({ children, style, scaleTo = 0.97, haptic = true, onPressIn, onPressOut, onPress, disabled, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, Motion.press);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, Motion.press);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) hapticLight();
        onPress?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Counts from the previous value to the new one with an ease-out curve. */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  duration = 900,
  style,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  style?: StyleProp<TextStyle>;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const start = Date.now();
    let frame: ReturnType<typeof requestAnimationFrame>;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (value - from) * eased;
      setDisplay(current);
      if (t < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      fromRef.current = value;
    };
  }, [value, duration]);

  return <Text style={style}>{format(display)}</Text>;
}

/** Horizontal progress bar whose fill springs to its new value. */
export function ProgressBar({
  progress,
  color,
  trackColor = Surface.surfaceRaised,
  height = 6,
  delay = 0,
}: {
  progress: number;
  color: string;
  trackColor?: string;
  height?: number;
  delay?: number;
}) {
  const [width, setWidth] = useState(0);
  const fill = useSharedValue(0);
  const clamped = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    if (width > 0) fill.value = withDelay(delay, withSpring(clamped * width, Motion.springSoft));
  }, [clamped, width, delay, fill]);

  const fillStyle = useAnimatedStyle(() => ({ width: fill.value }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height, borderRadius: height, backgroundColor: trackColor, overflow: 'hidden' }}
    >
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: color }, fillStyle]} />
    </View>
  );
}

/** Circular progress ring that sweeps to its value. Children render in the center. */
export function ProgressRing({
  progress,
  size = 200,
  strokeWidth = 10,
  color = Surface.ink,
  trackColor = Surface.surfaceRaised,
  duration = 1100,
  children,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  duration?: number;
  children?: ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withTiming(clamped, { duration, easing: Easing.out(Easing.cubic) });
  }, [clamped, duration, sweep]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - sweep.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      {children}
    </View>
  );
}
