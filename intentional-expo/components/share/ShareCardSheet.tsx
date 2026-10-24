/**
 * Bottom sheet that previews a shareable card and sends it (US-085 + accountability partner).
 *
 * The card is rendered twice: full size off-screen (that's what gets captured) and scaled down as
 * the preview. With a partner, the main button is "Send to <name>" (share sheet with image + text),
 * plus "Text it to <name>" when there's a number (Messages, text only).
 */
import { useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CTA } from '@/components/onboarding/parts';
import { PressableScale } from '@/components/ui/motion';
import { Accent, FontFamily, Radius, Surface, hexToRgba } from '@/constants/design';
import type { CardTheme } from '@/components/share/WeekCard';
import type { Partner } from '@/services/partner';
import { openSms, shareCard, type ShareResult } from '@/utils/shareCard';
import { hapticSuccess } from '@/utils/haptics';

export interface ShareCardSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  cardWidth: number;
  cardHeight: number;
  renderCard: (theme: CardTheme) => ReactNode;
  /** Caption sent with the image (and the whole SMS). */
  message: string;
  partner?: Partner | null;
  /** Called after a share that wasn't cancelled. */
  onSent?: (via: 'share' | 'sms', result: ShareResult) => void;
  /** The look the card opens with (default: light). */
  initialTheme?: CardTheme;
}

export function ShareCardSheet({ visible, onClose, title, sub, cardWidth, cardHeight, renderCard, message, partner, onSent, initialTheme = 'paper' }: ShareCardSheetProps) {
  const captureRef = useRef<View>(null);
  const [theme, setTheme] = useState<CardTheme>(initialTheme);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const { height: screenH } = useWindowDimensions();
  const scale = Math.min(0.62, Math.max(0.42, (screenH * 0.46) / cardHeight));
  const pw = Math.round(cardWidth * scale);
  const ph = Math.round(cardHeight * scale);

  const send = async () => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    const r = await shareCard(captureRef, { message, title });
    setBusy(false);
    if (r === 'failed') setStatus("Couldn't open the share sheet. Try again.");
    else if (r === 'copied') setStatus('Copied. Paste it in your chat.');
    if (r === 'shared' || r === 'copied') {
      hapticSuccess();
      onSent?.('share', r);
    }
  };

  const sms = async () => {
    if (!partner?.phone || busy) return;
    const ok = await openSms(partner.phone, message);
    if (ok) {
      hapticSuccess();
      onSent?.('sms', 'shared');
    } else setStatus("Couldn't open Messages.");
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: hexToRgba(Surface.ink, 0.45) }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close share" />
        <View style={{ backgroundColor: Surface.canvas, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '94%' }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 }} bounces={false}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: Surface.ruleStrong, alignSelf: 'center', marginBottom: 14 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text accessibilityRole="header" style={{ flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 22, lineHeight: 28, color: Surface.ink }}>
                {title}
              </Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={20} color={Surface.ink} />
              </Pressable>
            </View>
            {sub ? <Text style={{ fontFamily: FontFamily.body, fontSize: 15, lineHeight: 21, color: Surface.muted, marginTop: 4 }}>{sub}</Text> : null}

            {/* Off-screen full-size card: the one that gets captured */}
            <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: 0, width: cardWidth, height: cardHeight }}>
              <View ref={captureRef} collapsable={false} style={{ width: cardWidth, height: cardHeight }}>
                {renderCard(theme)}
              </View>
            </View>

            {/* Preview */}
            <View style={{ alignItems: 'center', marginTop: 16 }}>
              <View
                testID="share-card-preview"
                style={{
                  width: pw,
                  height: ph,
                  borderRadius: 18,
                  overflow: 'hidden',
                  backgroundColor: Surface.surface,
                  shadowColor: '#3A2A14',
                  shadowOpacity: 0.16,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 6,
                }}
              >
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: -(cardWidth * (1 - scale)) / 2,
                    top: -(cardHeight * (1 - scale)) / 2,
                    width: cardWidth,
                    height: cardHeight,
                    transform: [{ scale }],
                  }}
                >
                  {renderCard(theme)}
                </View>
              </View>
            </View>

            {/* Look */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14 }}>
              {(['paper', 'night'] as const).map((t) => {
                const on = theme === t;
                return (
                  <PressableScale
                    key={t}
                    onPress={() => setTheme(t)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={t === 'paper' ? 'Light card' : 'Dark card'}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      height: 36,
                      paddingHorizontal: 14,
                      borderRadius: Radius.full,
                      backgroundColor: on ? Surface.ink : Surface.surfaceRaised,
                    }}
                  >
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: t === 'paper' ? Surface.canvas : Surface.focusCanvas,
                        borderWidth: 1,
                        borderColor: on ? Surface.surface : Surface.ruleStrong,
                      }}
                    />
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: on ? Surface.surface : Surface.ink }}>{t === 'paper' ? 'Light' : 'Dark'}</Text>
                  </PressableScale>
                );
              })}
            </View>

            <View style={{ marginTop: 18 }}>
              <CTA label={busy ? 'Opening…' : partner ? `Send to ${partner.name}` : 'Share'} onPress={() => void send()} />
            </View>
            {partner?.phone ? (
              <PressableScale
                onPress={() => void sms()}
                accessibilityRole="button"
                accessibilityLabel={`Text it to ${partner.name}`}
                style={{ height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 }}
              >
                <Ionicons name="chatbubble-outline" size={18} color={Surface.ink} />
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>Text it to {partner.name}</Text>
              </PressableScale>
            ) : null}
            {status ? (
              <Text accessibilityLiveRegion="polite" style={{ textAlign: 'center', fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Accent.blue, marginTop: 10 }}>
                {status}
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
