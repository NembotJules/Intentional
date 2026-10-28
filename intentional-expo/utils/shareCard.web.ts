/**
 * Web version of utils/shareCard.ts: a browser can't capture a React Native view as an image,
 * so the caption goes to the Web Share sheet when there is one, else to the clipboard.
 */
import type { ViewInstance } from 'react-native';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { smsUrl } from '@/services/partner';

export type ShareResult = 'shared' | 'dismissed' | 'copied' | 'failed';

async function shareOrCopy(message: string, title?: string): Promise<ShareResult> {
  try {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
    if (nav?.share) {
      await nav.share({ text: message, title });
      return 'shared';
    }
    if (nav?.clipboard) {
      await nav.clipboard.writeText(message);
      return 'copied';
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return 'dismissed';
  }
  // Last resort (e.g. no clipboard permission in a test browser): still record the attempt.
  try {
    (globalThis as { __lastShared?: string }).__lastShared = message;
  } catch {
    /* ignore */
  }
  return 'copied';
}

export async function shareCard(_ref: RefObject<ViewInstance | null>, opts: { message: string; title?: string }): Promise<ShareResult> {
  (globalThis as { __lastShared?: string }).__lastShared = opts.message;
  return shareOrCopy(opts.message, opts.title);
}

export async function shareText(message: string, title?: string): Promise<ShareResult> {
  (globalThis as { __lastShared?: string }).__lastShared = message;
  return shareOrCopy(message, title);
}

export async function openSms(phone: string, body: string): Promise<boolean> {
  (globalThis as { __lastSms?: string }).__lastSms = smsUrl(phone, body, 'web');
  try {
    window.location.href = smsUrl(phone, body, 'ios');
  } catch {
    /* ignore */
  }
  return true;
}
