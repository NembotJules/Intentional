/**
 * Web implementation of GoalWallpaperSheet.
 *
 * Uses html2canvas to capture the wallpaper card and download it as a PNG.
 * Optionally uses Web Share API when available.
 */
import { useRef, useState } from 'react';
import { View, Text, Modal, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import html2canvas from 'html2canvas';
import type { MetaGoal } from '@/types';
import { Colors, Surface, ghostBorder } from '@/constants/design';
import { WallpaperCard, CARD_W, CARD_H } from './WallpaperCard';

interface Props {
  goal: MetaGoal;
  tone: string;
  visible: boolean;
  onClose: () => void;
}

export function GoalWallpaperSheet({ goal, tone, visible, onClose }: Props) {
  const cardRef = useRef<View>(null);
  const [saving, setSaving] = useState(false);

  const captureCard = async (): Promise<string> => {
    if (!cardRef.current) {
      throw new Error('Card ref not available');
    }

    const element = cardRef.current as unknown as HTMLElement;
    const canvas = await html2canvas(element, {
      backgroundColor: '#0B0E0F',
      scale: 3,
      width: CARD_W,
      height: CARD_H,
      logging: false,
      useCORS: true,
    });

    return canvas.toDataURL('image/png');
  };

  const handleDownload = async () => {
    if (saving) return;
    try {
      setSaving(true);
      const dataUrl = await captureCard();

      const link = document.createElement('a');
      link.download = `${goal.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_wallpaper.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert('Your wallpaper has been downloaded! Check your Downloads folder.');
      onClose();
    } catch (e) {
      console.error('Download error:', e);
      alert('Could not download the wallpaper. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (saving) return;
    try {
      setSaving(true);
      const dataUrl = await captureCard();

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${goal.name}_wallpaper.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${goal.name} wallpaper`,
          text: `Wallpaper for my goal: ${goal.name}`,
        });
      } else {
        alert('Web Share API is not available on this browser. Please use the Download button instead.');
      }
    } catch (e) {
      console.error('Share error:', e);
      alert('Could not share the wallpaper. Please use the Download button instead.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            <Text style={styles.sheetTitle}>Goal Wallpaper</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.sheetSub}>
            Preview your wallpaper below. Download it and set it as your lock screen.
          </Text>

          <View style={styles.previewOuter}>
            <View style={styles.previewClip} pointerEvents="none">
              <View style={styles.previewScale}>
                <WallpaperCard goal={goal} tone={tone} />
              </View>
            </View>

            <View
              ref={cardRef}
              collapsable={false}
              style={styles.offscreen}
            >
              <WallpaperCard goal={goal} tone={tone} />
            </View>
          </View>

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
              onPress={() => void handleDownload()}
              disabled={saving}
              style={[styles.actionBtn, styles.actionPrimary, { backgroundColor: tone }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={18} color="#fff" />
                  <Text style={[styles.actionLabel, { color: '#fff' }]}>Download PNG</Text>
                </>
              )}
            </Pressable>
          </View>
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
  previewOuter: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  offscreen: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CARD_W,
    height: CARD_H,
    opacity: 0,
    pointerEvents: 'none',
  },
  previewClip: {
    width: Math.round(CARD_W * 0.4),
    height: Math.round(CARD_H * 0.4),
    borderRadius: 14,
    overflow: 'hidden',
  },
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
