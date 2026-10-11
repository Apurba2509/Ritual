import { View } from 'react-native';
import { Text } from '@/ui/Text';
import { alpha, useTheme } from '@/ui/theme';

export function HabitIcon({
  emoji,
  color,
  size = 46,
  filled,
}: {
  emoji: string;
  color: string;
  size?: number;
  filled?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled
          ? alpha(color, t.scheme === 'dark' ? 0.32 : 0.22)
          : alpha(color, t.scheme === 'dark' ? 0.14 : 0.1),
        borderWidth: 1,
        borderColor: alpha(color, filled ? 0.5 : 0.22),
      }}
    >
      <Text size={size * 0.48}>{emoji}</Text>
    </View>
  );
}
