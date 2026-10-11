import { forwardRef, useState } from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { Icon, IconName } from './Icon';
import { Text } from './Text';
import { fonts, radius, useTheme } from './theme';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  icon?: IconName;
  right?: React.ReactNode;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, icon, right, style, multiline, onFocus, onBlur, ...props },
  ref,
) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: 10,
          minHeight: 52,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
          borderRadius: radius.md,
          backgroundColor: t.surface,
          borderWidth: 1.5,
          borderColor: error ? t.danger : focused ? t.accent : t.border,
        }}
      >
        {icon ? <Icon name={icon} size={18} color={focused ? t.accent : t.textFaint} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={t.textFaint}
          selectionColor={t.accent}
          cursorColor={t.accent}
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
              flex: 1,
              color: t.text,
              fontFamily: fonts.body,
              fontSize: 16,
              paddingVertical: multiline ? 0 : 14,
              minHeight: multiline ? 72 : undefined,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            style,
          ]}
          {...props}
        />
        {right}
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="faint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
