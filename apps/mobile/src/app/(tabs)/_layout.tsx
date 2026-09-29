import { Tabs } from 'expo-router/js-tabs';
import { BottomNav, type Tab } from '@/design/bottom-nav';

/** The four tabs plus the "+" create sheet, drawn by the design's BottomNav. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <BottomNav
          active={(state.routes[state.index]?.name as Tab) ?? null}
          onTab={(tab) => navigation.navigate(tab as never)}
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="competitions" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
