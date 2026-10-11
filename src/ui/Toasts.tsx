import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast, useUI } from '@/data/ui';
import { Tap } from './Tap';
import { Text } from './Text';
import { radius, useTheme, shadow } from './theme';

function ToastItem({ toast }: { toast: Toast }) {
  const t = useTheme();
  const dismiss = useUI((s) => s.dismissToast);
  useEffect(() => {
    const id = setTimeout(() => dismiss(toast.id), toast.action ? 5000 : 2800);
    return () => clearTimeout(id);
  }, [toast.id, toast.action, dismiss]);

  const accent = toast.tone === 'success' ? t.success : toast.tone === 'error' ? t.danger : t.accent;

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(18)}
      exiting={FadeOutUp.duration(180)}
      layout={LinearTransition}
    >
      <Tap
        onPress={() => dismiss(toast.id)}
        haptics={false}
        scaleTo={0.98}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: radius.lg,
          backgroundColor: t.scheme === 'dark' ? t.surface3 : '#18181B',
          borderWidth: 1,
          borderColor: t.borderStrong,
          ...shadow('#000000', 0.3, 18, 8),
        }}
      >
        <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: accent }} />
        {toast.emoji ? <Text size={18}>{toast.emoji}</Text> : null}
        <Text variant="bodyStrong" color="#F5F5F7" style={{ flex: 1 }} size={14}>
          {toast.message}
        </Text>
        {toast.action ? (
          <Tap
            onPress={() => {
              toast.action!.onPress();
              dismiss(toast.id);
            }}
            hitSlop={10}
          >
            <Text variant="bodyStrong" color={t.accent} size={14}>
              {toast.action.label}
            </Text>
          </Tap>
        ) : null}
      </Tap>
    </Animated.View>
  );
}

export function ToastHost() {
  const toasts = useUI((s) => s.toasts);
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  return (
    <View style={{ pointerEvents: 'box-none', position: 'absolute', top: insets.top + 8, left: 16, right: 16, gap: 8 }}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </View>
  );
}
