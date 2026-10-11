import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ACHIEVEMENTS } from '@/domain/achievements';
import { rankForLevel, RANKS } from '@/domain/xp';
import { useHabitList, useSnapshot } from '@/data/hooks';
import { useSession } from '@/data/session';
import { useApp } from '@/data/store';
import { useSyncStatus } from '@/data/sync';
import { AchievementBadge } from '@/features/gamification/Badge';
import { timeAgo } from '@/features/habits/format';
import { isFirebaseConfigured } from '@/lib/firebase';
import { Avatar } from '@/ui/Avatar';
import { IconButton } from '@/ui/Button';
import { Meter } from '@/ui/charts';
import { Icon, isIconName } from '@/ui/Icon';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Screen, Section, SectionAction } from '@/ui/Screen';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { shareText } from '@/lib/share';

function Stat({ label, value, last }: { label: string; value: number; last?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{ flex: 1, gap: 4, paddingHorizontal: 14, borderRightWidth: last ? 0 : 1, borderRightColor: t.border }}
    >
      <Text weight="bold" size={26} tabular>
        {value.toLocaleString()}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const t = useTheme();
  const snapshot = useSnapshot();
  const profile = useApp((s) => s.profile);
  const unlocked = useApp((s) => s.unlocked);
  const integrations = useApp((s) => s.integrations);
  const demo = useApp((s) => s.demo);
  const user = useSession((s) => s.user);
  const sync = useSyncStatus();
  const archived = useHabitList({ archived: true });
  const rank = rankForLevel(snapshot.level.level);
  const nextRank = RANKS.find((r) => r.minLevel > snapshot.level.level);

  const badges = useMemo(() => {
    const earned = ACHIEVEMENTS.filter((a) => unlocked[a.id]).sort((a, b) => unlocked[b.id] - unlocked[a.id]);
    const locked = ACHIEVEMENTS.filter((a) => !unlocked[a.id]);
    return [...earned, ...locked].slice(0, 5);
  }, [unlocked]);
  const earnedCount = Object.keys(unlocked).length;
  const connected = [integrations.github, integrations.leetcode, integrations.health].filter(Boolean).length;

  return (
    <Screen
      bottomInset={110}
      title="You"
      right={<IconButton name="gear-six" accessibilityLabel="Settings" onPress={() => router.push('/settings')} />}
    >
      <View style={{ alignItems: 'center', gap: 12, paddingTop: 4 }}>
        <Tap onPress={() => router.push('/account')} scaleTo={0.94} accessibilityLabel="Edit profile">
          <Avatar photoUrl={profile.avatar.photoUrl} name={profile.displayName || 'You'} seed={user?.uid} size={92} />
          <View
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: t.surface3,
              borderWidth: 3,
              borderColor: t.bg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="pencil-simple" size={13} color={t.text} />
          </View>
        </Tap>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text variant="title">{profile.displayName || 'Your profile'}</Text>
          <Text variant="caption" tone="muted">
            {profile.username
              ? `@${profile.username}`
              : demo
                ? 'Sample profile'
                : user
                  ? 'Setting up your username…'
                  : 'Guest · data stays on this device'}
          </Text>
        </View>
      </View>

      {/* Level: big number, rank, XP to go */}
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text variant="caption" weight="semibold" tone="muted">
              Level
            </Text>
            <Text weight="heavy" size={56} tabular style={{ lineHeight: 58, letterSpacing: -2.4 }}>
              {snapshot.level.level}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4, paddingBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name={isIconName(rank.icon) ? rank.icon : 'sparkle'} size={16} color={t.text} weight="fill" />
              <Text variant="bodyStrong">{rank.title}</Text>
            </View>
            <Text variant="caption" tone="muted" tabular>
              {snapshot.xp.toLocaleString()} XP
            </Text>
          </View>
        </View>
        <Meter ratio={snapshot.level.ratio} height={6} />
        <Text variant="caption" tone="muted">
          {snapshot.level.toNext.toLocaleString()} XP to level {snapshot.level.level + 1}
          {nextRank && nextRank.minLevel === snapshot.level.level + 1 ? ` · unlocks ${nextRank.title}` : ''}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          paddingVertical: 16,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: t.borderStrong,
        }}
      >
        <Stat label="Check-ins" value={snapshot.totalCompletions} />
        <Stat label="Best streak" value={snapshot.achievementStats.bestStreakDays} />
        <Stat label="Perfect days" value={snapshot.perfectDays} last />
      </View>

      <Section
        title="Achievements"
        action={
          <SectionAction
            label={`${earnedCount}/${ACHIEVEMENTS.length} · See all`}
            onPress={() => router.push('/achievements')}
          />
        }
      >
        <Tap
          onPress={() => router.push('/achievements')}
          scaleTo={0.99}
          style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}
        >
          {badges.map((a) => (
            <AchievementBadge key={a.id} achievement={a} unlocked={!!unlocked[a.id]} size={52} />
          ))}
        </Tap>
      </Section>

      <ListGroup>
        <ListRow
          icon="lightning"
          title="Auto-tracking"
          subtitle={
            connected ? `${connected} source${connected > 1 ? 's' : ''} connected` : 'Phone sensors, GitHub, LeetCode'
          }
          onPress={() => router.push('/integrations')}
        />
        <ListRow
          icon="magic-wand"
          title="AI coach"
          subtitle="Turn a goal into a plan"
          onPress={() => router.push('/coach')}
        />
        <ListRow
          icon="archive"
          title="Archived habits"
          value={archived.length ? `${archived.length}` : undefined}
          onPress={() => router.push('/archive')}
        />
        <ListRow
          icon="share-network"
          title="Invite friends"
          onPress={() =>
            shareText(
              profile.username
                ? `I'm building habits on Ritual. Add me: @${profile.username} — https://ritual-37ccf.web.app`
                : 'Ritual — the habit tracker that tracks itself: https://ritual-37ccf.web.app',
            )
          }
          last
        />
      </ListGroup>

      <ListGroup>
        {user ? (
          <ListRow
            icon="user"
            title="Account"
            subtitle={user.email ?? undefined}
            onPress={() => router.push('/account')}
            last
          />
        ) : (
          <ListRow
            icon="cloud-check"
            iconColor={t.accentInk}
            title={
              demo ? 'Start your own ritual' : isFirebaseConfigured ? 'Create a free account' : 'Cloud sync unavailable'
            }
            subtitle={
              demo
                ? 'Clear the sample data and sign in'
                : isFirebaseConfigured
                  ? 'Back up, sync devices, add friends'
                  : 'Add Firebase config to enable accounts'
            }
            onPress={isFirebaseConfigured ? () => router.push('/upgrade') : undefined}
            last
          />
        )}
      </ListGroup>

      {user ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon
            name={sync.status === 'offline' || sync.status === 'error' ? 'cloud-slash' : 'cloud-check'}
            size={14}
            color={sync.status === 'error' ? t.danger : t.textFaint}
          />
          <Text variant="caption" tone="faint">
            {sync.status === 'syncing'
              ? 'Syncing…'
              : sync.status === 'offline'
                ? 'Offline. Changes sync when you reconnect'
                : sync.status === 'error'
                  ? `Sync issue: ${sync.error}`
                  : sync.lastSyncAt
                    ? `Synced ${timeAgo(sync.lastSyncAt)}`
                    : 'Cloud sync on'}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
