/**
 * US-107 · The blocker sheet: name, sticker, "All day" or a schedule, the days. Save / Delete.
 * US-112: brainrot-like proportions: a big sticker in a coloured circle with a pencil badge (opens "Choose a sticker"),
 * a grey name field, a segmented All day / Schedule, bold section heads, a blue 3D Save and a red Delete.
 * Pure UI: the parent turns the Blocker into block-hour rules (services/blockers.upsertBlocker).
 */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '@/components/ui/motion';
import { Sticker, isStickerName } from '@/components/ui/Sticker';
import { BLOCKER_STICKERS, blockerError, type Blocker } from '@/services/blockers';
import { Accent, Elevation, FontFamily, Surface, hexToRgba } from '@/constants/design';
import { PillButton, Segmented, fieldStyle } from '@/components/ui/kit';

const sectionHead = { fontFamily: FontFamily.bodyBlack, fontSize: 17, color: Surface.ink, marginTop: 22, marginBottom: 10 } as const;

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const QUICK: { label: string; mask: number }[] = [
  { label: 'Weekdays', mask: 0b0011111 },
  { label: 'Weekends', mask: 0b1100000 },
  { label: 'Every day', mask: 127 },
];

function TimeBox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: Surface.greyText, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^\d:]/g, '').slice(0, 5))}
        accessibilityLabel={label}
        placeholder="09:00"
        placeholderTextColor={Surface.faint}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        style={{ ...fieldStyle, textAlign: 'left' }}
      />
    </View>
  );
}

export function BlockerSheet({
  value,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  value: Blocker | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (b: Blocker) => void;
  onDelete: (b: Blocker) => void;
}) {
  const [b, setB] = useState<Blocker | null>(value);
  const [tried, setTried] = useState(false);
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    setB(value);
    setTried(false);
    setPicking(false);
  }, [value]);
  if (!b) return null;
  const err = blockerError(b);
  const set = (patch: Partial<Blocker>) => setB({ ...b, ...patch });
  const save = () => {
    setTried(true);
    if (err) return;
    onSave({ ...b, name: b.name.trim(), enabled: true });
  };

  return (
    <Modal visible={!!value} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: hexToRgba(Surface.ink, 0.45) }} />
        <View style={{ maxHeight: '94%', backgroundColor: Surface.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: Surface.fieldBorder, marginTop: 10 }} />
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
            {/* sticker */}
            <PressableScale
              onPress={() => setPicking((x) => !x)}
              accessibilityRole="button"
              accessibilityLabel="Change sticker"
              style={{ alignSelf: 'center', width: 116, height: 116, borderRadius: 58, backgroundColor: '#A8DDF7', alignItems: 'center', justifyContent: 'center' }}
            >
              <Sticker name={isStickerName(b.sticker) ? b.sticker : 'lock'} size={72} />
              <View style={{ position: 'absolute', right: 0, bottom: 2, width: 34, height: 34, borderRadius: 17, backgroundColor: Surface.track, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Surface.surface }}>
                <Ionicons name="pencil" size={15} color={Surface.muted} />
              </View>
            </PressableScale>
            <TextInput
              value={b.name}
              onChangeText={(name) => set({ name })}
              placeholder="Name it, like Study"
              placeholderTextColor={Surface.faint}
              accessibilityLabel="Blocker name"
              maxLength={28}
              style={{ ...fieldStyle, marginTop: 20, height: 58 }}
            />

            <View style={{ marginTop: 16 }}>
              <Segmented
                value={b.allDay ? 'all' : 'schedule'}
                options={[
                  { value: 'all', label: 'All day' },
                  { value: 'schedule', label: 'Schedule' },
                ]}
                onChange={(v) => set({ allDay: v === 'all' })}
              />
            </View>

            {!b.allDay ? (
              <>
              <Text style={sectionHead}>Timeframe</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TimeBox label="From" value={b.start} onChange={(start) => set({ start })} />
                <TimeBox label="To" value={b.end} onChange={(end) => set({ end })} />
              </View>
              </>
            ) : null}

            <Text style={sectionHead}>Active days</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {QUICK.map((q) => {
                const on = (b.days_mask & 127) === q.mask;
                return (
                  <Pressable
                    key={q.label}
                    onPress={() => set({ days_mask: q.mask })}
                    accessibilityRole="button"
                    accessibilityLabel={q.label}
                    accessibilityState={{ selected: on }}
                    style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: on ? Accent.blue : Surface.track }}
                  >
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: on ? Surface.surface : Surface.greyText }}>{q.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              {DAYS.map((d, i) => {
                const on = !!(b.days_mask & (1 << i));
                return (
                  <Pressable
                    key={i}
                    onPress={() => set({ days_mask: b.days_mask ^ (1 << i) })}
                    accessibilityRole="checkbox"
                    accessibilityLabel={DAY_NAMES[i]}
                    accessibilityState={{ checked: on }}
                    aria-checked={on}
                    style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? Accent.blue : Surface.track }}
                  >
                    <Text style={{ fontFamily: FontFamily.bodyBlack, fontSize: 14, color: on ? Surface.surface : Surface.greyText }}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>

            {tried && err ? <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: Accent.amber, marginTop: 12 }}>{err}</Text> : null}

            <PillButton label={isNew ? 'Add blocker' : 'Save changes'} accessibilityLabel={isNew ? 'Add blocker now' : 'Save changes'} size="lg" onPress={save} style={{ marginTop: 26 }} />
            {!isNew ? (
              <PressableScale onPress={() => onDelete(b)} accessibilityRole="button" accessibilityLabel="Delete blocker" style={{ height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
                <Text style={{ fontFamily: FontFamily.bodyBlack, fontSize: 16, color: Accent.red }}>Delete</Text>
              </PressableScale>
            ) : null}
          </ScrollView>
        </View>
        {/* US-112: "Choose a sticker" slides up over the sheet */}
        {picking ? (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' }}>
            <Pressable onPress={() => setPicking(false)} accessibilityRole="button" accessibilityLabel="Close stickers" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: hexToRgba(Surface.ink, 0.25) }} />
            <View style={{ backgroundColor: Surface.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30, ...Elevation.floating }}>
              <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: Surface.fieldBorder }} />
              <Text style={{ fontFamily: FontFamily.bodyBlack, fontSize: 18, color: Surface.ink, marginTop: 12, marginBottom: 12 }}>Choose a sticker</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {BLOCKER_STICKERS.map((s) => {
                  const on = s === b.sticker;
                  return (
                    <PressableScale
                      key={s}
                      onPress={() => {
                        set({ sticker: s });
                        setPicking(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Sticker ${s}`}
                      accessibilityState={{ selected: on }}
                      style={{ width: '22%', aspectRatio: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? Accent.blueSoft : Surface.field, borderWidth: 2, borderColor: on ? Accent.blue : 'transparent' }}
                    >
                      <Sticker name={isStickerName(s) ? s : 'lock'} size={44} />
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}
