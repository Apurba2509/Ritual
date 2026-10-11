import { router } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '@/data/session';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { timeAgo } from '@/features/habits/format';
import { Avatar } from '@/ui/Avatar';
import { Card } from '@/ui/Card';
import { Icon, IconName } from '@/ui/Icon';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { radius, useTheme } from '@/ui/theme';
import { toggleKudos } from './api';
import type { Activity, ActivityType, Challenge, PublicProfile } from './types';

const ACTIVITY_ICON: Record<ActivityType, IconName> = {
  milestone: 'fire',
  achievement: 'medal',
  level: 'lightning',
  perfect: 'star',
  challenge_join: 'flag',
  challenge_done: 'trophy',
  joined: 'hand-waving',
};

export function ActivityCard({ item }: { item: Activity }) {
  const t = useTheme();
  const uid = useSession((s) => s.user?.uid);
  const mine = item.uid === uid;
  const gave = !!uid && item.kudos.includes(uid);
  return (
    <Card style={{ flexDirection: 'row', gap: 12 }}>
      <Tap onPress={() => !mine && router.push(`/user/${item.uid}`)} scaleTo={0.92} disabled={mine}>
        <View>
          <Avatar photoUrl={item.avatar?.photoUrl} name={item.displayName} seed={item.uid} size={42} />
          <View
            style={{
              position: 'absolute',
              right: -4,
              bottom: -4,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: t.accent,
              borderWidth: 2.5,
              borderColor: t.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={ACTIVITY_ICON[item.type] ?? 'sparkle'} size={11} color={t.onAccent} weight="fill" />
          </View>
        </View>
      </Tap>
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={{ lineHeight: 21 }}>
          <Text variant="bodyStrong">{mine ? 'You' : item.displayName}</Text> <Text tone="muted">{item.text}</Text>
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
                gap: 5,
                paddingHorizontal: 10,
                height: 28,
                borderRadius: 14,
                backgroundColor: gave ? t.accent : t.surface2,
              }}
              accessibilityLabel={gave ? 'Remove kudos' : 'Give kudos'}
            >
              <Icon
                name="hands-clapping"
                size={14}
                color={gave ? t.onAccent : t.textMuted}
                weight={gave ? 'fill' : 'bold'}
              />
              <Text variant="small" color={gave ? t.onAccent : t.textMuted}>
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
  last,
}: {
  rank: number;
  profile: PublicProfile;
  value: number;
  label: string;
  me: boolean;
  last?: boolean;
}) {
  const t = useTheme();
  const podium = rank <= 3;
  return (
    <Tap
      onPress={() => !me && router.push(`/user/${profile.uid}`)}
      scaleTo={0.985}
      disabled={me}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: me ? t.accentSoft : 'transparent',
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.border,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: rank === 1 ? t.accent : podium ? t.surface3 : 'transparent',
        }}
      >
        <Text variant="caption" weight="bold" tabular color={rank === 1 ? t.onAccent : podium ? t.text : t.textMuted}>
          {rank}
        </Text>
      </View>
      <Avatar photoUrl={profile.avatar?.photoUrl} name={profile.displayName} seed={profile.uid} size={38} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {me ? 'You' : profile.displayName}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text variant="caption" tone="muted">
            Lv {profile.level}
          </Text>
          {profile.streak > 0 ? (
            <>
              <Text variant="caption" tone="faint">
                ·
              </Text>
              <Icon name="fire" size={11} color={t.textMuted} weight="fill" />
              <Text variant="caption" tone="muted" tabular>
                {profile.streak}
              </Text>
            </>
          ) : null}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text weight="bold" size={17} tabular>
          {value.toLocaleString()}
        </Text>
        <Text variant="small" size={10} tone="faint">
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
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
    >
      <HabitIcon icon={c.icon} color={c.color} size={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading" numberOfLines={1}>
          {c.title}
        </Text>
        <Text variant="caption" tone="muted">
          {c.durationDays} days · {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}
        </Text>
      </View>
      {joined ? (
        <View
          style={{
            paddingHorizontal: 10,
            height: 26,
            borderRadius: radius.pill,
            backgroundColor: t.accent,
            justifyContent: 'center',
          }}
        >
          <Text variant="small" color={t.onAccent}>
            Joined
          </Text>
        </View>
      ) : (
        <Icon name="caret-right" size={16} color={t.textFaint} />
      )}
    </Card>
  );
}
