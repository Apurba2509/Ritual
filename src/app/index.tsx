import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { View } from 'react-native';
import { PulseRing } from '../components/animations/PulseRing';

export default function RootIndex() {
  const { session, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <PulseRing size={80} color="#7C3AED" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)" />;
  }

  if (profile && !profile.onboarding_completed) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
