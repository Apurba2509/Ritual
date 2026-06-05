import React from 'react';
import { View, Text, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { useUserStore } from '../../stores/userStore';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { LevelBadge } from '../../components/gamification/LevelBadge';
import { getLevelFromXP, getXPProgress } from '../../utils/xpUtils';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { profile, settings, updateSettings, isSavingSettings } = useUserStore();
  const router = useRouter();

  const xp = profile?.xp_total || 0;
  const level = getLevelFromXP(xp);
  const { currentLevelXP, nextLevelXP, progress } = getXPProgress(xp);

  return (
    <ScrollView className="flex-1 bg-background pt-16 px-4">
      <View className="flex-row items-center mb-8">
        <Avatar 
          name={profile?.username || profile?.display_name || 'User'} 
          url={profile?.avatar_url}
          size={80} 
        />
        <View className="ml-4 flex-1">
          <Text className="font-heading text-textPrimary text-2xl">{profile?.username || profile?.display_name || 'Ritual Member'}</Text>
        </View>
        <LevelBadge level={level} size={56} />
      </View>

      <View className="mb-8">
        <View className="flex-row justify-between mb-2">
          <Text className="font-stat text-textSecondary text-xs tracking-wider uppercase">Level Progress</Text>
          <Text className="font-stat text-textSecondary text-xs">{currentLevelXP} / {nextLevelXP} XP</Text>
        </View>
        <View className="h-2 bg-surface1 rounded-full overflow-hidden">
          <View className="h-full bg-primary rounded-full" style={{ width: `${progress * 100}%` }} />
        </View>
      </View>

      <View className="mb-8">
        <View className="flex-row items-center mb-4">
          <Text className="font-heading text-textPrimary text-xl mr-3">Settings</Text>
          {isSavingSettings && <ActivityIndicator size="small" color="#7C3AED" />}
        </View>
        
        <View className="bg-surface1 rounded-2xl overflow-hidden border border-white/5">
          <View className="flex-row justify-between items-center p-4 border-b border-white/5">
            <Text className="font-body text-textPrimary">Morning Brief Notification</Text>
            <Switch 
              value={settings?.morningBrief ?? true} 
              onValueChange={(val) => updateSettings({ morningBrief: val })}
              trackColor={{ false: '#374151', true: '#7C3AED' }} 
            />
          </View>
          <View className="flex-row justify-between items-center p-4 border-b border-white/5">
            <Text className="font-body text-textPrimary">Streak at Risk Warning</Text>
            <Switch 
              value={settings?.streakWarning ?? true} 
              onValueChange={(val) => updateSettings({ streakWarning: val })}
              trackColor={{ false: '#374151', true: '#7C3AED' }} 
            />
          </View>
          <View className="flex-row justify-between items-center p-4">
            <Text className="font-body text-textPrimary">Dark Theme</Text>
            <Switch 
              value={settings?.darkTheme ?? true} 
              onValueChange={(val) => updateSettings({ darkTheme: val })}
              trackColor={{ false: '#374151', true: '#7C3AED' }} 
            />
          </View>
        </View>
      </View>

      <Button title="Sign Out" variant="outlined" onPress={async () => {
        await signOut();
        router.replace('/(auth)');
      }} className="mb-12" />
    </ScrollView>
  );
}
