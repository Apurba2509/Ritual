import { useEffect, useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { ACHIEVEMENT_BY_ID, TIER_COLORS } from '@/domain/achievements';
import { rankForLevel } from '@/domain/xp';
import { Celebration, useUI } from '@/data/ui';
import { useApp } from '@/data/store';
import { haptic } from '@/lib/haptics';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Chip';
import { Text } from '@/ui/Text';
import { alpha, radius, useTheme, shadow } from '@/ui/theme';

function describe(c: Celebration) {
  switch (c.kind) {
    case 'milestone':
      return {
        emoji: c.emoji,
        eyebrow: 'Streak milestone',
        title: `${c.streak}-${c.unit} streak!`,
        body: `${c.habitName} — ${c.streak} ${c.unit}s without breaking the chain.`,
        xp: c.bonus,
        color: '#FF6A3D',
      };
    case 'achievement': {
      const a = ACHIEVEMENT_BY_ID.get(c.id);
      return {
        emoji: a?.emoji ?? '🏅',
        eyebrow: `${a?.tier ?? ''} achievement`,
        title: a?.title ?? 'Achievement',
        body: a?.description ?? '',
        xp: a?.xp ?? 0,
        color: a ? TIER_COLORS[a.tier] : '#F5C542',
      };
    }
    case 'level': {
      const rank = rankForLevel(c.level);
      return {
        emoji: rank.emoji,
        eyebrow: 'Level up',
        title: `Level ${c.level}`,
        body:
          rank.minLevel === c.level
            ? `New rank unlocked: ${rank.title}. Keep stacking days.`
            : `${rank.emoji} ${rank.title} · every check-in counts. Keep stacking days.`,
        xp: 0,
        color: rank.color,
      };
    }
    case 'perfect':
      return {
        emoji: '🌟',
        eyebrow: 'Perfect day',
        title: 'Flawless',
        body: `${c.streak} perfect day${c.streak > 1 ? 's' : ''} in a row.`,
        xp: 0,
        color: '#FBBF24',
      };
  }
}

export function CelebrationHost() {
  const t = useTheme();
  const current = useUI((s) => s.celebrations[0]);
  const shift = useUI((s) => s.shiftCelebration);
  const enabled = useApp((s) => s.settings.celebrations);
  const card = useRef<View>(null);
  const wobble = useSharedValue(0);

  useEffect(() => {
    if (!current) return;
    if (!enabled) {
      shift();
      return;
    }
    haptic.heavy();
    wobble.value = withSequence(withTiming(-8, { duration: 90 }), withSpring(0, { damping: 4, stiffness: 180 }));
  }, [current, enabled, shift, wobble]);

  const emojiStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wobble.value}deg` }] }));

  if (!current || !enabled) return null;
  const d = describe(current);

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
      <Animated.View entering={FadeIn.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }]}>
        <Pressable style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }} onPress={shift}>
          <Animated.View entering={ZoomIn.springify().damping(14)} style={{ width: '100%', maxWidth: 360 }}>
            <Pressable onPress={() => {}}>
              <View
                ref={card}
                collapsable={false}
                style={{
                  alignItems: 'center',
                  gap: 10,
                  padding: 28,
                  borderRadius: radius.xl,
                  backgroundColor: t.bgElevated,
                  borderWidth: 1,
                  borderColor: alpha(d.color, 0.45),
                  ...shadow(d.color, 0.45, 40, 10),
                }}
              >
                <View
                  style={{
                    width: 112,
                    height: 112,
                    borderRadius: 56,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: alpha(d.color, 0.16),
                    borderWidth: 2,
                    borderColor: alpha(d.color, 0.5),
                    marginBottom: 6,
                  }}
                >
                  <Animated.Text style={[{ fontSize: 56 }, emojiStyle]}>{d.emoji}</Animated.Text>
                </View>
                <Text variant="label" color={d.color}>
                  {d.eyebrow}
                </Text>
                <Text variant="title" align="center">
                  {d.title}
                </Text>
                <Text tone="muted" align="center">
                  {d.body}
                </Text>
                {d.xp > 0 ? <Pill label={`+${d.xp} XP`} color={t.xp} icon="zap" /> : null}
                <Text variant="caption" tone="faint" style={{ marginTop: 6 }}>
                  ritual · the habit tracker that tracks itself
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                {Platform.OS !== 'web' ? (
                  <Button title="Share" variant="secondary" icon="share" onPress={share} style={{ flex: 1 }} />
                ) : null}
                <Button title="Let's go" onPress={shift} style={{ flex: 1 }} />
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
