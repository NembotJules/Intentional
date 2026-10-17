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
import { PillarIcon } from '@/components/ui/PillarIcon';
import { Accent, FontFamily, Surface, hexToRgba } from '@/constants/design';
import { CTA, Hill } from '@/components/onboarding/parts';
import { Mascot } from '@/components/onboarding/Mascot';

// ─── Card dimensions ─────────────────────────────────────────────────────────
// We render at 390 × 844 logical pts (iPhone 14 screen) so the card is
// portable; captureRef with quality=1 will use the device pixel ratio.
const CARD_W = 390;
const CARD_H = 844;

// ─── Wallpaper card (the view we'll capture) ─────────────────────────────────
// Spark look: warm paper, the pillar's colour circle, bold name, the why in a
// soft blue card, and Flick standing on a hill tinted with the pillar colour.
function WallpaperCard({ goal, tone }: { goal: MetaGoal; tone: string }) {
  const hasWhy = !!goal.why_statement?.trim();
  return (
    <View style={styles.card}>
      <Hill top={CARD_H * 0.74} color={hexToRgba(tone, 0.16)} />

      <View style={styles.cardBody}>
        {/* Leave the top third clear for the lock-screen clock */}
        <View style={styles.centerBlock}>
          <PillarIcon icon={goal.icon} name={goal.name} color={tone} size={88} />
          <Text style={styles.goalName}>{goal.name}</Text>
          <Text style={styles.goalSub}>Every hour I give it counts.</Text>

          {hasWhy && (
            <View style={styles.whyCard}>
              <Text style={styles.why}>{goal.why_statement?.trim()}</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Mascot mood="proud" size={96} intensity={0.85} bob={false} />
          <Text style={styles.dateStamp}>
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · Intentional
          </Text>
        </View>
      </View>
    </View>
  );
}

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
            <Text style={styles.sheetTitle}>Lock-screen wallpaper</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close" style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Surface.ink} />
            </Pressable>
          </View>

          <Text style={styles.sheetSub}>
            See {goal.name} every time you reach for your phone. Save it, then set it as your lock screen.
          </Text>

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
              accessibilityRole="button"
              accessibilityLabel="Share"
              style={[styles.shareBtn, { opacity: saving ? 0.4 : 1 }]}
            >
              <Ionicons name="share-outline" size={20} color={Surface.ink} />
            </Pressable>

            <View style={{ flex: 1 }}>
              {saving ? (
                <View style={styles.savingBtn}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              ) : (
                <CTA label="Save to Photos" onPress={() => void handleSaveToPhotos()} />
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Card
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: Surface.canvas,
    overflow: 'hidden',
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 36,
    paddingTop: CARD_H * 0.3,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  centerBlock: {
    alignItems: 'center',
  },
  goalName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1,
    color: Surface.ink,
    textAlign: 'center',
    marginTop: 20,
  },
  goalSub: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 16,
    color: Surface.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  whyCard: {
    marginTop: 24,
    backgroundColor: Accent.blueSoft,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignSelf: 'stretch',
  },
  why: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 18,
    lineHeight: 25,
    color: Surface.ink,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: 10,
  },
  dateStamp: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: Surface.muted,
    textAlign: 'center',
  },

  // ── Sheet
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
    maxHeight: '92%',
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
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sheetTitle: {
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
  sheetSub: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Surface.muted,
    lineHeight: 21,
    marginBottom: 18,
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
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Surface.canvas,
    shadowColor: '#3A2A14',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
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
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  shareBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Surface.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingBtn: {
    height: 58,
    borderRadius: 29,
    backgroundColor: Surface.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
