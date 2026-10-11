import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button } from './Button';
import { Icon, IconName } from './Icon';
import { Text } from './Text';
import { radius, useTheme } from './theme';

export function EmptyState({
  icon,
  title,
  body,
  action,
  onAction,
  actionIcon = 'plus',
  secondary,
  onSecondary,
  compact,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  actionIcon?: IconName;
  secondary?: string;
  onSecondary?: () => void;
  compact?: boolean;
}) {
  const t = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={{ alignItems: 'center', paddingVertical: compact ? 20 : 36, paddingHorizontal: 12, gap: 10 }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radius.lg,
          backgroundColor: t.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 6,
        }}
      >
        <Icon name={icon} size={30} color={t.text} weight="duotone" duotoneColor={t.accentInk} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {body ? (
        <Text tone="muted" align="center" style={{ maxWidth: 300 }}>
          {body}
        </Text>
      ) : null}
      {action || secondary ? (
        <View style={{ gap: 4, marginTop: 10, alignItems: 'center' }}>
          {action ? <Button title={action} onPress={onAction} icon={actionIcon} /> : null}
          {secondary ? <Button title={secondary} onPress={onSecondary} variant="ghost" size="sm" /> : null}
        </View>
      ) : null}
    </Animated.View>
  );
}
