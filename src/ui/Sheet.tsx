import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { FRAME_WIDTH } from './layout';
import { Text } from './Text';
import { radius, useTheme } from './theme';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
}

/** Bottom sheet: slides up, drag-to-dismiss, keyboard aware. */
export function Sheet({ visible, onClose, title, subtitle, children, scroll = true, footer }: SheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const y = useSharedValue(800);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.value = 800;
      y.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.9 });
      backdrop.value = withTiming(1, { duration: 220 });
    } else if (mounted) {
      backdrop.value = withTiming(0, { duration: 180 });
      y.value = withTiming(800, { duration: 220, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) scheduleOnRN(setMounted, false);
      });
    }
  }, [visible, mounted, y, backdrop]);

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((e) => {
      y.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) {
        scheduleOnRN(onClose);
      } else {
        y.value = withSpring(0, { damping: 20, stiffness: 240 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!mounted) return null;

  const Body = scroll ? ScrollView : View;

  return (
    <Modal
      transparent
      visible
      statusBarTranslucent
      navigationBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }, backdropStyle]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' }}
        >
          <Animated.View
            style={[
              {
                maxHeight: '92%',
                width: '100%',
                maxWidth: Platform.OS === 'web' ? FRAME_WIDTH : undefined,
                alignSelf: 'center',
                backgroundColor: t.bgElevated,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                borderWidth: 1,
                borderBottomWidth: 0,
                borderColor: t.border,
                paddingBottom: Math.max(insets.bottom, 16),
              },
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={pan}>
              <View style={{ paddingTop: 10, paddingBottom: title ? 4 : 8, paddingHorizontal: 20 }}>
                <View
                  style={{
                    alignSelf: 'center',
                    width: 40,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: t.borderStrong,
                    marginBottom: title ? 14 : 0,
                  }}
                />
                {title ? <Text variant="heading">{title}</Text> : null}
                {subtitle ? (
                  <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </GestureDetector>
            <Body
              keyboardShouldPersistTaps="handled"
              style={scroll ? { flexGrow: 0 } : undefined}
              contentContainerStyle={scroll ? { padding: 20, paddingTop: 12, gap: 14 } : undefined}
            >
              {scroll ? children : <View style={{ padding: 20, paddingTop: 12, gap: 14 }}>{children}</View>}
            </Body>
            {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}
