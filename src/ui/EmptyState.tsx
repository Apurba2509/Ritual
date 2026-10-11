import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button } from './Button';
import { Text } from './Text';

export function EmptyState({
  emoji,
  title,
  body,
  action,
  onAction,
  secondary,
  onSecondary,
}: {
  emoji: string;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
      <Text size={52}>{emoji}</Text>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {body ? (
        <Text tone="muted" align="center" style={{ maxWidth: 300 }}>
          {body}
        </Text>
      ) : null}
      <View style={{ gap: 8, marginTop: 8, alignSelf: 'stretch', alignItems: 'center' }}>
        {action ? <Button title={action} onPress={onAction} icon="plus" /> : null}
        {secondary ? <Button title={secondary} onPress={onSecondary} variant="ghost" /> : null}
      </View>
    </Animated.View>
  );
}
