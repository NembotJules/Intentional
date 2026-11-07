/**
 * US-107 · The chosen apps as their real icons (iOS only): a SwiftUI strip of Apple's `Label(token)` from
 * FamilyControlsModule.swift (SelectedAppsView). Returns null where the native module isn't compiled in
 * (web, Android, Expo Go), so callers show their own fallback.
 */
import { Platform, type StyleProp, type ViewStyle } from 'react-native';

type Props = { selection: string | null; maxIcons?: number; iconSize?: number; style?: StyleProp<ViewStyle> };
let NativeView: React.ComponentType<Props> | null | undefined;

function nativeView(): React.ComponentType<Props> | null {
  if (NativeView !== undefined) return NativeView;
  NativeView = null;
  if (Platform.OS !== 'ios') return null;
  try {
    const { requireOptionalNativeModule, requireNativeView } = require('expo');
    if (requireOptionalNativeModule('FamilyControls')) NativeView = requireNativeView('FamilyControls') as React.ComponentType<Props>;
  } catch {
    NativeView = null;
  }
  return NativeView;
}

export const canShowSelectedApps = () => !!nativeView();

export function SelectedApps({ selection, maxIcons = 8, iconSize = 28, style }: Props) {
  const V = nativeView();
  if (!V || !selection) return null;
  return <V selection={selection} maxIcons={maxIcons} iconSize={iconSize} style={[{ height: iconSize + 4, flex: 1 }, style]} />;
}
