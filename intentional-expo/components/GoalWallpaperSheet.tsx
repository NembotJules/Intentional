/**
 * GoalWallpaperSheet — US-038
 *
 * Renders a phone-proportioned goal card (1170 × 2532 logical units = iPhone 14 Pro
 * native resolution at 3× — at the device's pixel ratio this produces a full-res asset).
 * The view is captured off-screen via react-native-view-shot and saved to the
 * Camera Roll (expo-media-library) or shared via expo-sharing.
 *
 * Usage:
 *   <GoalWallpaperSheet goal={goal} tone={tone} visible={visible} onClose={onClose} />
 */
import { useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import type { MetaGoal } from '@/types';
import { Colors, Surface, ghostBorder } from '@/constants/design';
import { WallpaperCard, CARD_W, CARD_H } from './WallpaperCard';

// ─── Sheet ───────────────────────────────────────────────────────────────────
interface Props {
  goal: MetaGoal;
  tone: string;
  visible: boolean;
  onClose: () => void;
}

export function GoalWallpaperSheet({ goal, tone, visible, onClose }: Props) {
  const cardRef = useRef<View>(null);
  const [saving, setSaving] = useState(false);

  const requestMediaPermission = async (): Promise<boolean> => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    return status === 'granted';
  };

  const handleSaveToPhotos = async () => {
    if (saving) return;
    try {
      setSaving(true);
      const granted = await requestMediaPermission();
      if (!granted) {
        Alert.alert('Permission needed', 'Allow photo library access in Settings to save your wallpaper.');
        return;
      }
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved!', 'Your wallpaper has been saved to your photo library. Set it as your lock screen in the Photos app.');
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Could not save the wallpaper. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (saving) return;
    try {
      setSaving(true);
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing not available', 'This device does not support the share sheet.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `${goal.name} wallpaper` });
    } catch {
      Alert.alert('Error', 'Could not share the wallpaper. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Title row */}
          <View style={styles.titleRow}>
            <Text style={styles.sheetTitle}>Goal Wallpaper</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.sheetSub}>
            Preview your wallpaper below. Save it to Photos then set it as your lock screen.
          </Text>

          {/* Card preview — scaled down to fit the sheet */}
          {/* Card preview — scaled down for display */}
          <View style={styles.previewOuter}>
            {/* The off-screen full-size view that gets captured */}
            <View
              ref={cardRef}
              collapsable={false}
              style={styles.offscreen}
            >
              <WallpaperCard goal={goal} tone={tone} />
            </View>

            {/* Visible scaled preview — same content, scaled via transform */}
            <View style={styles.previewClip} pointerEvents="none">
              <View style={styles.previewScale}>
                <WallpaperCard goal={goal} tone={tone} />
              </View>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <Pressable
              onPress={() => void handleShare()}
              disabled={saving}
              style={[styles.actionBtn, styles.actionSecondary]}
            >
              <Ionicons name="share-outline" size={18} color={Colors.textSecondary} />
              <Text style={[styles.actionLabel, { color: Colors.textSecondary }]}>Share</Text>
            </Pressable>

            <Pressable
              onPress={() => void handleSaveToPhotos()}
              disabled={saving}
              style={[styles.actionBtn, styles.actionPrimary, { backgroundColor: tone }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={18} color="#fff" />
                  <Text style={[styles.actionLabel, { color: '#fff' }]}>Save to Photos</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Sheet
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
    paddingHorizontal: 16,
    paddingBottom: 36,
    maxHeight: '92%',
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
    marginBottom: 6,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sheetSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  /** Container that reserves the scaled-down space */
  previewOuter: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  /** Hidden full-size view used for capture */
  offscreen: {
    position: 'absolute',
    left: -9999,
    top: 0,
    width: CARD_W,
    height: CARD_H,
  },
  /** Clips the scaled card so it occupies the right visual box */
  previewClip: {
    width: Math.round(CARD_W * 0.4),
    height: Math.round(CARD_H * 0.4),
    borderRadius: 14,
    overflow: 'hidden',
  },
  /**
   * Scale the full-size card down. RN scales from the element's center, so
   * we offset by (W*(1-S)/2, H*(1-S)/2) to simulate top-left origin.
   * S = 0.4, so offsetX = 390*0.6/2 = 117, offsetY = 844*0.6/2 = 253.
   */
  previewScale: {
    position: 'absolute',
    left: -Math.round(CARD_W * 0.6 / 2),
    top: -Math.round(CARD_H * 0.6 / 2),
    width: CARD_W,
    height: CARD_H,
    transform: [{ scale: 0.4 }],
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionSecondary: {
    backgroundColor: Surface.high,
    borderWidth: 0.5,
    borderColor: ghostBorder,
  },
  actionPrimary: {
    flex: 2,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
