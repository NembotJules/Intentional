/**
 * Web fallback for GoalWallpaperSheet.
 *
 * react-native-view-shot and expo-media-library don't work in a browser.
 * This stub renders a bottom sheet explaining the limitation so the app
 * doesn't crash — the wallpaper generator is available in the native build.
 */
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MetaGoal } from '@/types';
import { FontFamily, Surface } from '@/constants/design';
import { CTA } from '@/components/onboarding/parts';

interface Props {
  goal: MetaGoal;
  tone: string;
  visible: boolean;
  onClose: () => void;
}

export function GoalWallpaperSheet({ tone, visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Lock-screen wallpaper</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close" style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Surface.ink} />
            </Pressable>
          </View>

          <View style={styles.body}>
            <View style={[styles.iconBox, { backgroundColor: tone }]}>
              <Ionicons name="phone-portrait-outline" size={34} color="#FFFFFF" />
            </View>
            <Text style={styles.heading}>Made for your phone</Text>
            <Text style={styles.sub}>
              Saving a wallpaper needs your photo library, which a browser can&apos;t reach. Open Intentional on your
              iPhone or Android to make one.
            </Text>
          </View>

          <CTA label="Got it" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23,20,17,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Surface.canvas,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Surface.ruleStrong,
    alignSelf: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    flex: 1,
    fontFamily: FontFamily.bodyBold,
    fontSize: 24,
    lineHeight: 30,
    color: Surface.ink,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Surface.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    alignItems: 'center',
    paddingBottom: 28,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heading: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 20,
    lineHeight: 26,
    color: Surface.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  sub: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 22,
    color: Surface.muted,
    textAlign: 'center',
    maxWidth: 320,
  },
});
