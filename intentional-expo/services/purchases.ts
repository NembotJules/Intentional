/**
 * RevenueCat subscription stub — US-047 / US-048.
 *
 * API surface mirrors the real react-native-purchases SDK so that wiring
 * in the real keys later is a drop-in replacement:
 *   1. Run:  npx expo install react-native-purchases
 *   2. Sign up at https://app.revenuecat.com and create an app.
 *   3. Replace the TODO stubs below with real Purchases.* calls.
 *   4. Set REVENUECAT_IOS_KEY and REVENUECAT_ANDROID_KEY in app.json / eas.json secrets.
 *
 * Until then the service uses a persisted in-memory flag so the whole
 * paywall flow (buy → premium unlocked) is testable end-to-end.
 */

import { getSetting, setSetting } from '@/db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubscriptionPlan = 'monthly' | 'annual';

export interface PlanInfo {
  id: SubscriptionPlan;
  label: string;
  price: string;
  sub: string;
  badge?: string;
}

export const PLANS: PlanInfo[] = [
  {
    id: 'annual',
    label: 'Annual',
    price: '$29.99',
    sub: '$2.50 / month',
    badge: 'Best value · Save 50 %',
  },
  {
    id: 'monthly',
    label: 'Monthly',
    price: '$4.99',
    sub: 'per month',
  },
];

/** Features shown in the paywall feature list. */
export const PREMIUM_FEATURES = [
  { icon: '🎯', label: 'Goal Detail — streaks, stats, reorder' },
  { icon: '🖼️', label: 'Goal wallpaper generator' },
  { icon: '📅', label: 'Weekly review & reflection' },
  { icon: '📊', label: 'Full session history' },
  { icon: '🔔', label: 'Daily action reminders' },
  { icon: '♾️', label: 'All future Pro features' },
];

// ─── Internal state ───────────────────────────────────────────────────────────

const PREMIUM_KEY = 'rc_is_premium';

function readPremium(): boolean {
  return getSetting(PREMIUM_KEY) === '1';
}

function writePremium(v: boolean): void {
  setSetting(PREMIUM_KEY, v ? '1' : '0');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Synchronous check — safe to call anywhere (reads from local DB cache).
 * TODO: replace body with the result of the last Purchases.getCustomerInfo() call.
 */
export function isPremium(): boolean {
  return readPremium();
}

/**
 * Called once on app startup.  Validates entitlements from RevenueCat server
 * and updates the local cache.
 * TODO: replace with Purchases.configure({ apiKey }) + Purchases.getCustomerInfo().
 */
export async function checkEntitlements(): Promise<boolean> {
  // Stub: trust the persisted flag; no network call.
  return readPremium();
}

/**
 * Purchase the selected plan.
 * TODO: replace with Purchases.purchasePackage(package).
 */
export async function purchasePlan(
  plan: SubscriptionPlan
): Promise<{ success: boolean; error?: string }> {
  // Stub: simulate a 1.2 s processing delay then succeed.
  await delay(1200);
  writePremium(true);
  return { success: true };
}

/**
 * Restore previous purchases (US-048).
 * TODO: replace with Purchases.restorePurchases().
 */
export async function restorePurchases(): Promise<{
  success: boolean;
  hasPremium: boolean;
  error?: string;
}> {
  // Stub: simulate a 0.8 s restore check then return current flag.
  await delay(800);
  const has = readPremium();
  return { success: true, hasPremium: has };
}

/**
 * DEV-ONLY helper — toggle premium locally without going through the paywall.
 * Remove or guard with __DEV__ before App Store submission.
 */
export function devTogglePremium(): boolean {
  const next = !readPremium();
  writePremium(next);
  return next;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
