/**
 * Capture a card view as a PNG and hand it to the system share sheet, with a caption.
 * iOS: one sheet with the image + text (Messages, WhatsApp, Instagram…). Android: the image (expo-sharing).
 * Web has its own version (utils/shareCard.web.ts): no capture, the text goes to the share sheet or the clipboard.
 */
import type { ViewInstance } from 'react-native';
import type { RefObject } from 'react';
import { Linking, Platform, Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { smsUrl } from '@/services/partner';

export type ShareResult = 'shared' | 'dismissed' | 'copied' | 'failed';

export async function shareCard(ref: RefObject<ViewInstance | null>, opts: { message: string; title?: string }): Promise<ShareResult> {
  try {
    const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
    if (Platform.OS === 'ios') {
      const r = await Share.share({ url: uri, message: opts.message }, { subject: opts.title });
      return r.action === Share.dismissedAction ? 'dismissed' : 'shared';
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: opts.title ?? 'Share' });
      return 'shared';
    }
    const r = await Share.share({ message: opts.message, title: opts.title });
    return r.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'failed';
  }
}

/** Text only (the invite). */
export async function shareText(message: string, title?: string): Promise<ShareResult> {
  try {
    const r = await Share.share({ message, title });
    return r.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'failed';
  }
}

/** Opens Messages with the partner's number and the text filled in. */
export async function openSms(phone: string, body: string): Promise<boolean> {
  try {
    await Linking.openURL(smsUrl(phone, body, Platform.OS === 'android' ? 'android' : 'ios'));
    return true;
  } catch {
    return false;
  }
}
