import { Tabs } from 'expo-router';
import { TabBar } from '../../components/ui/TabBar';

export default function TabLayout() {
  return (
    <Tabs 
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...(props as any)} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="analytics" options={{ title: 'Stats' }} />
      <Tabs.Screen name="social" options={{ title: 'Community' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
