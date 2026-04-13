/**
 * Thin wrapper around expo-haptics that no-ops gracefully on web / unsupported
 * devices so callers never need to guard themselves.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

/** Light tick — habit check-off, button taps. */
export function hapticLight(): void {
  if (!supported) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Medium bump — session start, step advance in onboarding. */
export function hapticMedium(): void {
  if (!supported) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Heavy thud — session complete burst, destructive confirm. */
export function hapticHeavy(): void {
  if (!supported) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** Success notification — timer finishes naturally. */
export function hapticSuccess(): void {
  if (!supported) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Warning notification — archive / delete confirmation. */
export function hapticWarning(): void {
  if (!supported) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}
