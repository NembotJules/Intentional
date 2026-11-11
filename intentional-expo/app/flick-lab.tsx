/**
 * US-127 · Flick lab (development builds only): every mood, pose and stage of the still Flick (Mascot) next to the
 * animated ones (FlickAnimated: loops and clips), to check that the two drawings match. `?solo=1` draws one big
 * waving Flick alone: the source of the app icon (scripts/render-icon.mjs).
 */
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Mascot, type MascotArms, type MascotMood } from '@/components/onboarding/Mascot';
import { FlickAnimated, type FlickMood } from '@/components/flick/FlickAnimated';
import { Camp, FontFamily } from '@/constants/design';

const MOODS: MascotMood[] = ['happy', 'wave', 'think', 'worried', 'sad', 'shock', 'calm', 'proud', 'sleepy', 'focus', 'mystery'];
const ARMS: MascotArms[] = ['down', 'wave', 'cheer', 'chin', 'hug', 'star', 'hold', 'lift'];
const LIVE: FlickMood[] = ['happy', 'calm', 'worried', 'sleepy', 'focus', 'proud', 'think', 'shock', 'meditate', 'guard', 'remind', 'watch', 'cheer', 'hourglass'];

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ width: 112, alignItems: 'center', marginBottom: 10 }} accessibilityLabel={`lab ${label}`}>
      {children}
      <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: Camp.barkSoft }}>{label}</Text>
    </View>
  );
}

export default function FlickLab() {
  const { solo } = useLocalSearchParams<{ solo?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  // ?solo=1 · one big waving Flick, alone (scripts/render-icon.mjs copies its SVG into the app icon)
  if (solo) {
    return (
      <View style={{ flex: 1, alignItems: 'flex-start', justifyContent: 'flex-start', backgroundColor: 'transparent' }} accessibilityLabel="solo Flick">
        <Mascot mood="happy" arms="wave" size={1000} bob={false} intensity={0.6} />
      </View>
    );
  }
  const section = (t: string) => <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 18, color: Camp.bark, marginVertical: 10, width: '100%' }}>{t}</Text>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Camp.canvas }}>
      <ScrollView contentContainerStyle={{ padding: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {section('Still · moods')}
        {MOODS.map((m) => (
          <Cell key={m} label={m}>
            <Mascot mood={m} size={100} bob={false} />
          </Cell>
        ))}
        {section('Still · poses')}
        {ARMS.map((a) => (
          <Cell key={a} label={a}>
            <Mascot mood="happy" arms={a} size={100} bob={false} />
          </Cell>
        ))}
        {section('Still · intensity and stages')}
        {[0.1, 0.3, 0.6, 1].map((i) => (
          <Cell key={i} label={`intensity ${i}`}>
            <Mascot size={100} bob={false} intensity={i} />
          </Cell>
        ))}
        {[0, 2, 5].map((s) => (
          <Cell key={`s${s}`} label={`stage ${s}`}>
            <Mascot size={100} bob={false} stage={s} />
          </Cell>
        ))}
        {section('Animated · loops and clips')}
        {LIVE.map((m) => (
          <Cell key={m} label={m}>
            <FlickAnimated mood={m} size={100} intensity={0.8} />
          </Cell>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
