import { Switch, View } from 'react-native';
import { Icon, IconName } from './Icon';
import { Tap } from './Tap';
import { Text } from './Text';
import { alpha, radius, useTheme } from './theme';

export function ListRow({
  icon,
  iconColor,
  emoji,
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
  iconColor?: string;
  emoji?: string;
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
  const tint = danger ? t.danger : (iconColor ?? t.accent);
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 13,
        paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.border,
      }}
    >
      {icon || emoji ? (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.sm,
            backgroundColor: alpha(tint, 0.14),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {emoji ? <Text size={16}>{emoji}</Text> : <Icon name={icon!} size={16} color={tint} />}
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
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
          trackColor={{ false: t.surface3, true: t.accent }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={t.surface3}
        />
      ) : onPress ? (
        <Icon name="chevron-right" size={18} color={t.textFaint} />
      ) : null}
    </View>
  );
  if (onPress && toggle === undefined) {
    return (
      <Tap onPress={onPress} scaleTo={0.99} accessibilityRole="button">
        {content}
      </Tap>
    );
  }
  return content;
}

export function ListGroup({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.border,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}
