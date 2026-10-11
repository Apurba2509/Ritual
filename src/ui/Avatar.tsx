import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

// Deep, desaturated gradients so initials avatars look intentional next to real photos.
const GRADIENTS: [string, string][] = [
  ['#3A4BFF', '#9B5CFF'],
  ['#0F9F8F', '#3BD1A0'],
  ['#E0503A', '#FF9A5C'],
  ['#2F6BFF', '#4FC3FF'],
  ['#B0306A', '#FF6FA3'],
  ['#5A6B00', '#A8D12A'],
  ['#4A4A55', '#8A8A99'],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initialsOf(name?: string | null) {
  return (
    (name ?? '')
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '·'
  );
}

export function Avatar({
  photoUrl,
  name,
  seed,
  size = 44,
  ring,
}: {
  photoUrl?: string | null;
  name?: string | null;
  /** Stable value (uid) so a person keeps the same colour when they rename. */
  seed?: string | null;
  size?: number;
  ring?: string;
}) {
  const t = useTheme();
  const [a, b] = GRADIENTS[hash(seed || name || '?') % GRADIENTS.length];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: t.surface3,
        borderWidth: ring ? 2 : 0,
        borderColor: ring,
      }}
    >
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={150}
          accessibilityLabel={name ? `${name}'s photo` : 'Profile photo'}
        />
      ) : (
        <LinearGradient
          colors={[a, b]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text weight="bold" size={Math.round(size * 0.38)} color="#FFFFFF" style={{ letterSpacing: 0 }}>
            {initialsOf(name)}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}
