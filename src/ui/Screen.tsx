import { LinearGradient } from 'expo-linear-gradient';
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
import { MAX_COLUMN } from './layout';
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
  /** Extra bottom padding, e.g. to clear the floating tab bar or a sticky footer. */
  bottomInset?: number;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  header?: React.ReactNode;
  /** Pinned to the bottom of the screen, above the home indicator (e.g. a Save button). */
  footer?: React.ReactNode;
}

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function Screen({
  children,
  title,
  subtitle,
  back,
  right,
  scroll = true,
  contentStyle,
  bottomInset = 28,
  refreshControl,
  header,
  footer,
}: ScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  // Tab roots (no back button) keep their action on the title row instead of a separate bar.
  const inlineRight = !back && !!right && !!title;
  const nav =
    back || (right && !inlineRight) ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
        {back ? (
          <IconButton
            name={back === 'close' ? 'x' : 'arrow-left'}
            accessibilityLabel={back === 'close' ? 'Close' : 'Back'}
            onPress={goBack}
          />
        ) : (
          <View />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{right}</View>
      </View>
    ) : null;

  const titleBlock =
    title || subtitle ? (
      <View style={{ gap: 6, marginTop: back ? 6 : 0 }}>
        {title ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text variant={back ? 'title' : 'hero'} size={back ? undefined : 34} style={{ flex: 1 }}>
              {title}
            </Text>
            {inlineRight ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{right}</View> : null}
          </View>
        ) : null}
        {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
      </View>
    ) : null;

  const body = (
    <>
      {nav}
      {titleBlock}
      {header}
      {children}
    </>
  );

  const footerHeight = footer ? 84 : 0;
  // Centered reading column: full width on phones, capped on foldables / tablets / landscape.
  const padding: ViewStyle = {
    paddingTop: insets.top + 10,
    paddingHorizontal: 20,
    paddingBottom: insets.bottom + bottomInset + footerHeight,
    gap: 18,
    width: '100%',
    maxWidth: MAX_COLUMN,
    alignSelf: 'center',
  };

  const footerView = footer ? (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 12) + 8,
        backgroundColor: t.bg,
        borderTopWidth: 1,
        borderTopColor: t.border,
      }}
    >
      <View style={{ width: '100%', maxWidth: MAX_COLUMN - 40, alignSelf: 'center' }}>{footer}</View>
    </View>
  ) : null;

  if (!scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={[{ flex: 1 }, padding, contentStyle]}>{body}</View>
        {footerView}
      </View>
    );
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
      {footerView}
      {/* Keeps scrolled content out from under the translucent status bar, with a soft edge. */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' }}>
        <View style={{ height: insets.top, backgroundColor: t.bg }} />
        <LinearGradient colors={[t.bg, `${t.bg}00`]} style={{ height: 20 }} />
      </View>
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
    <View style={[{ gap: 12 }, style]}>
      {title || action ? (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}
        >
          {title ? (
            <Text variant="heading" size={19}>
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

/** Small text button used in section headers ("See all"). */
export function SectionAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Text variant="caption" weight="semibold" tone="default" onPress={onPress} suppressHighlighting>
      {label}
    </Text>
  );
}
