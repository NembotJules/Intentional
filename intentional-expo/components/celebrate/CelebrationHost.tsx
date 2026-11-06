/**
 * Full-screen celebrations, mounted once in the root layout over every screen:
 *   - US-079: Flick reaches a new stage ("Flick is now a Torch. 50 hours given to the life you chose.")
 *   - US-080: a milestone (100 hours to Body, a week with every habit kept, 4 weeks with every pillar), with Share.
 *
 * It checks at start, when the app comes back, and whenever a session is saved or a goal achieved
 * (`requestCelebrationCheck`). Each one fires once (`api.checkStageUp`, `api.checkMilestones`); several at once queue up,
 * the stage first. Confetti, a heavy thud then the success buzz, Flick, the line typed out. Continue closes it.
 *
 * US-101: a stage-up is a full-colour screen in its stage's colour (services/celebrations.stageCelebrationColor),
 * Flick big in his new look. Right after it, the world that stage earns (services/worldUnlocks): "New world
 * unlocked!", a preview, "Try it" (Flick moves there) or "Later". Worlds are earned with hours, so they come only
 * with a stage-up, never on their own.
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
import { celebrationsHeld, onCelebrationCheck, stageCelebrationColor } from '@/services/celebrations';
import { worldForStageHours } from '@/services/worldUnlocks';
import { worldTheme } from '@/services/worldThemes';
import { setSelectedWorld } from '@/services/worldChoice';
import { WorldPreview } from '@/components/world/WorldPreview';
import { PillButton } from '@/components/ui/kit';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { getPartner } from '@/services/partner';
import { getGoalColor } from '@/utils/goalColors';
import { hapticHeavy, hapticSuccess } from '@/utils/haptics';

type Item = { type: 'stage'; stage: ReturnType<typeof stageFor> } | { type: 'world'; id: string } | { type: 'milestone'; milestone: Milestone };

export function CelebrationHost() {
  const [queue, setQueue] = useState<Item[]>([]);
  const [typed, setTyped] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { width, height } = useWindowDimensions();

  const check = useCallback(() => {
    // Never over onboarding: the first hours are celebrated by the onboarding itself.
    if (api.getSetting('hasCompletedOnboarding') !== '1') return;
    // US-084: the end-of-session reward is playing; it releases (and re-checks) when done.
    if (celebrationsHeld()) return;
    const items: Item[] = [];
    const up = api.checkStageUp();
    if (up) {
      items.push({ type: 'stage', stage: up });
      // US-101: the world this stage earns, right after it.
      const world = worldForStageHours(STAGES[up.index]!.hours);
      if (world) items.push({ type: 'world', id: world });
    }
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

  const flickNow = api.getFlickState();
  const next = () => {
    setShareOpen(false);
    setTyped(false);
    if (queue.length > 1) {
      hapticHeavy();
      setTimeout(hapticSuccess, 180);
    }
    setQueue((q) => q.slice(1));
  };

  // US-101: a new world, earned with this stage.
  if (item.type === 'world') {
    const theme = worldTheme(item.id);
    const pw = Math.min(width, 440) - 48;
    return (
      <View
        accessibilityViewIsModal
        style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000, backgroundColor: theme.celebrate }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
            <Text style={{ ...Type.eyebrow, color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>Earned with your hours</Text>
            <Animated.Text
              entering={ZoomIn.springify().damping(12)}
              accessibilityRole="header"
              style={{ ...Type.displayXL, fontSize: 40, lineHeight: 46, color: '#FFFFFF', textAlign: 'center', marginTop: 8 }}
            >
              New world unlocked!
            </Animated.Text>
            <Animated.View entering={ZoomIn.delay(180).springify().damping(14)} style={{ marginTop: 22, borderRadius: 26, padding: 6, backgroundColor: 'rgba(255,255,255,0.22)' }}>
              <WorldPreview themeId={item.id} width={pw - 12} height={Math.round((pw - 12) * 0.62)} stage={flickNow.stage.index} />
            </Animated.View>
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 24, color: '#FFFFFF', marginTop: 18, textAlign: 'center' }}>{theme.name}</Text>
            <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: 'rgba(255,255,255,0.88)', marginTop: 4, textAlign: 'center' }}>{theme.tagline}</Text>
          </View>
          <View style={{ paddingHorizontal: 24, paddingBottom: 16, gap: 10, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
            <PillButton
              size="lg"
              variant="inverse"
              label="Try it"
              onPress={() => {
                setSelectedWorld(item.id);
                next();
              }}
            />
            <PillButton size="md" variant="secondary" label="Later" onPress={next} style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
          </View>
        </SafeAreaView>
        <Confetti key={`world-${item.id}`} width={width} height={height} />
      </View>
    );
  }

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

  // US-101: a stage-up is full colour, white type; milestones keep the calm canvas.
  const bold = item.type === 'stage';
  const fg = bold ? '#FFFFFF' : Surface.ink;
  return (
    <View
      accessibilityViewIsModal
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000, backgroundColor: bold ? stageCelebrationColor(stageIndex) : Surface.canvas }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <Text style={{ ...Type.eyebrow, textAlign: 'center', color: bold ? 'rgba(255,255,255,0.85)' : Type.eyebrow.color }}>{eyebrow}</Text>
          <View style={{ marginTop: 18, marginBottom: 10, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityLabel={`Flick, a ${STAGES[stageIndex]!.name}, celebrating`}>
            {bold ? <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(255,255,255,0.16)' }} /> : null}
            <Mascot mood="proud" size={bold ? 240 : 210} intensity={1} stage={stageIndex} />
          </View>
          <TypeLine
            key={key}
            text={line}
            onDone={() => setTyped(true)}
            style={{ ...(bold ? Type.display : Type.title), fontSize: bold ? 32 : 30, lineHeight: bold ? 39 : 37, textAlign: 'center', color: fg }}
          />
          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: bold ? 'rgba(255,255,255,0.88)' : Surface.muted, textAlign: 'center', marginTop: 14, opacity: typed ? 1 : 0 }}>{sub}</Text>
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
          {bold ? (
            <PillButton size="lg" variant="inverse" label={queue.length > 1 ? 'Next' : 'Continue'} onPress={next} />
          ) : (
            <CTA label={queue.length > 1 ? 'Next' : 'Continue'} onPress={next} />
          )}
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
