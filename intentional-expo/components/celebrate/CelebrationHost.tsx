/**
 * US-079: the full-screen moment when Flick reaches a new stage ("Flick is now a Torch. 50 hours given to the life you chose.").
 *
 * Mounted once in the root layout, over every screen. It checks at start, when the app comes back, and whenever a session
 * is saved (`requestCelebrationCheck`). Each stage fires once (`api.checkStageUp`). Confetti, a heavy thud then the
 * success buzz, Flick at the new stage, the line typed out. Continue closes it; nothing else is asked of the person.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '@/db/api';
import { Mascot } from '@/components/onboarding/Mascot';
import { Confetti } from '@/components/onboarding/FlickScenes';
import { CTA } from '@/components/onboarding/parts';
import { TypeLine } from '@/components/ui/TypeLine';
import { FontFamily, Surface, Type } from '@/constants/design';
import { STAGES, stageLine, type stageFor } from '@/services/lifeLedger';
import { onCelebrationCheck } from '@/services/celebrations';
import { hapticHeavy, hapticSuccess } from '@/utils/haptics';

type Stage = ReturnType<typeof stageFor>;

export function CelebrationHost() {
  const [stage, setStage] = useState<Stage | null>(null);
  const [typed, setTyped] = useState(false);
  const { width, height } = useWindowDimensions();

  const check = useCallback(() => {
    // Never over onboarding: the first hours are celebrated by the onboarding itself.
    if (api.getSetting('hasCompletedOnboarding') !== '1') return;
    const up = api.checkStageUp();
    if (!up) return;
    setTyped(false);
    setStage(up);
    hapticHeavy();
    setTimeout(hapticSuccess, 180);
  }, []);

  useEffect(() => {
    const t = setTimeout(check, 600);
    const off = onCelebrationCheck(() => setTimeout(check, 250));
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      clearTimeout(t);
      off();
      sub.remove();
    };
  }, [check]);

  if (!stage) return null;
  const hours = STAGES[stage.index]!.hours;

  return (
    <View
      accessibilityViewIsModal
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000, backgroundColor: Surface.canvas }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <Text style={{ ...Type.eyebrow, textAlign: 'center' }}>New stage · {hours.toLocaleString('en-US')} hours</Text>
          <View style={{ marginTop: 18, marginBottom: 10 }} accessible accessibilityLabel={`Flick, now a ${stage.name}`}>
            <Mascot mood="proud" size={210} intensity={1} stage={stage.index} />
          </View>
          <TypeLine
            key={stage.name}
            text={stageLine(stage)}
            onDone={() => setTyped(true)}
            style={{ ...Type.title, fontSize: 30, lineHeight: 37, textAlign: 'center' }}
          />
          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Surface.muted, textAlign: 'center', marginTop: 14, opacity: typed ? 1 : 0 }}>
            {stage.next ? `Next: ${stage.next.name} at ${stage.next.hours.toLocaleString('en-US')} hours.` : 'The brightest stage. Every hour still counts.'}
          </Text>
        </View>
        <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
          <CTA label="Continue" onPress={() => setStage(null)} />
        </View>
      </SafeAreaView>
      <Confetti key={stage.name} width={width} height={height} />
    </View>
  );
}
