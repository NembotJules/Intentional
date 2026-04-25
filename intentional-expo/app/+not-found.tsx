import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Radius, Surface } from '@/constants/design';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.container}>
        <Text style={styles.eyebrow}>Missing route</Text>
        <Text style={styles.title}>This page is not in the ledger.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Return home</Text>
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
    padding: 20,
    backgroundColor: Surface.canvas,
  },
  eyebrow: {
    color: Colors.textMuted,
    fontFamily: FontFamily.monoSemiBold,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.textPrimary,
    fontFamily: FontFamily.display,
    fontSize: 42,
    lineHeight: 44,
    textAlign: 'center',
  },
  link: {
    marginTop: 24,
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: Surface.ink,
    borderRadius: Radius.full,
  },
  linkText: {
    fontSize: 11,
    color: Surface.surface,
    fontFamily: FontFamily.monoSemiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
