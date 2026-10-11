import { Switch, View } from 'react-native';
import { Icon, IconName } from './Icon';
import { Tap } from './Tap';
import { Text } from './Text';
import { alpha, cardShadow, radius, useTheme } from './theme';

export function ListRow({
  icon,
  iconColor,
  leading,
  title,
  subtitle,
  value,
  onPress,
  toggle,
  onToggle,
  danger,
  last,
  right,
}: {
  icon?: IconName;
  /** Tints the icon tile (defaults to neutral). */
  iconColor?: string;
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  toggle?: boolean;
  onToggle?: (v: boolean) => void;
  danger?: boolean;
  last?: boolean;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  const fg = danger ? t.danger : (iconColor ?? t.text);
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 }}>
      {leading ??
        (icon ? (
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: radius.sm,
              backgroundColor: danger || iconColor ? alpha(fg, t.scheme === 'dark' ? 0.14 : 0.1) : t.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={18} color={fg} />
          </View>
        ) : null)}
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="bodyStrong" tone={danger ? 'danger' : 'default'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="caption" tone="muted">
          {value}
        </Text>
      ) : null}
      {right}
      {toggle !== undefined ? (
        <Switch
          value={toggle}
          onValueChange={onToggle}
          trackColor={{ false: t.surface3, true: t.scheme === 'dark' ? t.accent : t.text }}
          thumbColor={t.scheme === 'dark' && toggle ? t.onAccent : '#FFFFFF'}
          ios_backgroundColor={t.surface3}
        />
      ) : onPress ? (
        <Icon name="caret-right" size={16} color={t.textFaint} />
      ) : null}
    </View>
  );
  const divider = last ? null : (
    <View style={{ height: 1, backgroundColor: t.border, marginLeft: icon || leading ? 64 : 16 }} />
  );
  if (onPress && toggle === undefined) {
    return (
      <>
        <Tap onPress={onPress} scaleTo={0.99} accessibilityRole="button">
          {content}
        </Tap>
        {divider}
      </>
    );
  }
  return (
    <>
      {content}
      {divider}
    </>
  );
}

export function ListGroup({ children, title }: { children: React.ReactNode; title?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {title ? (
        <Text variant="caption" weight="semibold" tone="muted" style={{ paddingHorizontal: 4 }}>
          {title}
        </Text>
      ) : null}
      <View
        style={{
          backgroundColor: t.surface,
          borderRadius: radius.lg + 2,
          borderWidth: 1,
          borderColor: t.border,
          overflow: 'hidden',
          ...cardShadow(t),
        }}
      >
        {children}
      </View>
    </View>
  );
}
