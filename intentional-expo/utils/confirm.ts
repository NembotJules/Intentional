/**
 * Cross-platform confirmation. `Alert.alert` does nothing on react-native-web, so every
 * "Are you sure?" must go through this (native: Alert; web: window.confirm).
 */
import { Alert, Platform } from 'react-native';

export function confirmAsync(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const { title, message = '', confirmLabel = 'OK', cancelLabel = 'Cancel', destructive = false } = opts;
  if (Platform.OS === 'web') {
    const ok = typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(message ? `${title}\n\n${message}` : title) : true;
    return Promise.resolve(ok);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
