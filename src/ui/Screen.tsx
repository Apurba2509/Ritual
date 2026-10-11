import { router } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControlProps,
  ScrollView,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from './Button';
import { Text } from './Text';
import { useTheme } from './theme';

export interface ScreenProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Show a back (or close, for modals) button. */
  back?: boolean | 'close';
  right?: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Extra bottom padding, e.g. to clear the floating tab bar. */
  bottomInset?: number;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  header?: React.ReactNode;
}

export function Screen({
  children,
  title,
  subtitle,
  back,
  right,
  scroll = true,
  contentStyle,
  bottomInset = 24,
  refreshControl,
  header,
}: ScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const headerRow =
    back || title || right ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: subtitle || title ? 4 : 0 }}>
        {back ? (
          <IconButton
            name={back === 'close' ? 'x' : 'chevron-left'}
            accessibilityLabel={back === 'close' ? 'Close' : 'Back'}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        ) : null}
        <View style={{ flex: 1 }}>
          {title ? (
            <Text variant={back ? 'heading' : 'title'} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    ) : null;

  const body = (
    <>
      {headerRow}
      {subtitle ? (
        <Text variant="caption" tone="muted" style={{ marginBottom: 8 }}>
          {subtitle}
        </Text>
      ) : null}
      {header}
      {children}
    </>
  );

  const padding: ViewStyle = {
    paddingTop: insets.top + 12,
    paddingHorizontal: 20,
    paddingBottom: insets.bottom + bottomInset,
    gap: 16,
  };

  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: t.bg }, padding, contentStyle]}>{body}</View>;
  }
  // Edge-to-edge Android no longer resizes the window for the keyboard, so pad for it ourselves.
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'web' ? undefined : 'padding'}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: t.bg }}
        contentContainerStyle={[padding, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {body}
      </ScrollView>
      {/* Keeps scrolled content from running under the translucent status bar. */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: t.bg,
          opacity: 0.94,
          pointerEvents: 'none',
        }}
      />
    </KeyboardAvoidingView>
  );
}

export function Section({
  title,
  action,
  children,
  style,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap: 10 }, style]}>
      {title || action ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {title ? (
            <Text variant="label" tone="muted">
              {title}
            </Text>
          ) : (
            <View />
          )}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}
