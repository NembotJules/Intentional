import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getSetting } from '@/db';
import { Colors } from '@/constants/design';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const v = getSetting('hasCompletedOnboarding');
    if (v === '1') {
      router.replace('/(tabs)/today');
    } else {
      router.replace('/onboarding');
    }
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.backgroundPrimary }}>
      <ActivityIndicator size="large" color={Colors.accentBlue} />
    </View>
  );
}
