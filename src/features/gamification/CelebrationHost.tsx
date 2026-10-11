import * as Sharing from 'expo-sharing';
import { useEffect, useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { ACHIEVEMENT_BY_ID } from '@/domain/achievements';
import { rankForLevel } from '@/domain/xp';
import { useApp } from '@/data/store';
import { Celebration, useUI } from '@/data/ui';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { haptic } from '@/lib/haptics';
import { Button } from '@/ui/Button';
import { Icon, isIconName } from '@/ui/Icon';
import { LogoMark } from '@/ui/Logo';
import { Text } from '@/ui/Text';
import { brand, ForceTheme, radius } from '@/ui/theme';
import { AchievementBadge } from './Badge';

const MUTED = '#8F8F8A';

/** The shareable card is always on-brand dark, whatever theme the app is in. */
function CardBody({ c }: { c: Celebration }) {
  switch (c.kind) {
    case 'milestone':
      return (
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text weight="heavy" size={112} color={brand.volt} tabular style={{ lineHeight: 116, letterSpacing: -6 }}>
            {c.streak}
          </Text>
          <Text weight="bold" size={22} color={brand.bone}>
            {c.unit} streak
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }}>
            <HabitIconDark icon={c.icon} color={c.color} />
            <Text variant="bodyStrong" color={brand.bone} numberOfLines={1}>
              {c.habitName}
            </Text>
          </View>
        </View>
      );
    case 'achievement': {
      const a = ACHIEVEMENT_BY_ID.get(c.id);
      if (!a) return null;
      return (
        <View style={{ alignItems: 'center', gap: 8 }}>
          <AchievementBadgeDark id={c.id} />
          <Text weight="heavy" size={30} color={brand.bone} align="center" style={{ marginTop: 10, letterSpacing: -1 }}>
            {a.title}
          </Text>
          <Text color={MUTED} align="center">
            {a.description}
          </Text>
        </View>
      );
    }
    case 'level': {
      const rank = rankForLevel(c.level);
      return (
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text variant="label" color={MUTED}>
            Level
          </Text>
          <Text weight="heavy" size={112} color={brand.volt} tabular style={{ lineHeight: 116, letterSpacing: -6 }}>
            {c.level}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <Icon name={isIconName(rank.icon) ? rank.icon : 'sparkle'} size={18} color={brand.bone} weight="fill" />
            <Text weight="bold" size={20} color={brand.bone}>
              {rank.title}
            </Text>
          </View>
        </View>
      );
    }
    case 'perfect':
      return (
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text weight="heavy" size={112} color={brand.volt} tabular style={{ lineHeight: 116, letterSpacing: -6 }}>
            {c.streak}
          </Text>
          <Text weight="bold" size={22} color={brand.bone}>
            perfect day{c.streak > 1 ? 's' : ''} in a row
          </Text>
        </View>
      );
  }
}

function HabitIconDark({ icon, color }: { icon: string; color: string }) {
  return <HabitIcon icon={icon} color={color} size={36} />;
}

function AchievementBadgeDark({ id }: { id: string }) {
  const a = ACHIEVEMENT_BY_ID.get(id);
  return a ? <AchievementBadge achievement={a} unlocked size={104} /> : null;
}

function eyebrow(c: Celebration) {
  switch (c.kind) {
    case 'milestone':
      return 'Streak milestone';
    case 'achievement':
      return `${ACHIEVEMENT_BY_ID.get(c.id)?.tier ?? ''} badge`;
    case 'level':
      return 'Level up';
    case 'perfect':
      return 'Perfect day';
  }
}

function xpFor(c: Celebration) {
  if (c.kind === 'milestone') return c.bonus;
  if (c.kind === 'achievement') return ACHIEVEMENT_BY_ID.get(c.id)?.xp ?? 0;
  return 0;
}

export function CelebrationHost() {
  const current = useUI((s) => s.celebrations[0]);
  const shift = useUI((s) => s.shiftCelebration);
  const enabled = useApp((s) => s.settings.celebrations);
  const card = useRef<View>(null);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!current) return;
    if (!enabled) {
      shift();
      return;
    }
    haptic.heavy();
    pulse.value = withSequence(withTiming(1.06, { duration: 140 }), withSpring(1, { damping: 6, stiffness: 160 }));
  }, [current, enabled, shift, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  if (!current || !enabled) return null;
  const xp = xpFor(current);

  const share = async () => {
    try {
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(uri, { dialogTitle: 'Share your win', mimeType: 'image/png' });
    } catch (e) {
      console.warn('[share]', e);
    }
  };

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={shift}>
      <ForceTheme scheme="dark">
        <Animated.View
          entering={FadeIn.duration(180)}
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.78)' }]}
        >
          <Pressable style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }} onPress={shift}>
            <Animated.View entering={ZoomIn.springify().damping(15)} style={{ width: '100%', maxWidth: 360 }}>
              <Pressable onPress={() => {}}>
                <Animated.View style={pulseStyle}>
                  <View
                    ref={card}
                    collapsable={false}
                    style={{
                      overflow: 'hidden',
                      borderRadius: radius.xl,
                      backgroundColor: brand.ink,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.1)',
                      padding: 24,
                      gap: 26,
                    }}
                  >
                    <Svg width="100%" height={340} style={{ position: 'absolute', top: -60, left: 0, right: 0 }}>
                      <Defs>
                        <RadialGradient id="cel" cx="50%" cy="50%" r="50%">
                          <Stop offset="0" stopColor={brand.volt} stopOpacity={0.2} />
                          <Stop offset="1" stopColor={brand.ink} stopOpacity={0} />
                        </RadialGradient>
                      </Defs>
                      <Rect x="0" y="0" width="100%" height="340" fill="url(#cel)" />
                    </Svg>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <LogoMark size={22} color={brand.bone} dot={brand.volt} />
                        <Text weight="heavy" size={17} color={brand.bone} style={{ letterSpacing: -0.9 }}>
                          ritual
                          <Text weight="heavy" size={17} color={brand.volt}>
                            .
                          </Text>
                        </Text>
                      </View>
                      <Text variant="label" color={MUTED}>
                        {eyebrow(current)}
                      </Text>
                    </View>

                    <CardBody c={current} />

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text variant="caption" color={MUTED}>
                        Habits that track themselves.
                      </Text>
                      {xp > 0 ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            paddingHorizontal: 10,
                            height: 26,
                            borderRadius: 13,
                            backgroundColor: brand.volt,
                          }}
                        >
                          <Icon name="lightning" size={12} color={brand.ink} weight="fill" />
                          <Text variant="small" color={brand.ink}>
                            +{xp} XP
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Animated.View>
                <Animated.View
                  entering={FadeInDown.delay(250)}
                  style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}
                >
                  {Platform.OS !== 'web' ? (
                    <Button title="Share" variant="secondary" icon="export" onPress={share} style={{ flex: 1 }} />
                  ) : null}
                  <Button title="Keep going" onPress={shift} style={{ flex: 1 }} />
                </Animated.View>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Animated.View>
      </ForceTheme>
    </Modal>
  );
}
