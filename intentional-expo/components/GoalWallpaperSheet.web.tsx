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
import { Colors, Surface, ghostBorder } from '@/constants/design';

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
            <Text style={styles.title}>Goal Wallpaper</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.body}>
            <View style={[styles.iconBox, { backgroundColor: tone + '22' }]}>
              <Ionicons name="image-outline" size={36} color={tone} />
            </View>
            <Text style={styles.heading}>Available in the native app</Text>
            <Text style={styles.sub}>
              Generating and saving wallpapers requires access to your camera roll, which isn&apos;t available in a
              browser. Open the app on your iPhone or Android device to use this feature.
            </Text>
          </View>

          <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: tone }]}>
            <Text style={styles.btnLabel}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Surface.container,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: ghostBorder,
    alignSelf: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  body: {
    alignItems: 'center',
    paddingBottom: 28,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  btn: {
    height: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
