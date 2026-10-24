/**
 * Types a line letter by letter with a soft haptic tick (no sound), like the onboarding.
 * Letters follow the clock, so a busy frame never makes the text stall. Untyped letters are
 * transparent so nothing reflows while it types. Reduce Motion shows the text at once.
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Text, type TextStyle } from 'react-native';
import { hapticTick } from '@/utils/haptics';

export function TypeLine({ text, style, speed = 28, delay = 0, onDone }: { text: string; style?: TextStyle; speed?: number; delay?: number; onDone?: () => void }) {
  const [count, setCount] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    let wait: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    setCount(0);
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          setCount(text.length);
          onDoneRef.current?.();
          return;
        }
        wait = setTimeout(() => {
          const start = Date.now();
          let shown = 0;
          let lastTick = 0;
          id = setInterval(() => {
            const target = Math.min(text.length, Math.floor((Date.now() - start) / speed) + 1);
            if (target === shown) return;
            shown = target;
            setCount(target);
            const now = Date.now();
            if (now - lastTick >= 60 && text[target - 1]?.trim()) {
              lastTick = now;
              hapticTick();
            }
            if (target >= text.length) {
              if (id) clearInterval(id);
              onDoneRef.current?.();
            }
          }, Math.max(16, Math.floor(speed / 2)));
        }, delay);
      });
    return () => {
      cancelled = true;
      if (wait) clearTimeout(wait);
      if (id) clearInterval(id);
    };
  }, [text, speed, delay]);

  return (
    <Text style={style} accessibilityLabel={text}>
      {text.slice(0, count)}
      <Text style={{ color: 'transparent' }}>{text.slice(count)}</Text>
    </Text>
  );
}
