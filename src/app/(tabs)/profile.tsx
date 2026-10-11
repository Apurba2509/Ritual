import { router } from 'expo-router';
import { useMemo } from 'react';
import { Share, View } from 'react-native';
import { ACHIEVEMENTS, TIER_COLORS } from '@/domain/achievements';
import { rankForLevel, RANKS } from '@/domain/xp';
import { useHabitList, useSnapshot } from '@/data/hooks';
import { useSession } from '@/data/session';
import { useApp } from '@/data/store';
import { useSyncStatus } from '@/data/sync';
import { timeAgo } from '@/features/habits/format';
import { isFirebaseConfigured } from '@/lib/firebase';
import { Avatar } from '@/ui/Avatar';
import { IconButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Meter } from '@/ui/charts';
import { Pill } from '@/ui/Chip';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Screen, Section } from '@/ui/Screen';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { alpha, radius, useTheme } from '@/ui/theme';

export default function ProfileScreen() {
  const t = useTheme();
  const snapshot = useSnapshot();
  const profile = useApp((s) => s.profile);
  const unlocked = useApp((s) => s.unlocked);
  const integrations = useApp((s) => s.integrations);
  const user = useSession((s) => s.user);
  const sync = useSyncStatus();
  const archived = useHabitList({ archived: true });
  const rank = rankForLevel(snapshot.level.level);
  const nextRank = RANKS.find((r) => r.minLevel > snapshot.level.level);

  const recent = useMemo(
    () =>
      ACHIEVEMENTS.filter((a) => unlocked[a.id])
        .sort((a, b) => unlocked[b.id] - unlocked[a.id])
        .slice(0, 6),
    [unlocked],
  );
  const connected = [integrations.github, integrations.leetcode, integrations.health].filter(Boolean).length;

  return (
    <Screen
      bottomInset={110}
      title="You"
      right={<IconButton name="settings" accessibilityLabel="Settings" onPress={() => router.push('/settings')} />}
    >
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 22 }}>
        <Tap onPress={() => router.push('/account')} scaleTo={0.94} accessibilityLabel="Edit profile">
          <Avatar
            emoji={profile.avatar.emoji}
            color={profile.avatar.color}
            photoUrl={profile.avatar.photoUrl}
            size={84}
            ring={rank.color}
          />
        </Tap>
        <View style={{ alignItems: 'center' }}>
          <Text variant="title">{profile.displayName || 'Ritualist'}</Text>
          <Text variant="caption" tone="muted">
            {profile.username ? `@${profile.username}` : user ? 'Pick a username' : 'Guest · data stays on this device'}
          </Text>
        </View>
        <Pill label={`${rank.emoji} ${rank.title} · Level ${snapshot.level.level}`} color={rank.color} />
        <View style={{ alignSelf: 'stretch', gap: 6, marginTop: 6 }}>
          <Meter ratio={snapshot.level.ratio} color={t.xp} height={10} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" tone="muted">
              {snapshot.xp.toLocaleString()} XP
            </Text>
            <Text variant="caption" tone="muted">
              {snapshot.level.toNext.toLocaleString()} to level {snapshot.level.level + 1}
              {nextRank && nextRank.minLevel === snapshot.level.level + 1
                ? ` · ${nextRank.emoji} ${nextRank.title}`
                : ''}
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[
          { label: 'Check-ins', value: snapshot.totalCompletions, emoji: '✅' },
          { label: 'Best streak', value: snapshot.achievementStats.bestStreakDays, emoji: '🔥' },
          { label: 'Perfect days', value: snapshot.perfectDays, emoji: '🌟' },
        ].map((s) => (
          <Card key={s.label} style={{ flex: 1, padding: 12, alignItems: 'center', gap: 2 }}>
            <Text size={16}>{s.emoji}</Text>
            <Text variant="number" size={22}>
              {s.value}
            </Text>
            <Text variant="caption" tone="muted" size={11}>
              {s.label}
            </Text>
          </Card>
        ))}
      </View>

      <Section
        title={`Achievements · ${recent.length ? Object.keys(unlocked).length : 0}/${ACHIEVEMENTS.length}`}
        action={
          <Tap onPress={() => router.push('/achievements')}>
            <Text variant="caption" tone="accent" style={{ fontFamily: 'Inter_600SemiBold' }}>
              See all
            </Text>
          </Tap>
        }
      >
        <Card onPress={() => router.push('/achievements')} style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {recent.length ? (
            recent.map((a) => (
              <View
                key={a.id}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: alpha(TIER_COLORS[a.tier], 0.16),
                  borderWidth: 1,
                  borderColor: alpha(TIER_COLORS[a.tier], 0.45),
                }}
              >
                <Text size={24}>{a.emoji}</Text>
              </View>
            ))
          ) : (
            <Text tone="muted">Complete your first habit to earn a badge.</Text>
          )}
        </Card>
      </Section>

      <ListGroup>
        <ListRow
          icon="zap"
          iconColor={t.xp}
          title="Auto-tracking"
          subtitle={
            connected ? `${connected} source${connected > 1 ? 's' : ''} connected` : 'GitHub, LeetCode, Health Connect'
          }
          onPress={() => router.push('/integrations')}
        />
        <ListRow
          icon="compass"
          iconColor={t.xp}
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
          icon="share-2"
          title="Invite friends"
          onPress={() =>
            Share.share({
              message: profile.username
                ? `I'm building habits on Ritual — add me: @${profile.username} 🔥`
                : 'Check out Ritual — the habit tracker that tracks itself 🔥',
            })
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
            icon="cloud"
            iconColor={t.success}
            title={isFirebaseConfigured ? 'Create a free account' : 'Cloud sync unavailable'}
            subtitle={
              isFirebaseConfigured ? 'Back up, sync devices, add friends' : 'Add Firebase config to enable accounts'
            }
            onPress={isFirebaseConfigured ? () => router.push('/account') : undefined}
            last
          />
        )}
      </ListGroup>

      {user ? (
        <Text variant="caption" tone="faint" align="center">
          {sync.status === 'syncing'
            ? 'Syncing…'
            : sync.status === 'offline'
              ? 'Offline — changes will sync when you reconnect'
              : sync.status === 'error'
                ? `Sync issue: ${sync.error}`
                : sync.lastSyncAt
                  ? `Synced ${timeAgo(sync.lastSyncAt)}`
                  : 'Cloud sync on'}
        </Text>
      ) : null}
    </Screen>
  );
}
