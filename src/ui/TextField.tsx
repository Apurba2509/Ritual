import { forwardRef, useState } from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { Icon, IconName } from './Icon';
import { Text } from './Text';
import { alpha, fonts, radius, useTheme } from './theme';

export interface TextFieldProps extends TextInputProps {
  /** Shown inside the field, above the value. */
  label?: string;
  hint?: string;
  error?: string | null;
  icon?: IconName;
  right?: React.ReactNode;
  /** Larger, borderless title input (habit names, goals). */
  big?: boolean;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, icon, right, style, multiline, onFocus, onBlur, big, ...props },
  ref,
) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? t.danger
    : focused
      ? t.scheme === 'dark'
        ? alpha(t.accent, 0.7)
        : t.text
      : t.borderStrong;

  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: 12,
          minHeight: label ? 62 : 54,
          paddingHorizontal: 16,
          paddingVertical: multiline ? 14 : 0,
          borderRadius: radius.md + 2,
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor,
        }}
      >
        {icon ? (
          <Icon name={icon} size={20} color={focused ? t.text : t.textMuted} weight={focused ? 'bold' : 'regular'} />
        ) : null}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {label ? (
            <Text variant="small" tone={focused ? 'default' : 'muted'} style={{ marginBottom: multiline ? 4 : 1 }}>
              {label}
            </Text>
          ) : null}
          <TextInput
            ref={ref}
            placeholderTextColor={t.textFaint}
            selectionColor={t.scheme === 'dark' ? t.accent : t.text}
            cursorColor={t.scheme === 'dark' ? t.accent : t.text}
            multiline={multiline}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[
              {
                color: t.text,
                fontFamily: big ? fonts.semibold : fonts.medium,
                fontSize: big ? 20 : 16,
                letterSpacing: big ? -0.4 : -0.1,
                paddingVertical: label ? 0 : multiline ? 0 : 14,
                paddingHorizontal: 0,
                minHeight: multiline ? 64 : undefined,
                textAlignVertical: multiline ? 'top' : 'center',
                // react-native-web draws a focus ring by default
                outlineStyle: 'none',
              } as object,
              style,
            ]}
            {...props}
          />
        </View>
        {right}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" style={{ paddingHorizontal: 4 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="faint" style={{ paddingHorizontal: 4 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
