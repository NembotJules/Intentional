/**
 * usePremium — React hook for gating premium features.
 *
 * Usage:
 *   const { requirePremium, paywallVisible, setPaywallVisible, refresh } = usePremium();
 *
 *   // Gate a button:
 *   onPress={() => requirePremium(() => router.push('/weekly-review'))}
 *
 *   // Mount the sheet (once, at component bottom):
 *   <PaywallSheet visible={paywallVisible} onClose={() => setPaywallVisible(false)} onSuccess={refresh} />
 */

import { useState, useCallback, useEffect } from 'react';
import { checkEntitlements, isPremium as isPremiumSync } from '@/services/purchases';

export function usePremium() {
  const [premium, setPremium] = useState<boolean>(isPremiumSync());
  const [paywallVisible, setPaywallVisible] = useState(false);

  // Re-validate on mount (async, updates the cached flag)
  useEffect(() => {
    void checkEntitlements().then(setPremium);
  }, []);

  /** Re-read entitlement status (call after a purchase or restore). */
  const refresh = useCallback(async () => {
    const result = await checkEntitlements();
    setPremium(result);
    return result;
  }, []);

  /**
   * Wrap any premium action.  If the user is subscribed, the action runs
   * immediately.  If not, the paywall is shown instead.
   */
  const requirePremium = useCallback(
    (action: () => void) => {
      if (premium) {
        action();
      } else {
        setPaywallVisible(true);
      }
    },
    [premium]
  );

  return { isPremium: premium, paywallVisible, setPaywallVisible, requirePremium, refresh };
}
