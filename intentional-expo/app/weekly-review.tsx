/**
 * US-036: Write (or edit) the current week's reflection.
 * Accessible from Insights and via notification deep-link.
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { Accent, FontFamily, Surface } from '@/constants/design';
import { CTA } from '@/components/onboarding/parts';
import { Mascot } from '@/components/onboarding/Mascot';

const PROMPTS = [
  {
    key: 'went_well' as const,
    label: 'What went well?',
    placeholder: 'Wins count, even small ones…',
  },
  {
    key: 'improve' as const,
    label: 'What would you improve?',
    placeholder: 'What would you do differently?',
  },
  {
    key: 'adjustments' as const,
    label: 'What will you change next week?',
    placeholder: 'A pillar to give more hours, something to drop…',
  },
];

function mondayLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T12:00:00Z');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function WeeklyReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const weekStart = api.currentWeekStart();

  const [fields, setFields] = useState({ went_well: '', improve: '', adjustments: '' });
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setSaved(false);
      const existing = api.getWeeklyReviewForWeek(weekStart);
      if (existing) {
        setFields({ went_well: existing.went_well, improve: existing.improve, adjustments: existing.adjustments });
      } else {
        setFields({ went_well: '', improve: '', adjustments: '' });
      }
    }, [weekStart])
  );

  const handleSave = () => {
    const trimmed = {
      went_well: fields.went_well.trim(),
      improve: fields.improve.trim(),
      adjustments: fields.adjustments.trim(),
    };
    if (!trimmed.went_well && !trimmed.improve && !trimmed.adjustments) {
      Alert.alert('Nothing to save', 'Fill in at least one field before saving.');
      return;
    }
    api.saveWeeklyReview({ week_start: weekStart, ...trimmed });
    setSaved(true);
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/insights');
  };

  const bottomPad = insets.bottom + 24;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: bottomPad }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={22} color={Surface.ink} />
          </Pressable>

          <View style={{ alignItems: 'center', marginTop: 4 }}>
            <Mascot mood={saved ? 'proud' : 'think'} size={96} intensity={0.6} />
            <Text style={{ color: Accent.blue, fontFamily: FontFamily.bodySemiBold, fontSize: 15, marginTop: 10 }}>
              Week of {mondayLabel(weekStart)}
            </Text>
            <Text accessibilityRole="header" style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 28, lineHeight: 34, textAlign: 'center', marginTop: 4 }}>
              Where did your week go?
            </Text>
            <Text style={{ color: Surface.muted, fontFamily: FontFamily.body, fontSize: 16, lineHeight: 22, textAlign: 'center', marginTop: 6, marginBottom: 22 }}>
              Three quick questions. Short answers are fine.
            </Text>
          </View>

          {saved ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginBottom: 18, borderRadius: 16, backgroundColor: Accent.greenSoft }}>
              <Ionicons name="checkmark-circle" size={22} color={Accent.green} />
              <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodySemiBold, fontSize: 16, flex: 1 }}>Review saved. See you next Sunday.</Text>
            </View>
          ) : null}

          {PROMPTS.map((p, idx) => (
            <View key={p.key} style={{ marginBottom: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: Surface.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: Surface.surface, fontFamily: FontFamily.bodyBold, fontSize: 14 }}>{idx + 1}</Text>
                </View>
                <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 18, flex: 1 }}>{p.label}</Text>
              </View>
              <TextInput
                value={fields[p.key]}
                onChangeText={(v) => { setSaved(false); setFields((f) => ({ ...f, [p.key]: v })); }}
                placeholder={p.placeholder}
                placeholderTextColor={Surface.faint}
                accessibilityLabel={p.label}
                multiline
                textAlignVertical="top"
                style={{
                  backgroundColor: Surface.surfaceRaised,
                  borderRadius: 18,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  color: Surface.ink,
                  fontFamily: FontFamily.body,
                  fontSize: 17,
                  lineHeight: 24,
                  minHeight: 112,
                }}
              />
            </View>
          ))}

          <View style={{ marginTop: 6 }}>
            <CTA label={saved ? 'Saved' : 'Save review'} onPress={handleSave} />
          </View>

          <Pressable
            onPress={() => router.push('/reviews-history')}
            accessibilityRole="button"
            accessibilityLabel="View past reviews"
            style={{ height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}
          >
            <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 16 }}>View past reviews</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
