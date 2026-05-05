import type { ComponentProps } from 'react';
import { View, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, FontFamily, Surface } from '@/constants/design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
const TAB_ACTIVE = Surface.ink;
const TAB_INACTIVE = Surface.muted;
const TAB_BG = 'rgba(248,244,235,0.96)';

function TabIcon({
  focused,
  color,
  label,
  activeIcon,
  inactiveIcon,
}: {
  focused: boolean;
  color: string;
  label: string;
  activeIcon: IoniconName;
  inactiveIcon: IoniconName;
}) {
  return (
    <View className="items-center justify-center w-[58px]">
      <Ionicons name={focused ? activeIcon : inactiveIcon} size={18} color={color} />
      <Text
        numberOfLines={1}
        className="mt-1"
        style={{
          color,
          fontFamily: focused ? FontFamily.monoSemiBold : FontFamily.monoMedium,
          fontSize: 10,
          lineHeight: 12,
          textAlign: 'center',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Surface.canvas },
        headerTitleStyle: { color: Colors.textPrimary, fontFamily: FontFamily.bodySemiBold, fontSize: 22 },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,        
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        headerShown: true,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          height: 54,
          paddingTop: 4,
          paddingBottom: 4,
          paddingHorizontal: 8,
          marginHorizontal: 16,
          marginBottom: Math.max(insets.bottom, 10),
          borderWidth: 1,
          borderColor: Surface.rule,
          backgroundColor: 'transparent',
          borderRadius: 9999,
          overflow: 'hidden',
        },
        tabBarBackground: () => (
          <BlurView
            tint="light"
            intensity={45}
            style={{ flex: 1, backgroundColor: TAB_BG }}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              label="Today"
              activeIcon="home"
              inactiveIcon="home-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="focus"
        options={{
          title: 'Focus',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              label="Focus"
              activeIcon="timer"
              inactiveIcon="timer-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              label="Insights"
              activeIcon="bar-chart"
              inactiveIcon="bar-chart-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Goals',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              label="Goals"
              activeIcon="list"
              inactiveIcon="list-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              label="Settings"
              activeIcon="settings"
              inactiveIcon="settings-outline"
            />
          ),
        }}
      />
    </Tabs>
  );
}
