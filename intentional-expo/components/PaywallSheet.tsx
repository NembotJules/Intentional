/**
 * PaywallSheet — US-047 / US-048
 *
 * Full-screen modal shown when a free user taps a premium feature.
 * Handles plan selection, stub purchase, and restore purchases.
 * Swap in real react-native-purchases calls in services/purchases.ts
 * when RevenueCat keys are ready — no changes needed here.
 */

import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Surface, Colors } from '@/constants/design';
import { shadows } from '@/styles/shadows';
import {
  PLANS,
  PREMIUM_FEATURES,
  purchasePlan,
  restorePurchases,
  type SubscriptionPlan,
} from '@/services/purchases';
import { hapticMedium, hapticLight, hapticSuccess } from '@/utils/haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful purchase or restore so the parent can refresh. */
  onSuccess: () => void;
}

type UIState = 'idle' | 'purchasing' | 'restoring';

export function PaywallSheet({ visible, onClose, onSuccess }: Props) {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('annual');
  const [uiState, setUiState] = useState<UIState>('idle');

  const busy = uiState !== 'idle';

  const handlePurchase = async () => {
    hapticMedium();
    setUiState('purchasing');
    const result = await purchasePlan(selectedPlan);
    setUiState('idle');
    if (result.success) {
      hapticSuccess();
      onSuccess();
      onClose();
      Alert.alert('Welcome to Intentional Pro 🎉', 'All premium features are now unlocked.');
    } else {
      Alert.alert('Purchase failed', result.error ?? 'Something went wrong. Please try again.');
    }
  };

  const handleRestore = async () => {
    hapticLight();
    setUiState('restoring');
    const result = await restorePurchases();
    setUiState('idle');
    if (!result.success) {
      Alert.alert('Restore failed', result.error ?? 'Could not reach the App Store. Try again later.');
      return;
    }
    if (result.hasPremium) {
      hapticSuccess();
      onSuccess();
      onClose();
      Alert.alert('Subscription restored', 'Your Intentional Pro access has been reinstated.');
    } else {
      Alert.alert('No active subscription found', 'We couldn\'t find a previous purchase on this Apple ID.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        {/* Close button */}
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12} disabled={busy}>
          <Ionicons name="close" size={20} color={Colors.textSecondary} />
        </Pressable>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          bounces={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>⚡</Text>
            <Text style={styles.heroTitle}>Intentional Pro</Text>
            <Text style={styles.heroSub}>
              Everything you need to build{'\n'}the life you actually want.
            </Text>
          </View>

          {/* Feature list */}
          <View style={styles.featureList}>
            {PREMIUM_FEATURES.map((f) => (
              <View key={f.label} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>

          {/* Plan selector */}
          <View style={styles.plans}>
            {PLANS.map((plan) => {
              const active = selectedPlan === plan.id;
              return (
                <Pressable
                  key={plan.id}
                  style={[styles.planCard, active && styles.planCardActive]}
                  onPress={() => { hapticLight(); setSelectedPlan(plan.id); }}
                >
                  {plan.badge ? (
                    <View style={styles.planBadge}>
                      <Text style={styles.planBadgeText}>{plan.badge}</Text>
                    </View>
                  ) : null}
                  <View style={styles.planCardInner}>
                    <View>
                      <Text style={[styles.planLabel, active && styles.planLabelActive]}>{plan.label}</Text>
                      <Text style={styles.planSub}>{plan.sub}</Text>
                    </View>
                    <Text style={[styles.planPrice, active && styles.planPriceActive]}>{plan.price}</Text>
                  </View>
                  {active && (
                    <View style={styles.planCheck}>
                      <Ionicons name="checkmark-circle" size={18} color="#e8e4dc" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Legal note */}
          <Text style={styles.legal}>
            Subscription auto-renews unless cancelled at least 24 hours before the
            renewal date. Manage in iOS Settings → Subscriptions.
          </Text>
        </ScrollView>

        {/* CTA */}
        <View style={styles.cta}>
          <Pressable
            style={[styles.subscribeBtn, busy && styles.subscribeBtnDisabled]}
            onPress={() => void handlePurchase()}
            disabled={busy}
          >
            {uiState === 'purchasing' ? (
              <ActivityIndicator color="#0e0e0e" />
            ) : (
              <Text style={styles.subscribeBtnText}>
                Subscribe — {PLANS.find((p) => p.id === selectedPlan)?.price}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.restoreBtn}
            onPress={() => void handleRestore()}
            disabled={busy}
          >
            {uiState === 'restoring' ? (
              <ActivityIndicator size="small" color={Colors.textTertiary} />
            ) : (
              <Text style={styles.restoreBtnText}>Restore purchases</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Surface.base,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    margin: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Surface.high,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  // Hero
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  heroEmoji: {
    fontSize: 44,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#e8e4dc',
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Features
  featureList: {
    backgroundColor: Surface.container,
    borderRadius: 14,
    paddingVertical: 6,
    marginBottom: 20,
    ...shadows.card,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  featureIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  featureLabel: {
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
  },
  // Plans
  plans: {
    gap: 10,
    marginBottom: 16,
  },
  planCard: {
    borderRadius: 12,
    backgroundColor: Surface.container,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    ...shadows.card,
  },
  planCardActive: {
    borderColor: '#e8e4dc',
  },
  planCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  planBadge: {
    backgroundColor: '#e8e4dc',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0e0e0e',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  planLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  planLabelActive: {
    color: '#e8e4dc',
  },
  planSub: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  planPriceActive: {
    color: '#e8e4dc',
  },
  planCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  // Legal
  legal: {
    fontSize: 10,
    color: Colors.textLabel,
    lineHeight: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  // CTA
  cta: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 10,
  },
  subscribeBtn: {
    backgroundColor: '#e8e4dc',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  subscribeBtnDisabled: {
    opacity: 0.6,
  },
  subscribeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0e0e0e',
    letterSpacing: -0.2,
  },
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  restoreBtnText: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
});
