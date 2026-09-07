/**
 * WallpaperCard — Shared card component for goal wallpaper generation
 *
 * Renders a phone-proportioned goal card (390 × 844 logical units).
 * Used by both native and web implementations of GoalWallpaperSheet.
 */
import { View, Text, StyleSheet, Platform } from 'react-native';
import type { MetaGoal } from '@/types';
import { Colors, Surface } from '@/constants/design';

// ─── Card dimensions ─────────────────────────────────────────────────────────
export const CARD_W = 390;
export const CARD_H = 844;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Wallpaper card ──────────────────────────────────────────────────────────
interface Props {
  goal: MetaGoal;
  tone: string;
}

export function WallpaperCard({ goal, tone }: Props) {
  const hasWhy = !!goal.why_statement?.trim();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: Surface.lowest },
      ]}
    >
      <View style={[styles.topBand, { backgroundColor: hexToRgba(tone, 0.18) }]} />

      <View style={styles.scanlines} pointerEvents="none" />

      <View style={styles.cardBody}>
        <Text style={styles.appLabel}>INTENTIONAL</Text>

        <View style={styles.centerBlock}>
          <View style={[styles.iconRing, { borderColor: hexToRgba(tone, 0.45), backgroundColor: hexToRgba(tone, 0.12) }]}>
            <Text style={styles.icon}>{goal.icon}</Text>
          </View>
          <Text style={[styles.goalName, { color: Colors.textPrimary }]}>{goal.name}</Text>

          <View style={[styles.accentBar, { backgroundColor: tone }]} />

          {hasWhy && (
            <Text style={styles.why}>&ldquo;{goal.why_statement?.trim()}&rdquo;</Text>
          )}
        </View>

        <Text style={styles.dateStamp}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</Text>
      </View>

      <View style={[styles.cornerAccent, { borderColor: hexToRgba(tone, 0.25) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: Surface.lowest,
    overflow: 'hidden',
  },
  topBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: CARD_H * 0.38,
  },
  scanlines: {
    position: 'absolute',
    inset: 0,
    opacity: 0.03,
    backgroundColor: 'transparent',
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 44,
    paddingTop: 90,
    paddingBottom: 64,
    justifyContent: 'space-between',
  },
  appLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 10,
    letterSpacing: 4,
    color: 'rgba(255,255,255,0.25)',
  },
  centerBlock: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 0,
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  icon: {
    fontSize: 46,
  },
  goalName: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.5,
    textAlign: 'center',
    marginBottom: 18,
  },
  accentBar: {
    width: 40,
    height: 3,
    borderRadius: 2,
    marginBottom: 28,
  },
  why: {
    fontSize: 15,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 8,
  },
  dateStamp: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  cornerAccent: {
    position: 'absolute',
    top: 28,
    right: 28,
    width: 22,
    height: 22,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderRadius: 3,
  },
});
