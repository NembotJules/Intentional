/**
 * US-100 · A big speech bubble whose words type themselves out (services/typing), with a tail pointing
 * down at Flick. Tap it to show everything at once. With reduced motion on, the text shows at once.
 * The bubble grows line by line as it types (text left-aligned, so words don't jump).
 * Screen readers get the whole sentence straight away (accessibilityLabel); what's on screen types.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { FontFamily, Motion, Surface } from '@/constants/design';
import { typedLength, typingDuration } from '@/services/typing';

export function TypedBubble({
  text,
  sub,
  onDone,
  style,
  size = 'lg',
}: {
  text: string;
  /** A smaller second line that appears once the main text is typed. */
  sub?: string | null;
  onDone?: () => void;
  style?: StyleProp<ViewStyle>;
  size?: 'md' | 'lg';
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? text.length : 0);
  const started = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (reduce) {
      setShown(text.length);
      doneRef.current?.();
      return;
    }
    setShown(0);
    started.current = Date.now();
    const total = typingDuration(text);
    const id = setInterval(() => {
      const n = typedLength(text, Date.now() - started.current);
      setShown(n);
      if (n >= text.length) {
        clearInterval(id);
        doneRef.current?.();
      }
    }, 24);
    const guard = setTimeout(() => setShown(text.length), total + 400);
    return () => {
      clearInterval(id);
      clearTimeout(guard);
    };
  }, [text, reduce]);

  const finished = shown >= text.length;
  return (
    <Animated.View key={text} entering={ZoomIn.springify().damping(Motion.spring.damping)} style={[{ alignSelf: 'stretch' }, style]}>
      <Pressable
        onPress={() => {
          if (!finished) {
            setShown(text.length);
            doneRef.current?.();
          }
        }}
        accessibilityRole="header"
        accessibilityLabel={`Flick asks: ${text}`}
        style={{
          backgroundColor: Surface.surface,
          borderRadius: 26,
          paddingHorizontal: 20,
          paddingVertical: size === 'lg' ? 16 : 12,
          shadowColor: '#000',
          shadowOpacity: 0.14,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 5,
        }}
      >
        <Text
          style={{
            fontFamily: FontFamily.bodyBold,
            fontSize: size === 'lg' ? 24 : 19,
            lineHeight: size === 'lg' ? 30 : 25,
            minHeight: size === 'lg' ? 30 : 25,
            color: Surface.ink,
          }}
        >
          {text.slice(0, shown)}
        </Text>
        {sub && finished ? (
          <Animated.Text entering={FadeIn.duration(Motion.duration)} style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, lineHeight: 20, color: Surface.muted, marginTop: 6 }}>
            {sub}
          </Animated.Text>
        ) : null}
      </Pressable>
      {/* the tail, pointing down at Flick */}
      <View style={{ alignSelf: 'center', width: 18, height: 18, marginTop: -10, zIndex: -1, backgroundColor: Surface.surface, transform: [{ rotate: '45deg' }] }} />
    </Animated.View>
  );
}
