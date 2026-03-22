import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { setSetting } from '@/db';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { Colors } from '@/constants/design';
import { shadows } from '@/styles/shadows';

function tabBarOverlapPadding(insetsBottom: number) {
  return 56 + Math.max(insetsBottom, 6) + 8 + 10;
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>([]);

  const load = useCallback(() => {
    setSelected(api.getBlockedCategoryIds());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      api.setBlockedCategoryIds(next);
      return api.getBlockedCategoryIds();
    });
  };

  const bottomPad = tabBarOverlapPadding(insets.bottom) + 16;

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <Stack.Screen options={{ title: 'Settings', headerShadowVisible: false }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: bottomPad }}>
        <Text className="text-title2 font-bold text-text-primary mb-1">Settings</Text>
        <Text className="text-footnote text-text-tertiary mb-6">Focus & blocking preferences</Text>

        <Text className="text-footnote uppercase tracking-wider text-text-tertiary mb-2">Blocked app categories</Text>
        <Text className="text-caption text-text-secondary mb-4 leading-5">
          When this is wired to Apple&apos;s <Text className="font-semibold text-text-primary">Screen Time / FamilyControls</Text> on
          a real iOS build, you don&apos;t tag apps yourself:{' '}
          <Text className="font-semibold text-text-primary">iOS classifies each app</Text> (using App Store category and system
          metadata). You only choose buckets like Games or Social; the OS blocks apps it has placed in those buckets. Intentional
          stores your choices now so they can drive shields later; Expo Go cannot access that OS layer.
        </Text>

        <View className="bg-bg-secondary rounded-xl border border-separator overflow-hidden mb-6" style={shadows.card}>
          {api.BLOCKABLE_APP_CATEGORIES.map((cat, idx) => {
            const on = selected.includes(cat.id);
            return (
              <Pressable
                key={cat.id}
                onPress={() => toggle(cat.id)}
                className={`flex-row items-center justify-between px-4 py-3.5 ${idx > 0 ? 'border-t border-separator' : ''}`}
              >
                <Text className="text-body text-text-primary flex-1 pr-3">{cat.label}</Text>
                <View
                  className="w-7 h-7 rounded-full items-center justify-center border-2"
                  style={{
                    borderColor: on ? Colors.accentSuccess : Colors.separator,
                    backgroundColor: on ? 'rgba(34,197,94,0.12)' : 'transparent',
                  }}
                >
                  {on ? <Ionicons name="checkmark" size={18} color={Colors.accentSuccess} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View className="flex-row items-start gap-2 bg-bg-tertiary rounded-lg p-3 border border-separator mb-8">
          <Ionicons name="information-circle-outline" size={20} color={Colors.textTertiary} style={{ marginTop: 1 }} />
          <Text className="text-caption text-text-secondary flex-1 leading-5">
            Currently blocking <Text className="font-semibold text-text-primary">{selected.length}</Text> categories (preference).
            Next session start reads this list for in-app messaging; OS-level blocking is not available in this build.
          </Text>
        </View>

        <Text className="text-footnote uppercase tracking-wider text-text-tertiary mb-2">Onboarding</Text>
        <Text className="text-caption text-text-secondary mb-3 leading-5">
          After you finish setup once, the app saves that in the database and opens <Text className="font-semibold">Today</Text>{' '}
          on launch. Use below only if you want to see the welcome flow again (your goals and sessions stay).
        </Text>
        <Pressable
          onPress={() =>
            Alert.alert(
              'Show onboarding again?',
              'Your SQLite data (goals, sessions) is kept. Only the “onboarding complete” flag is cleared.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Continue',
                  style: 'destructive',
                  onPress: () => {
                    setSetting('hasCompletedOnboarding', '0');
                    router.replace('/');
                  },
                },
              ]
            )
          }
          className="py-3 px-4 rounded-xl border border-separator bg-bg-secondary items-center"
          style={shadows.card}
        >
          <Text className="text-subheadline font-semibold text-accent-danger">Replay onboarding</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
