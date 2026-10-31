/**
 * Accountability partner: one person who sees your week.
 *
 * Choose them (name, optional number) → send the invite → every Sunday send your week (card + text).
 * The partner needs nothing: no app, no account. The app keeps the partner and which weeks were sent.
 */
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import { CTA } from '@/components/onboarding/parts';
import { Mascot } from '@/components/onboarding/Mascot';
import { PressableScale } from '@/components/ui/motion';
import { WeekShareSheet } from '@/components/share/WeekShareSheet';
import { Accent, FontFamily, Radius, Surface, Type, hexToRgba } from '@/constants/design';
import {
  getPartner,
  getSentWeeks,
  inviteMessage,
  markInvited,
  nextReportLabel,
  removePartner,
  reportWeek,
  savePartner,
  sentStreak,
  sinceLabel,
  type Partner,
} from '@/services/partner';
import { weekLabel, weekStartOf } from '@/services/weekSummary';
import { confirmAsync } from '@/utils/confirm';
import { hapticSuccess } from '@/utils/haptics';
import { openSms, shareText } from '@/utils/shareCard';
import { localDayKey, shiftDayKey } from '@/utils/dates';
import { syncHabits } from '@/services/habitSync';

const inputStyle = {
  backgroundColor: Surface.surfaceRaised,
  borderRadius: 16,
  paddingHorizontal: 16,
  height: 54,
  color: Surface.ink,
  fontFamily: FontFamily.bodySemiBold,
  fontSize: 17,
} as const;

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Surface.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name="chevron-back" size={22} color={Surface.ink} />
    </Pressable>
  );
}

