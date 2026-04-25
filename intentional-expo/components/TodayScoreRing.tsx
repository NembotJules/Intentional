import { useEffect, useMemo, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors, FontFamily, Surface } from '@/constants/design';

type TodayScoreRingProps = {
  score: number;
  size?: number;
  lineWidth?: number;
};

export function TodayScoreRing({ score, size = 80, lineWidth = 10 }: TodayScoreRingProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const trackColor = Surface.surfaceRaised;
  const radius = (size - lineWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useRef(new Animated.Value(0)).current;
  const AnimatedCircle = useMemo(() => Animated.createAnimatedComponent(Circle), []);

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: clamped,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [clamped, progress]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  return (
    <View className="justify-center items-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={lineWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#scoreGradient)"
          strokeWidth={lineWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}, ${circumference}`}
          strokeDashoffset={strokeDashoffset}
        />
        <Defs>
          <LinearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={Colors.pillarCraft} />
            <Stop offset="55%" stopColor={Colors.pillarMind} />
            <Stop offset="100%" stopColor={Colors.pillarMoney} />
          </LinearGradient>
        </Defs>
      </Svg>

      <View className="items-center justify-center absolute inset-0">
        <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.monoSemiBold, fontSize: 18, lineHeight: 20 }}>
          {Math.round(score)}
        </Text>
        <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoMedium, fontSize: 8, letterSpacing: 1.2, marginTop: 2 }}>
          SCORE
        </Text>
      </View>
    </View>
  );
}
