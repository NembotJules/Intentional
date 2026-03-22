import type { ComponentProps } from 'react';
import { View, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
const TAB_ACTIVE = '#E8E4DC';
const TAB_INACTIVE = '#333333';
const TAB_BG = 'rgba(13,13,13,0.96)';

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
        style={{ color, fontWeight: focused ? '600' : '400', fontSize: 7, lineHeight: 10, textAlign: 'center', letterSpacing: 1.5, textTransform: 'uppercase' }}
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
        headerTitleStyle: { color: Colors.textPrimary, fontWeight: '700', fontSize: 22 },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,        
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        headerShown: true,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          height: 56 + insets.bottom + 8,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
          paddingHorizontal: 8,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          overflow: 'hidden',
        },
        tabBarBackground: () => (
          <BlurView
            tint="dark"
            intensity={55}
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
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}
