import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast, useUI } from '@/data/ui';
import { Icon } from './Icon';
import { Tap } from './Tap';
import { Text } from './Text';
import { brand, radius, shadow, useTheme } from './theme';

function ToastItem({ toast }: { toast: Toast }) {
  const t = useTheme();
  const dismiss = useUI((s) => s.dismissToast);
  useEffect(() => {
    const id = setTimeout(() => dismiss(toast.id), toast.action ? 5000 : 2800);
    return () => clearTimeout(id);
  }, [toast.id, toast.action, dismiss]);

  // Always a dark pill — it floats over content in both themes.
  const icon = toast.icon ?? (toast.tone === 'error' ? 'warning' : toast.tone === 'success' ? 'check-circle' : 'info');
  const iconColor = toast.tone === 'error' ? '#FF6B5E' : brand.volt;

  return (
    <Animated.View
      entering={FadeInUp.duration(240)}
      exiting={FadeOutUp.duration(180)}
      layout={LinearTransition}
      style={{ alignItems: 'center' }}
    >
      <Tap
        onPress={() => dismiss(toast.id)}
        haptics={false}
        scaleTo={0.98}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 11,
          paddingLeft: 14,
          paddingRight: toast.action ? 8 : 16,
          borderRadius: radius.pill,
          backgroundColor: t.scheme === 'dark' ? '#232325' : '#141415',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          maxWidth: 420,
          ...shadow('#000000', 0.35, 24, 10),
        }}
      >
        <Icon name={icon} size={18} color={iconColor} weight="fill" />
        <Text variant="bodyStrong" color={brand.bone} size={14} style={{ flexShrink: 1 }}>
          {toast.message}
        </Text>
        {toast.action ? (
          <Tap
            onPress={() => {
              toast.action!.onPress();
              dismiss(toast.id);
            }}
            hitSlop={10}
            style={{
              marginLeft: 4,
              paddingHorizontal: 12,
              height: 30,
              borderRadius: 15,
              backgroundColor: brand.volt,
              justifyContent: 'center',
            }}
          >
            <Text variant="caption" weight="bold" color={brand.ink}>
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
