/**
 * US-102 · Every habit, grouped by pillar, with a switch to pause it without losing its history (US-042).
 * Moved from Settings to the Goals tab (founder 2026-11-06: "each tab does exactly what it is for").
 */
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/db/api';
import type { ActionWithGoal } from '@/db/api';
import { Card } from '@/components/ui/kit';
import { PillarIcon } from '@/components/ui/PillarIcon';
import { FontFamily, Surface, Type } from '@/constants/design';
import { getGoalColor } from '@/utils/goalColors';
import { syncHabits } from '@/services/habitSync';

export function HabitPauseList() {
  const [all, setAll] = useState<ActionWithGoal[]>([]);
  useFocusEffect(
    useCallback(() => {
      setAll(api.getAllActionsWithGoal());
    }, [])
  );

  const toggle = async (a: ActionWithGoal) => {
    await api.updateAction(a.id, { is_active: a.is_active ? 0 : 1 });
    void syncHabits();
    setAll(api.getAllActionsWithGoal());
  };

  const groups: { id: string; name: string; color: string; icon: string; actions: ActionWithGoal[] }[] = [];
  for (const a of all) {
    const last = groups[groups.length - 1];
    if (last && last.id === a.goal_id) last.actions.push(a);
    else groups.push({ id: a.goal_id, name: a.goal_name, color: getGoalColor({ id: a.goal_id, color: a.goal_color }), icon: a.goal_icon, actions: [a] });
  }
  if (!groups.length) return null;

  return (
    <View style={{ marginTop: 26 }}>
      <Text accessibilityRole="header" style={{ ...Type.title, fontSize: 22, lineHeight: 28 }}>
        Your habits
      </Text>
      <Text style={{ ...Type.meta, marginTop: 2, marginBottom: 12 }}>Pause one without losing its history.</Text>
      <View style={{ gap: 10 }}>
        {groups.map((g) => (
          <Card key={g.id} style={{ paddingVertical: 10, paddingHorizontal: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 4 }}>
              <PillarIcon icon={g.icon} name={g.name} color={g.color} size={28} />
              <Text style={{ color: Surface.ink, fontFamily: FontFamily.bodyBold, fontSize: 16, flex: 1 }} numberOfLines={1}>
                {g.name}
              </Text>
            </View>
            {g.actions.map((a) => (
              <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: a.is_active ? Surface.ink : Surface.faint, fontFamily: FontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Text style={{ ...Type.meta, fontSize: 13 }}>
                    {a.type === 'session' ? `${a.target_minutes} min` : 'Check-off habit'}
                    {a.reminder_time ? ` · ${a.reminder_time}` : ''}
                    {a.is_active ? '' : ' · Paused'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void toggle(a)}
                  hitSlop={8}
                  accessibilityRole="switch"
                  accessibilityLabel={`${a.name} active`}
                  accessibilityState={{ checked: !!a.is_active }}
                  style={{ width: 52, height: 32, borderRadius: 16, padding: 3, justifyContent: 'center', backgroundColor: a.is_active ? Surface.ink : Surface.ruleStrong }}
                >
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: Surface.surface, transform: [{ translateX: a.is_active ? 20 : 0 }] }} />
                </Pressable>
              </View>
            ))}
          </Card>
        ))}
      </View>
    </View>
  );
}
