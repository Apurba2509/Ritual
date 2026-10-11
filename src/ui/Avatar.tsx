import { Image } from 'expo-image';
import { View } from 'react-native';
import { Text } from './Text';
import { alpha, useTheme } from './theme';

export function Avatar({
  emoji,
  color,
  photoUrl,
  name,
  size = 44,
  ring,
}: {
  emoji?: string | null;
  color?: string | null;
  photoUrl?: string | null;
  name?: string | null;
  size?: number;
  ring?: string;
}) {
  const t = useTheme();
  const bg = color ?? t.accent;
  const initials = (name ?? '?')
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: alpha(bg, t.scheme === 'dark' ? 0.22 : 0.16),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 2 : 1,
        borderColor: ring ?? alpha(bg, 0.35),
        overflow: 'hidden',
      }}
    >
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={{ width: size, height: size }} contentFit="cover" />
      ) : emoji ? (
        <Text size={size * 0.48}>{emoji}</Text>
      ) : (
        <Text variant="bodyStrong" size={size * 0.38} color={bg}>
          {initials || '?'}
        </Text>
      )}
    </View>
  );
}
