import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="step-goals" />
      <Stack.Screen name="step-templates" />
      <Stack.Screen name="step-reminders" />
      <Stack.Screen name="step-permissions" />
    </Stack>
  );
}