function PartnerForm({ initial, onSaved, onCancel }: { initial?: Partner | null; onSaved: (p: Partner) => void; onCancel?: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    try {
      const p = savePartner({ name, phone });
      void syncHabits(); // the Sunday reminder names the partner
      setError(null);
      hapticSuccess();
      onSaved(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  };
  return (
    <View>
      <Text style={{ ...Type.heading, marginBottom: 8 }}>Their first name</Text>
      <TextInput
        value={name}
        onChangeText={(v) => {
          setName(v);
          if (error) setError(null);
        }}
        placeholder="e.g. Sam"
        placeholderTextColor={Surface.faint}
        accessibilityLabel="Partner name"
        maxLength={30}
        autoCapitalize="words"
        returnKeyType="next"
        style={inputStyle}
      />
      <Text style={{ ...Type.heading, marginTop: 18, marginBottom: 4 }}>Their phone number</Text>
      <Text style={{ ...Type.meta, marginBottom: 8 }}>Optional. For a one-tap text on Sunday. It stays on this phone.</Text>
      <TextInput
        value={phone ?? ''}
        onChangeText={setPhone}
        placeholder="+33 6 12 34 56 78"
        placeholderTextColor={Surface.faint}
        accessibilityLabel="Partner phone number"
        keyboardType="phone-pad"
        maxLength={22}
        style={inputStyle}
      />
      {error ? <Text style={{ ...Type.meta, color: Accent.amber, marginTop: 10 }}>{error}</Text> : null}
      <View style={{ marginTop: 22 }}>
        <CTA label={name.trim() ? (initial ? 'Save' : `Choose ${name.trim()}`) : 'Choose your partner'} disabled={!name.trim()} onPress={save} />
      </View>
      {onCancel ? (
        <PressableScale onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel" style={{ height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
          <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: Surface.muted }}>Cancel</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** The last 8 weeks as dots: sent (ink) / not sent (outline) / this week still open (dashed). */
function WeekDots({ sent, now }: { sent: Set<string>; now: Date }) {
  const latest = reportWeek(now).weekStart;
  const weeks = Array.from({ length: 8 }, (_, i) => shiftDayKey(latest, -7 * (7 - i)));
  const current = weekStartOf(localDayKey(now));
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }} accessible accessibilityLabel={`Sent ${weeks.filter((w) => sent.has(w)).length} of the last 8 weeks`}>
      {weeks.map((w) => {
        const on = sent.has(w);
        const open = w === latest && !on && w === current;
        return (
          <View key={w} style={{ alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: on ? Surface.ink : 'transparent',
                borderWidth: on ? 0 : 2,
                borderStyle: open ? 'dashed' : 'solid',
                borderColor: Surface.ruleStrong,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {on ? <Ionicons name="checkmark" size={15} color={Surface.surface} /> : null}
            </View>
            <Text style={{ fontFamily: FontFamily.bodySemiBold, fontSize: 10, color: Surface.faint }}>{weekLabel(w).split(' – ')[0]}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function PartnerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ send?: string }>();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [sentWeeks, setSentWeeks] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [justChosen, setJustChosen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareWeek, setShareWeek] = useState<string | undefined>(undefined);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [pillars, setPillars] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const userName = api.getSetting('user_name')?.trim() || undefined;
  const now = new Date();

  const load = useCallback(() => {
    const p = getPartner();
    setPartner(p);
    setSentWeeks(getSentWeeks());
    void api.getGoals().then(async (list) => {
      setPillars(list.map((g) => g.name));
      const titles: string[] = [];
      for (const g of list) {
        const o = await api.getActiveObjective(g.id);
        if (o) titles.push(o.title);
      }
      setGoals(titles.slice(0, 2));
    });
    return p;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const p = load();
      if (p && params.send === '1') {
        setShareWeek(reportWeek().weekStart);
        setShareOpen(true);
        router.setParams({ send: undefined });
      }
    }, [load, params.send, router])
  );

  const sent = useMemo(() => new Set(sentWeeks), [sentWeeks]);
  const report = reportWeek(now);
  const reportSent = sent.has(report.weekStart);
  const streak = sentStreak(sentWeeks, now);
  const invite = partner ? inviteMessage({ userName, partnerName: partner.name, pillars, goals }) : '';

  const sendInvite = async (via: 'share' | 'sms') => {
    if (!partner) return;
    const ok = via === 'sms' && partner.phone ? await openSms(partner.phone, invite) : (await shareText(invite, 'My accountability partner')) !== 'dismissed';
    if (ok) {
      markInvited();
      hapticSuccess();
      setInviteStatus(via === 'sms' ? 'Messages opened. Hit send.' : 'Invite ready to send.');
      load();
    }
  };

  const end = async () => {
    if (!partner) return;
    const yes = await confirmAsync({
      title: `End your partnership with ${partner.name}?`,
      message: 'Your sent history stays. You can choose someone again anytime.',
      confirmLabel: 'End partnership',
    });
    if (!yes) return;
    removePartner();
    void syncHabits();
    setEditing(false);
    setJustChosen(false);
    load();
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/today'));

  const openShare = (weekStart: string) => {
    setShareWeek(weekStart);
    setShareOpen(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Surface.canvas }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <BackButton onPress={back} />

          {!partner || editing ? (
            <>
              {!partner ? (
                <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 24 }}>
                  <Mascot mood="wave" size={110} intensity={0.7} />
                  <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center', marginTop: 12 }}>
                    One person who sees your week
                  </Text>
                  <Text style={{ ...Type.body, fontSize: 17, lineHeight: 24, textAlign: 'center', marginTop: 8 }}>
                    Telling someone you respect what you're working on makes you far more likely to follow through. Pick one person. Every Sunday you send
                    them your week. They don't need the app.
                  </Text>
                  <View style={{ alignSelf: 'stretch', marginTop: 18, gap: 10 }}>
                    {[
                      ['person-outline', 'Someone who will actually ask'] as const,
                      ['calendar-outline', 'Your card + a short text, every Sunday'] as const,
                      ['eye-off-outline', 'Hours only. Never task names or notes'] as const,
                    ].map(([icon, text]) => (
                      <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Accent.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={icon} size={17} color={Accent.blue} />
                        </View>
                        <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: Surface.ink }}>{text}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <Text accessibilityRole="header" style={{ ...Type.title, marginTop: 16, marginBottom: 18 }}>
                  Edit your partner
                </Text>
              )}
              <PartnerForm
                initial={editing ? partner : null}
                onSaved={(p) => {
                  if (!editing) setJustChosen(true);
                  setEditing(false);
                  setPartner(p);
                  load();
                }}
                onCancel={editing ? () => setEditing(false) : undefined}
              />
            </>
          ) : (
            <>
              {/* Who */}
              <View style={{ alignItems: 'center', marginTop: 4 }}>
                <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: Accent.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 36, color: Accent.blue }}>{partner.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <Text accessibilityRole="header" style={{ ...Type.title, textAlign: 'center', marginTop: 12 }}>
                  {partner.name} sees your week
                </Text>
                <Text style={{ ...Type.meta, fontSize: 14, marginTop: 4 }}>
                  {sinceLabel(partner.since)}
                  {streak > 0 ? ` · Sent ${streak} ${streak === 1 ? 'week' : 'weeks'} in a row` : ''}
                </Text>
              </View>

              {/* Invite */}
              {!partner.invitedAt || justChosen ? (
                <View style={{ marginTop: 22, backgroundColor: Surface.surfaceRaised, borderRadius: Radius.lg, padding: 16 }}>
                  <Text style={{ ...Type.heading, fontSize: 18 }}>{partner.invitedAt ? 'Invite sent' : `Tell ${partner.name}`}</Text>
                  <Text style={{ ...Type.meta, fontSize: 14, marginTop: 2 }}>
                    {partner.invitedAt ? 'You can send it again if they missed it.' : 'A partner only works if they know. Here is what they will get:'}
                  </Text>
                  <View style={{ marginTop: 12, backgroundColor: Surface.surface, borderRadius: 14, padding: 14 }}>
                    <Text testID="invite-preview" style={{ fontFamily: FontFamily.body, fontSize: 15, lineHeight: 21, color: Surface.ink }}>
                      {invite}
                    </Text>
                  </View>
                  <View style={{ marginTop: 14 }}>
                    <CTA label={partner.invitedAt ? 'Send the invite again' : 'Send the invite'} onPress={() => void sendInvite('share')} />
                  </View>
                  {partner.phone ? (
                    <PressableScale
                      onPress={() => void sendInvite('sms')}
                      accessibilityRole="button"
                      accessibilityLabel={`Text the invite to ${partner.name}`}
                      style={{ height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}
                    >
                      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 16, color: Surface.ink }}>Text it to {partner.name}</Text>
                    </PressableScale>
                  ) : null}
                  {inviteStatus ? <Text style={{ ...Type.accent, textAlign: 'center', marginTop: 6 }}>{inviteStatus}</Text> : null}
                </View>
              ) : null}

              {/* This week's report */}
              <View style={{ marginTop: 16, backgroundColor: report.due && !reportSent ? hexToRgba(Accent.blue, 0.08) : Surface.surfaceRaised, borderRadius: Radius.lg, padding: 16 }}>
                {reportSent ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="checkmark-circle" size={22} color={Accent.green} />
                      <Text style={{ ...Type.heading, fontSize: 18, flex: 1 }}>Week of {weekLabel(report.weekStart)} sent</Text>
                    </View>
                    <Text style={{ ...Type.meta, fontSize: 14, marginTop: 4 }}>Next report: {nextReportLabel(new Date(now.getTime() + (now.getDay() === 0 ? 864e5 : 0)))}</Text>
                  </>
                ) : report.due ? (
                  <>
                    <Text style={{ ...Type.heading, fontSize: 18 }}>Your week is ready</Text>
                    <Text style={{ ...Type.meta, fontSize: 14, marginTop: 2 }}>
                      {weekLabel(report.weekStart)}. {partner.name} is waiting for it.
                    </Text>
                    <View style={{ marginTop: 14 }}>
                      <CTA label={`Send your week to ${partner.name}`} onPress={() => openShare(report.weekStart)} />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={{ ...Type.heading, fontSize: 18 }}>Next report: {nextReportLabel(now)}</Text>
                    <Text style={{ ...Type.meta, fontSize: 14, marginTop: 2 }}>On Sunday your week will be ready to send.</Text>
                    <PressableScale
                      onPress={() => openShare(weekStartOf(localDayKey(now)))}
                      accessibilityRole="button"
                      accessibilityLabel="Send this week so far"
                      style={{ alignSelf: 'flex-start', marginTop: 12, height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: Surface.surface, justifyContent: 'center' }}
                    >
                      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: Surface.ink }}>Send this week so far</Text>
                    </PressableScale>
                  </>
                )}
              </View>

              {/* History */}
              <View style={{ marginTop: 16, backgroundColor: Surface.surfaceRaised, borderRadius: Radius.lg, padding: 16 }}>
                <Text style={{ ...Type.heading, fontSize: 17 }}>Last 8 weeks</Text>
                <WeekDots sent={sent} now={now} />
              </View>

              {/* Manage */}
              <View style={{ marginTop: 16, backgroundColor: Surface.surfaceRaised, borderRadius: Radius.lg, overflow: 'hidden' }}>
                <PressableScale
                  onPress={() => setEditing(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit partner"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16 }}
                >
                  <Ionicons name="create-outline" size={20} color={Surface.ink} />
                  <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: Surface.ink }}>Edit name or number</Text>
                  <Ionicons name="chevron-forward" size={18} color={Surface.faint} />
                </PressableScale>
                {partner.invitedAt && !justChosen ? (
                  <>
                    <View style={{ height: 1, backgroundColor: Surface.rule, marginLeft: 48 }} />
                    <PressableScale
                      onPress={() => setJustChosen(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Send the invite again"
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16 }}
                    >
                      <Ionicons name="paper-plane-outline" size={20} color={Surface.ink} />
                      <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: Surface.ink }}>Send the invite again</Text>
                      <Ionicons name="chevron-forward" size={18} color={Surface.faint} />
                    </PressableScale>
                  </>
                ) : null}
                <View style={{ height: 1, backgroundColor: Surface.rule, marginLeft: 48 }} />
                <PressableScale
                  onPress={() => void end()}
                  accessibilityRole="button"
                  accessibilityLabel="End partnership"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16 }}
                >
                  <Ionicons name="person-remove-outline" size={20} color={Surface.muted} />
                  <Text style={{ flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: Surface.muted }}>End partnership</Text>
                </PressableScale>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <WeekShareSheet
        visible={shareOpen}
        weekStart={shareWeek}
        onClose={() => setShareOpen(false)}
        onSent={() => {
          setSentWeeks(getSentWeeks());
        }}
      />
    </SafeAreaView>
  );
}
