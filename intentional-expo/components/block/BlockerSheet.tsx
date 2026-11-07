/**
 * US-107 · The blocker sheet: name, sticker, "All day" or a schedule, the days. Save / Delete.
 * Pure UI: the parent turns the Blocker into block-hour rules (services/blockers.upsertBlocker).
 */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '@/components/ui/motion';
import { Sticker, isStickerName } from '@/components/ui/Sticker';
import { BLOCKER_STICKERS, blockerError, type Blocker } from '@/services/blockers';
import { Accent, FontFamily, Radius, Surface, Type, hexToRgba } from '@/constants/design';
import { hapticLight } from '@/utils/haptics';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const QUICK: { label: string; mask: number }[] = [
  { label: 'Weekdays', mask: 0b0011111 },
  { label: 'Weekends', mask: 0b1100000 },
  { label: 'Every day', mask: 127 },
];

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: Surface.surfaceRaised }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              hapticLight();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            aria-selected={on}
            style={{ flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? Surface.ink : 'transparent' }}
          >
            <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: on ? Surface.surface : Surface.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TimeBox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ ...Type.meta, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^\d:]/g, '').slice(0, 5))}
        accessibilityLabel={label}
        placeholder="09:00"
        placeholderTextColor={Surface.faint}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        style={{ height: 50, borderRadius: Radius.md, backgroundColor: Surface.surfaceRaised, textAlign: 'center', fontFamily: FontFamily.bodyBold, fontSize: 18, color: Surface.ink }}
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
        <View style={{ maxHeight: '92%', backgroundColor: Surface.canvas, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: Surface.ruleStrong, marginTop: 10 }} />
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
            {/* sticker */}
            <PressableScale
              onPress={() => setPicking((x) => !x)}
              accessibilityRole="button"
              accessibilityLabel="Change sticker"
              style={{ alignSelf: 'center', width: 88, height: 88, borderRadius: 44, backgroundColor: Accent.sky, alignItems: 'center', justifyContent: 'center' }}
            >
              <Sticker name={isStickerName(b.sticker) ? b.sticker : 'lock'} size={54} />
              <View style={{ position: 'absolute', right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: Surface.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Surface.canvas }}>
                <Ionicons name="pencil" size={13} color={Surface.ink} />
              </View>
            </PressableScale>
            {picking ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14, padding: 10, borderRadius: Radius.card, backgroundColor: Surface.surface }}>
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
                      style={{ width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? Accent.blueSoft : Surface.surfaceRaised, borderWidth: 2, borderColor: on ? Accent.blue : 'transparent' }}
                    >
                      <Sticker name={isStickerName(s) ? s : 'lock'} size={32} />
                    </PressableScale>
                  );
                })}
              </View>
            ) : null}

            <TextInput
              value={b.name}
              onChangeText={(name) => set({ name })}
              placeholder="Name it, like Study"
              placeholderTextColor={Surface.faint}
              accessibilityLabel="Blocker name"
              maxLength={28}
              style={{ marginTop: 18, height: 54, borderRadius: Radius.md, backgroundColor: Surface.surfaceRaised, paddingHorizontal: 16, fontFamily: FontFamily.bodyBold, fontSize: 18, color: Surface.ink }}
            />

            <View style={{ marginTop: 14 }}>
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
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TimeBox label="From" value={b.start} onChange={(start) => set({ start })} />
                <TimeBox label="To" value={b.end} onChange={(end) => set({ end })} />
              </View>
            ) : null}

            <Text style={{ ...Type.heading, fontSize: 16, marginTop: 18, marginBottom: 8 }}>Days</Text>
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
                    style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, justifyContent: 'center', backgroundColor: on ? Surface.ink : Surface.surfaceRaised }}
                  >
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 13, color: on ? Surface.surface : Surface.muted }}>{q.label}</Text>
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
                    style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? Accent.blue : Surface.surfaceRaised }}
                  >
                    <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 14, color: on ? Surface.surface : Surface.muted }}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>

            {tried && err ? <Text style={{ ...Type.meta, color: Accent.amber, marginTop: 12 }}>{err}</Text> : null}

            <PressableScale
              onPress={save}
              accessibilityRole="button"
              accessibilityLabel={isNew ? 'Add blocker now' : 'Save changes'}
              style={{ marginTop: 22, height: 56, borderRadius: 28, backgroundColor: Surface.ink, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 17, color: Surface.surface }}>{isNew ? 'Add blocker' : 'Save changes'}</Text>
            </PressableScale>
            {!isNew ? (
              <PressableScale onPress={() => onDelete(b)} accessibilityRole="button" accessibilityLabel="Delete blocker" style={{ height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
                <Text style={{ fontFamily: FontFamily.bodyBold, fontSize: 15, color: Accent.red }}>Delete</Text>
              </PressableScale>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
