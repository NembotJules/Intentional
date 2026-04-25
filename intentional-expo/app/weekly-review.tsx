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
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { Colors, Surface } from '@/constants/design';
import { shadows } from '@/styles/shadows';

const PROMPTS = [
  {
    key: 'went_well' as const,
    label: 'What went well?',
    placeholder: 'Describe your wins, no matter how small…',
  },
  {
    key: 'improve' as const,
    label: 'What would I improve?',
    placeholder: 'Be honest — what would you do differently?',
  },
  {
    key: 'adjustments' as const,
    label: 'Goal adjustments for next week?',
    placeholder: 'Any priorities to shift, drop, or double down on?',
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
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: bottomPad }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="flex-row items-center gap-3 mb-6">
            <Pressable onPress={handleBack} hitSlop={12}>
              <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
            </Pressable>
            <View className="flex-1">
              <Text className="text-title2 font-bold text-text-primary">Weekly Review</Text>
              <Text className="text-footnote text-text-tertiary">Week of {mondayLabel(weekStart)}</Text>
            </View>
          </View>

          {saved ? (
            <View className="rounded-xl p-4 mb-6 flex-row items-center gap-3" style={{ backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' }}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.accentSuccess} />
              <Text className="text-subheadline text-text-primary flex-1">Review saved. See you next Sunday.</Text>
            </View>
          ) : null}

          {PROMPTS.map((p) => (
            <View key={p.key} className="mb-5">
              <Text className="text-footnote uppercase tracking-wider text-text-tertiary mb-2">{p.label}</Text>
              <TextInput
                value={fields[p.key]}
                onChangeText={(v) => { setSaved(false); setFields((f) => ({ ...f, [p.key]: v })); }}
                placeholder={p.placeholder}
                placeholderTextColor={Colors.textLabel}
                multiline
                textAlignVertical="top"
                className="text-body text-text-primary rounded-xl px-4 py-3"
                style={[shadows.card, { backgroundColor: Surface.container, minHeight: 100 }]}
              />
            </View>
          ))}

          <Pressable
            onPress={handleSave}
            className="rounded-xl py-4 items-center mt-2"
            style={{ backgroundColor: Colors.textPrimary }}
          >
            <Text className="text-subheadline font-bold" style={{ color: Colors.textInverse }}>
              {saved ? 'Saved ✓' : 'Save Review'}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.push('./reviews-history')} className="py-4 items-center mt-1">
            <Text className="text-subheadline text-text-tertiary">View past reviews</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
