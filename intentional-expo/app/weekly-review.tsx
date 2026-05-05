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
import { Colors, FontFamily, Radius, Surface } from '@/constants/design';

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
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: bottomPad }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <View className="flex-row items-start gap-3 mb-6">
            <Pressable onPress={handleBack} hitSlop={12}>
              <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
            </Pressable>
            <View className="flex-1">
              <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
                Week of {mondayLabel(weekStart)}
              </Text>
              <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.display, fontSize: 44, lineHeight: 46, marginTop: 4 }}>
                Account for the week.
              </Text>
            </View>
          </View>

          {saved ? (
            <View className="p-4 mb-6 flex-row items-center gap-3" style={{ backgroundColor: 'rgba(46,125,87,0.12)', borderWidth: 1, borderColor: 'rgba(46,125,87,0.25)', borderRadius: Radius.lg }}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.accentSuccess} />
              <Text style={{ color: Colors.textPrimary, fontFamily: FontFamily.body, fontSize: 16, flex: 1 }}>Review saved. See you next Sunday.</Text>
            </View>
          ) : null}

          {PROMPTS.map((p) => (
            <View key={p.key} className="mb-5">
              <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.monoSemiBold, fontSize: 11, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
                {p.label}
              </Text>
              <TextInput
                value={fields[p.key]}
                onChangeText={(v) => { setSaved(false); setFields((f) => ({ ...f, [p.key]: v })); }}
                placeholder={p.placeholder}
                placeholderTextColor={Colors.textGhost}
                multiline
                textAlignVertical="top"
                className="px-4 py-3"
                style={{
                  backgroundColor: Surface.surface,
                  borderWidth: 1,
                  borderColor: Surface.rule,
                  borderRadius: Radius.lg,
                  color: Colors.textPrimary,
                  fontFamily: FontFamily.body,
                  fontSize: 17,
                  lineHeight: 24,
                  minHeight: 112,
                }}
              />
            </View>
          ))}

          <Pressable
            onPress={handleSave}
            className="py-4 items-center mt-2"
            style={{ backgroundColor: Surface.ink, borderRadius: Radius.full }}
          >
            <Text style={{ color: Surface.surface, fontFamily: FontFamily.monoSemiBold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              {saved ? 'Saved' : 'Save Review'}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.push('./reviews-history')} className="py-4 items-center mt-1">
            <Text style={{ color: Colors.textSecondary, fontFamily: FontFamily.bodySemiBold, fontSize: 16 }}>View past reviews</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
