import { useEffect, useState, type ComponentProps } from 'react';
import { View, Text, Pressable, type LayoutChangeEvent } from 'react-native';
import { Tabs } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Sticker, type StickerName } from '@/components/ui/Sticker';
import { Mascot } from '@/components/onboarding/Mascot';
import { FocusSheet } from '@/components/focus/FocusSheet';
import { openFocusSheet } from '@/services/focusSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Elevation, FontFamily, Motion, Surface } from '@/constants/design';
import { hapticLight } from '@/utils/haptics';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** US-105: 3D stickers in the bar; the active tab sits on a soft sand pill, the others are dimmed. */
const TAB_ICONS: Record<string, { sticker: StickerName; label: string }> = {
  today: { sticker: 'sun', label: 'Today' },
  goals: { sticker: 'target', label: 'Goals' },
  block: { sticker: 'lock', label: 'Block' },
  progress: { sticker: 'chart', label: 'Progress' },
};

const BAR_HEIGHT = 64;
const BAR_PADDING = 6;
/** US-099: the gap in the middle of the bar where the big Focus button sits. */
const CENTER_SLOT = 84;
const FOCUS_SIZE = 70;

/**
 * Floating white pill tab bar with an ink pill that springs to the active tab.
 * US-099: four tabs around a big round Focus button that opens "Start focusing" (components/focus/FocusSheet).
 * US-102 (founder 2026-11-06): Today · Goals · ◉Focus · Block · Progress. Settings opens from the gear on Today and Goals.
 */
function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const routes = state.routes.filter((r) => (descriptors[r.key].options as { href?: unknown }).href !== null && r.name !== 'focus');
  const half = Math.ceil(routes.length / 2);
  const itemWidth = barWidth > 0 ? (barWidth - BAR_PADDING * 2 - CENTER_SLOT) / routes.length : 0;
  const activeIndex = routes.findIndex((r) => r.key === state.routes[state.index].key);
  const onFocusRoute = state.routes[state.index].name === 'focus';
  const slotX = (i: number) => i * itemWidth + (i >= half ? CENTER_SLOT : 0);

  const x = useSharedValue(0);
  useEffect(() => {
    if (itemWidth > 0 && activeIndex >= 0) x.value = withSpring(slotX(activeIndex), Motion.spring);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, itemWidth, x]);
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const focusedOptions = descriptors[state.routes[state.index].key].options;
  const tabBarStyle = focusedOptions.tabBarStyle as { display?: string } | undefined;
  if (tabBarStyle?.display === 'none') return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom, 12),
      }}
    >
      <View
        style={{
          borderRadius: BAR_HEIGHT / 2,
          backgroundColor: Surface.surface,
          ...Elevation.floating,
        }}
      >
        <View
          onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}
          style={{
            height: BAR_HEIGHT,
            borderRadius: BAR_HEIGHT / 2,
            overflow: 'hidden',
            backgroundColor: Surface.surface,
          }}
        >
          {itemWidth > 0 && activeIndex >= 0 && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: BAR_PADDING,
                  left: BAR_PADDING,
                  width: itemWidth,
                  height: BAR_HEIGHT - BAR_PADDING * 2,
                  borderRadius: (BAR_HEIGHT - BAR_PADDING * 2) / 2,
                  backgroundColor: Surface.hill,
                },
                pillStyle,
              ]}
            />
          )}

          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              paddingHorizontal: BAR_PADDING,
            }}
          >
            {routes.flatMap((route, i) => {
              const meta = TAB_ICONS[route.name] ?? {
                sticker: 'sun' as StickerName,
                label: route.name,
              };
              const focused = i === activeIndex;
              const color = focused ? Surface.ink : Surface.faint;
              const slot = i === half ? [<View key="focus-slot" style={{ width: CENTER_SLOT }} />] : [];
              return [
                ...slot,
                <Pressable
                  key={route.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={meta.label}
                  onPress={() => {
                    // expo-router 58: tab bars get an emitter and navigateToTab instead of `navigation`.
                    const event = emitter.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault: true,
                    });
                    if (!focused && !event.defaultPrevented) {
                      hapticLight();
                      navigateToTab(route.key);
                    }
                  }}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                  }}
                >
                  <View style={{ opacity: focused ? 1 : 0.55 }}>
                    <Sticker name={meta.sticker} size={24} />
                  </View>
                  <Text
                    style={{
                      color,
                      fontFamily: FontFamily.bodyBold,
                      fontSize: 11,
                      lineHeight: 13,
                    }}
                  >
                    {meta.label}
                  </Text>
                </Pressable>,
              ];
            })}
          </View>
        </View>
      </View>

      {/* US-099: the big round Focus button, raised above the bar's middle. */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: -(FOCUS_SIZE - BAR_HEIGHT) / 2 - 12, alignItems: 'center' }}>
        <FocusButton active={onFocusRoute} />
      </View>
    </View>
  );
}

function FocusButton({ active }: { active: boolean }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[{ borderRadius: FOCUS_SIZE / 2, ...Elevation.floating }, style]}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.92, Motion.press);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, Motion.spring);
        }}
        onPress={() => {
          hapticLight();
          openFocusSheet();
        }}
        accessibilityRole="button"
        accessibilityLabel="Focus"
        accessibilityHint="Opens Start focusing"
        style={{
          width: FOCUS_SIZE,
          height: FOCUS_SIZE,
          borderRadius: FOCUS_SIZE / 2,
          backgroundColor: Surface.ink,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 4,
          borderColor: active ? '#FFB547' : Surface.canvas,
        }}
      >
        <Mascot mood="focus" size={46} intensity={0.8} bob={false} />
      </Pressable>
    </Animated.View>
  );
}

export default function TabLayout() {
  return (
    <>
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: Surface.canvas },
        headerTitleStyle: {
          color: Colors.textPrimary,
          fontFamily: FontFamily.bodyBold,
          fontSize: 20,
        },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
        headerShown: true,
        sceneStyle: { backgroundColor: Surface.canvas },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals' }} />
      <Tabs.Screen name="focus" options={{ title: 'Focus' }} />
      <Tabs.Screen name="block" options={{ title: 'Block' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
    </Tabs>
    <FocusSheet />
    </>
  );
}
