import { View, ActivityIndicator } from 'react-native';
import { Redirect, useRootNavigationState } from 'expo-router';
import { getSetting } from '@/db';
import { Colors } from '@/constants/design';

export default function Index() {
  const rootNavigationState = useRootNavigationState();

  if (!rootNavigationState?.key) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.backgroundPrimary }}>
        <ActivityIndicator size="large" color={Colors.accentBlue} />
      </View>
    );
  }

  const v = getSetting('hasCompletedOnboarding');
  if (v === '1') {
    return <Redirect href="/(tabs)/today" />;
  }
  return <Redirect href="/onboarding" />;
}
