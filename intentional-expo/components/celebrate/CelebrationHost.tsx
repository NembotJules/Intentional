/**
 * Full-screen celebrations, mounted once in the root layout over every screen:
 *   - US-079: Flick reaches a new stage ("Flick is now a Torch. 50 hours given to the life you chose.")
 *   - US-080: a milestone (100 hours to Body, a week with every habit kept, 4 weeks with every pillar), with Share.
 *
 * It checks at start, when the app comes back, and whenever a session is saved or a goal achieved
 * (`requestCelebrationCheck`). Each one fires once (`api.checkStageUp`, `api.checkMilestones`); several at once queue up,
 * the stage first. Confetti, a heavy thud then the success buzz, Flick, the line typed out. Continue closes it.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { Mascot } from '@/components/onboarding/Mascot';
import { Confetti } from '@/components/onboarding/FlickScenes';
import { CTA } from '@/components/onboarding/parts';
import { PressableScale } from '@/components/ui/motion';
import { TypeLine } from '@/components/ui/TypeLine';
import { ShareCardSheet } from '@/components/share/ShareCardSheet';
import { MILESTONE_CARD_H, MILESTONE_CARD_W, MilestoneCard, type MilestoneCardData } from '@/components/share/MilestoneCard';
import { FontFamily, Radius, Surface, Type } from '@/constants/design';
import { STAGES, stageLine, type stageFor } from '@/services/lifeLedger';
import { celebrates, milestoneCopy, type Milestone } from '@/services/milestones';
import { onCelebrationCheck } from '@/services/celebrations';
import { getPartner } from '@/services/partner';
import { getGoalColor } from '@/utils/goalColors';
import { hapticHeavy, hapticSuccess } from '@/utils/haptics';

type Item = { type: 'stage'; stage: ReturnType<typeof stageFor> } | { type: 'milestone'; milestone: Milestone };

export function CelebrationHost() {
  const [queue, setQueue] = useState<Item[]>([]);
  const [typed, setTyped] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { width, height } = useWindowDimensions();

  const check = useCallback(() => {
    // Never over onboarding: the first hours are celebrated by the onboarding itself.
    if (api.getSetting('hasCompletedOnboarding') !== '1') return;
    const items: Item[] = [];
    const up = api.checkStageUp();
    if (up) items.push({ type: 'stage', stage: up });
    for (const m of api.checkMilestones().filter(celebrates)) items.push({ type: 'milestone', milestone: m });
    if (!items.length) return;
    setQueue((q) => {
      if (!q.length) {
        setTyped(false);
        hapticHeavy();
        setTimeout(hapticSuccess, 180);
      }
      return [...q, ...items];
    });
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

  const item = queue[0];
  if (!item) return null;

  const next = () => {
    setShareOpen(false);
    setTyped(false);
    if (queue.length > 1) {
      hapticHeavy();
      setTimeout(hapticSuccess, 180);
    }
    setQueue((q) => q.slice(1));
  };

  const pillars = new Map(api.getAllPillarsSync().map((p) => [p.id, p]));
  const flick = api.getFlickState();
  let eyebrow: string;
  let line: string;
  let sub: string;
  let card: MilestoneCardData | null = null;
  let message = '';
  let stageIndex = flick.stage.index;
  if (item.type === 'stage') {
    const hours = STAGES[item.stage.index]!.hours;
    stageIndex = item.stage.index;
    eyebrow = `New stage · ${hours.toLocaleString('en-US')} hours`;
    line = stageLine(item.stage);
    sub = item.stage.next ? `Next: ${item.stage.next.name} at ${item.stage.next.hours.toLocaleString('en-US')} hours.` : 'The brightest stage. Every hour still counts.';
  } else {
    const m = item.milestone;
    const p = m.kind === 'pillar_hours' && m.ref_id ? pillars.get(m.ref_id) ?? null : null;
    const copy = milestoneCopy(m, (id) => pillars.get(id)?.name ?? null);
    eyebrow = 'Milestone';
    line = copy.title;
    sub = copy.sub;
    message = copy.share;
    card = {
      big: copy.big,
      title: copy.title,
      pillar: p ? { name: p.name, icon: p.icon, color: getGoalColor(p) } : null,
      achievedOn: new Date(m.achieved_at),
      stage: flick.stage.index,
      userName: api.getSetting('user_name')?.trim() || undefined,
    };
  }
  const key = item.type === 'stage' ? `stage-${item.stage.index}` : `m-${item.milestone.kind}-${item.milestone.ref_id ?? ''}-${item.milestone.value}`;

  return (
    <View
      accessibilityViewIsModal
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000, backgroundColor: Surface.canvas }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <Text style={{ ...Type.eyebrow, textAlign: 'center' }}>{eyebrow}</Text>
          <View style={{ marginTop: 18, marginBottom: 10 }} accessible accessibilityLabel={`Flick, a ${STAGES[stageIndex]!.name}, celebrating`}>
            <Mascot mood="proud" size={210} intensity={1} stage={stageIndex} />
          </View>
          <TypeLine key={key} text={line} onDone={() => setTyped(true)} style={{ ...Type.title, fontSize: 30, lineHeight: 37, textAlign: 'center' }} />
          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Surface.muted, textAlign: 'center', marginTop: 14, opacity: typed ? 1 : 0 }}>{sub}</Text>
        </View>
        <View style={{ paddingHorizontal: 24, paddingBottom: 16, gap: 10 }}>
          {card ? (
            <PressableScale
              onPress={() => setShareOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Share this milestone"
              style={{ height: 52, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Surface.ruleStrong, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="share-outline" size={18} color={Surface.ink} />
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>Share</Text>
            </PressableScale>
          ) : null}
          <CTA label={queue.length > 1 ? 'Next' : 'Continue'} onPress={next} />
        </View>
      </SafeAreaView>
      <Confetti key={key} width={width} height={height} />
      {card ? (
        <ShareCardSheet
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
          title="Share this milestone"
          sub="Hours only. No task names."
          cardWidth={MILESTONE_CARD_W}
          cardHeight={MILESTONE_CARD_H}
          renderCard={(theme) => <MilestoneCard data={card!} theme={theme} />}
          message={message}
          partner={getPartner()}
          onSent={() => setShareOpen(false)}
        />
      ) : null}
    </View>
  );
}
