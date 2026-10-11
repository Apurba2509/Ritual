import { router } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '@/data/session';
import { timeAgo } from '@/features/habits/format';
import { Avatar } from '@/ui/Avatar';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { alpha, useTheme } from '@/ui/theme';
import { toggleKudos } from './api';
import type { Activity, Challenge, PublicProfile } from './types';

export function ActivityCard({ item }: { item: Activity }) {
  const t = useTheme();
  const uid = useSession((s) => s.user?.uid);
  const mine = item.uid === uid;
  const gave = !!uid && item.kudos.includes(uid);
  return (
    <Card style={{ flexDirection: 'row', gap: 12 }}>
      <Tap onPress={() => !mine && router.push(`/user/${item.uid}`)} scaleTo={0.92}>
        <Avatar emoji={item.avatar?.emoji} color={item.avatar?.color} photoUrl={item.avatar?.photoUrl} size={42} />
      </Tap>
      <View style={{ flex: 1, gap: 4 }}>
        <Text>
          <Text variant="bodyStrong">{mine ? 'You' : item.displayName}</Text> <Text tone="muted">{item.text}</Text>{' '}
          {item.emoji}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text variant="caption" tone="faint">
            {timeAgo(item.createdAt)}
          </Text>
          {mine && item.kudos.length === 0 ? null : (
            <Tap
              onPress={() => !mine && toggleKudos(item).catch(() => {})}
              disabled={mine}
              haptics="light"
              scaleTo={0.85}
              hitSlop={8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                height: 24,
                borderRadius: 12,
                backgroundColor: gave ? alpha(t.accent, 0.18) : t.surface2,
              }}
              accessibilityLabel={gave ? 'Remove kudos' : 'Give kudos'}
            >
              <Text size={12}>🔥</Text>
              <Text
                variant="caption"
                size={11}
                color={gave ? t.accent : t.textMuted}
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                {item.kudos.length || (mine ? '' : 'Kudos')}
              </Text>
            </Tap>
          )}
        </View>
      </View>
    </Card>
  );
}

export function RankRow({
  rank,
  profile,
  value,
  label,
  me,
}: {
  rank: number;
  profile: PublicProfile;
  value: number;
  label: string;
  me: boolean;
}) {
  const t = useTheme();
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  return (
    <Tap
      onPress={() => !me && router.push(`/user/${profile.uid}`)}
      scaleTo={0.985}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: me ? alpha(t.accent, 0.1) : 'transparent',
        borderWidth: me ? 1 : 0,
        borderColor: alpha(t.accent, 0.35),
      }}
    >
      <View style={{ width: 28, alignItems: 'center' }}>
        {medal ? (
          <Text size={20}>{medal}</Text>
        ) : (
          <Text variant="bodyStrong" tone="muted">
            {rank}
          </Text>
        )}
      </View>
      <Avatar emoji={profile.avatar.emoji} color={profile.avatar.color} photoUrl={profile.avatar.photoUrl} size={38} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {me ? 'You' : profile.displayName}
        </Text>
        <Text variant="caption" tone="muted">
          Lv {profile.level} · 🔥 {profile.streak}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="number" size={18}>
          {value.toLocaleString()}
        </Text>
        <Text variant="caption" tone="faint" size={10}>
          {label}
        </Text>
      </View>
    </Tap>
  );
}

export function ChallengeCard({ c, joined }: { c: Challenge; joined: boolean }) {
  const t = useTheme();
  return (
    <Card
      onPress={() => router.push(`/challenge/${c.id}`)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
    >
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(c.color, 0.16),
          borderWidth: 1,
          borderColor: alpha(c.color, 0.4),
        }}
      >
        <Text size={24}>{c.emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading" numberOfLines={1}>
          {c.title}
        </Text>
        <Text variant="caption" tone="muted">
          {c.durationDays} days · {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}
        </Text>
      </View>
      {joined ? (
        <Icon name="check-circle" size={20} color={t.success} />
      ) : (
        <Icon name="chevron-right" size={18} color={t.textFaint} />
      )}
    </Card>
  );
}
