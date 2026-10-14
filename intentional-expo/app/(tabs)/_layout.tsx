import { useEffect, useState, type ComponentProps } from 'react';
import { View, Text, Pressable, type LayoutChangeEvent } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { ChartNoAxesColumn, Layers, Settings2, Sun, Timer, type LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Elevation, FontFamily, Motion, Surface } from '@/constants/design';
import { hapticLight } from '@/utils/haptics';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TAB_ICONS: Record<string, { Icon: LucideIcon; label: string }> = {
  today: { Icon: Sun, label: 'Today' },
  focus: { Icon: Timer, label: 'Focus' },
  insights: { Icon: ChartNoAxesColumn, label: 'Insights' },
  goals: { Icon: Layers, label: 'Goals' },
  settings: { Icon: Settings2, label: 'Settings' },
};

const BAR_HEIGHT = 62;
const BAR_PADDING = 6;

/** Floating glass tab bar with an ink pill that springs to the active tab. */
function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const routes = state.routes.filter((r) => (descriptors[r.key].options as { href?: unknown }).href !== null);
  const itemWidth = barWidth > 0 ? (barWidth - BAR_PADDING * 2) / routes.length : 0;
  const activeIndex = Math.max(0, routes.findIndex((r) => r.key === state.routes[state.index].key));

  const x = useSharedValue(0);
  useEffect(() => {
    if (itemWidth > 0) x.value = withSpring(activeIndex * itemWidth, Motion.spring);
  }, [activeIndex, itemWidth, x]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const focusedOptions = descriptors[state.routes[state.index].key].options;
  const tabBarStyle = focusedOptions.tabBarStyle as { display?: string } | undefined;
  if (tabBarStyle?.display === 'none') return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom, 12) }}
    >
      <View
        onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}
        style={{
          height: BAR_HEIGHT,
          borderRadius: BAR_HEIGHT / 2,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: Surface.rule,
          ...Elevation.floating,
        }}
      >
        <BlurView tint="light" intensity={50} style={{ ...StyleFill, backgroundColor: 'rgba(255,252,246,0.88)' }} />

        {itemWidth > 0 && (
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: BAR_PADDING,
                left: BAR_PADDING,
                width: itemWidth,
                height: BAR_HEIGHT - BAR_PADDING * 2 - 2,
                borderRadius: (BAR_HEIGHT - BAR_PADDING * 2) / 2,
                backgroundColor: Surface.ink,
              },
              pillStyle,
            ]}
          />
        )}

        <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: BAR_PADDING }}>
          {routes.map((route, i) => {
            const meta = TAB_ICONS[route.name] ?? { Icon: Sun, label: route.name };
            const focused = i === activeIndex;
            const color = focused ? Surface.surface : Colors.textSecondary;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={meta.label}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) {
                    hapticLight();
                    navigation.navigate(route.name, route.params);
                  }
                }}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}
              >
                <meta.Icon size={19} color={color} strokeWidth={focused ? 2.1 : 1.8} />
                <Text style={{ color, fontFamily: focused ? FontFamily.bodySemiBold : FontFamily.bodyMedium, fontSize: 11, lineHeight: 13 }}>
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const StyleFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: Surface.canvas },
        headerTitleStyle: { color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 20 },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
        headerShown: true,
        sceneStyle: { backgroundColor: Surface.canvas },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="focus" options={{ title: 'Focus' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
