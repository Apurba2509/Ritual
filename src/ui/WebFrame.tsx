import * as Linking from 'expo-linking';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Icon, IconName } from './Icon';
import { FRAME_WIDTH, useFrameHeight, useIsFramed } from './layout';
import { LogoMark } from './Logo';
import { Tap } from './Tap';
import { Text } from './Text';
import { brand, ForceTheme } from './theme';

const POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'device-mobile',
    title: 'Senses habits on the phone',
    body: 'Step counter, activity detection and a GPS recorder. Offline, app closed.',
  },
  {
    icon: 'github-logo',
    title: 'Tracks your work',
    body: 'GitHub contributions and LeetCode submissions check themselves off.',
  },
  {
    icon: 'sparkle',
    title: 'Understands plain English',
    body: '“Ran 5k and read 20 pages” becomes two check-ins, via Gemini.',
  },
  { icon: 'cloud-check', title: 'Local-first sync', body: 'Instant offline, synced in realtime through Firebase.' },
];

/**
 * On wide web screens (the portfolio demo), present the app inside a phone-sized frame with a
 * short pitch beside it. On phones and native it renders children untouched.
 */
export function WebFrame({ children }: { children: React.ReactNode }) {
  const framed = useIsFramed();
  const { width, height } = useWindowDimensions();
  const frameHeight = useFrameHeight();
  if (!framed) return <>{children}</>;
  const showAside = width >= 1100;

  return (
    <View style={{ flex: 1, backgroundColor: brand.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
        <Defs>
          <RadialGradient id="frameGlow" cx="62%" cy="38%" r="55%">
            <Stop offset="0" stopColor={brand.volt} stopOpacity={0.09} />
            <Stop offset="1" stopColor={brand.ink} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#frameGlow)" />
      </Svg>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 88 }}>
        {showAside ? (
          <ForceTheme scheme="dark">
            <View style={{ width: 420, gap: 28 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <LogoMark size={40} color={brand.bone} dot={brand.volt} />
                <Text weight="heavy" size={32} color={brand.bone} style={{ letterSpacing: -1.6 }}>
                  ritual
                  <Text weight="heavy" size={32} color={brand.volt}>
                    .
                  </Text>
                </Text>
              </View>
              <Text weight="heavy" size={52} color={brand.bone} style={{ lineHeight: 54, letterSpacing: -2.4 }}>
                Habits that{'\n'}track themselves.
              </Text>
              <View style={{ gap: 18 }}>
                {POINTS.map((p) => (
                  <View key={p.title} style={{ flexDirection: 'row', gap: 14 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 11,
                        backgroundColor: 'rgba(212,255,63,0.12)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name={p.icon} size={18} color={brand.volt} weight="fill" />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="bodyStrong" color={brand.bone}>
                        {p.title}
                      </Text>
                      <Text variant="caption" color="#8F8F8A">
                        {p.body}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Tap
                  onPress={() => Linking.openURL('https://github.com/Apurba2509/Ritual')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    height: 40,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: '#1C1C1E',
                  }}
                >
                  <Icon name="github-logo" size={18} color={brand.bone} weight="fill" />
                  <Text variant="caption" weight="semibold" color={brand.bone}>
                    Source on GitHub
                  </Text>
                </Tap>
                <Text variant="caption" color="#5C5C57">
                  Expo SDK 57 · React Native · Firebase · Gemini
                </Text>
              </View>
            </View>
          </ForceTheme>
        ) : null}
        <View
          style={{
            width: FRAME_WIDTH,
            height: frameHeight,
            borderRadius: 44,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
            boxShadow: '0px 40px 120px rgba(0,0,0,0.6)',
          }}
        >
          {children}
        </View>
      </View>
    </View>
  );
}
