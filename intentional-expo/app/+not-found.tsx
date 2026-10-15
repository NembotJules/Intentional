import { Link, Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontFamily, Surface } from '@/constants/design';
import { Mascot } from '@/components/onboarding/Mascot';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.container}>
        <Mascot mood="shock" size={110} intensity={0.5} />
        <Text style={styles.title}>This page doesn&apos;t exist.</Text>
        <Text style={styles.body}>Let&apos;s get you back to your day.</Text>

        <Link href="/" asChild>
          <Pressable style={styles.link} accessibilityRole="button" accessibilityLabel="Return home">
            <Text style={styles.linkText}>Return home</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Surface.canvas,
  },
  title: {
    color: Surface.ink,
    fontFamily: FontFamily.bodyBold,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
    marginTop: 18,
  },
  body: {
    color: Surface.muted,
    fontFamily: FontFamily.body,
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 6,
  },
  link: {
    marginTop: 28,
    height: 58,
    paddingHorizontal: 36,
    backgroundColor: Surface.ink,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 18,
    color: Surface.surface,
    fontFamily: FontFamily.bodyBold,
  },
});
