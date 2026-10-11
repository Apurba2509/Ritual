import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useSession } from '@/data/session';
import { useApp } from '@/data/store';
import { globalLeaderboard, listChallenges } from '@/features/social/api';
import { ActivityCard, ChallengeCard, RankRow } from '@/features/social/components';
import { friendUids, useSocial } from '@/features/social/live';
import type { Challenge, PublicProfile } from '@/features/social/types';
import { isFirebaseConfigured } from '@/lib/firebase';
import { Button, IconButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Icon } from '@/ui/Icon';
import { Screen, Section } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';

type Tab = 'feed' | 'ranks' | 'challenges';

function GuestCTA() {
  return (
    <Screen title="Friends" bottomInset={110}>
      <EmptyState
        icon="users-three"
        title="Better together"
        body={
          isFirebaseConfigured
            ? 'Add friends, cheer their wins with kudos, climb weekly leaderboards and join challenges. Free account, one tap with Google.'
            : 'Social features need cloud sync, which isn’t configured in this build.'
        }
        action={isFirebaseConfigured ? 'Create free account' : undefined}
        actionIcon="arrow-right"
        onAction={() => router.push('/upgrade')}
      />
    </Screen>
  );
}

function Leaderboards() {
  const t = useTheme();
  const uid = useSession((s) => s.user?.uid)!;
  const friendships = useSocial((s) => s.friendships);
  const profiles = useSocial((s) => s.profiles);
  const [scope, setScope] = useState<'friends' | 'global'>('friends');
  const [period, setPeriod] = useState<'week' | 'all'>('week');
  const [global, setGlobal] = useState<PublicProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scope !== 'global') return;
    setGlobal(null);
    setError(null);
    globalLeaderboard(period)
      .then(setGlobal)
      .catch((e) => setError(e.message));
  }, [scope, period]);

  const list = useMemo(() => {
    const ids = new Set([uid, ...friendUids(uid, friendships)]);
    const source = scope === 'friends' ? Object.values(profiles).filter((p) => ids.has(p.uid)) : (global ?? []);
    return [...source].sort((a, b) => (period === 'week' ? b.weeklyXP - a.weeklyXP : b.xp - a.xp));
  }, [scope, period, profiles, friendships, global, uid]);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: 'friends', label: 'Friends' },
              { value: 'global', label: 'Global' },
            ]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'week', label: 'This week' },
              { value: 'all', label: 'All time' },
            ]}
          />
        </View>
      </View>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {error ? (
          <Text variant="caption" tone="danger" style={{ padding: 12 }}>
            {error}
          </Text>
        ) : list.length === 0 ? (
          <Text tone="muted" align="center" style={{ padding: 22 }}>
            {scope === 'global' && !global ? 'Loading…' : 'No one here yet.'}
          </Text>
        ) : (
          list.map((p, i) => (
            <RankRow
              key={p.uid}
              rank={i + 1}
              profile={p}
              me={p.uid === uid}
              value={period === 'week' ? p.weeklyXP : p.xp}
              label={period === 'week' ? 'XP this week' : 'XP'}
              last={i === list.length - 1}
            />
          ))
        )}
      </Card>
      {scope === 'friends' && list.length <= 1 ? (
        <Button
          title="Add friends to compete"
          icon="user-plus"
          variant="secondary"
          onPress={() => router.push('/friends')}
        />
      ) : null}
      <Text variant="caption" tone="faint" align="center">
        Weekly boards reset every Monday.
      </Text>
    </View>
  );
}

function Challenges() {
  const habits = useApp((s) => s.habits);
  const [items, setItems] = useState<Challenge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const joined = useMemo(
    () =>
      new Set(
        Object.values(habits)
          .filter((h) => h.challengeId && !h.deleted)
          .map((h) => h.challengeId!),
      ),
    [habits],
  );

  const load = useCallback(() => {
    listChallenges()
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  return (
    <View style={{ gap: 12 }}>
      <Button title="Start a challenge" icon="flag" full onPress={() => router.push('/challenge/new')} />
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
      {items === null ? (
        <Text tone="muted" align="center">
          Loading challenges…
        </Text>
      ) : items.length === 0 ? (
        <EmptyState
          icon="flag"
          compact
          title="No challenges yet"
          body="Start the first one. Friends can join from here or with a link."
        />
      ) : (
        items.map((c) => <ChallengeCard key={c.id} c={c} joined={joined.has(c.id)} />)
      )}
    </View>
  );
}

export default function SocialScreen() {
  const t = useTheme();
  const user = useSession((s) => s.user);
  const feed = useSocial((s) => s.feed);
  const friendships = useSocial((s) => s.friendships);
  const refreshProfiles = useSocial((s) => s.refreshProfiles);
  const [tab, setTab] = useState<Tab>('feed');
  const [refreshing, setRefreshing] = useState(false);

  if (!user) return <GuestCTA />;
  const incoming = friendships.filter((f) => f.status === 'pending' && f.requester !== user.uid).length;
  const friends = friendUids(user.uid, friendships).length;

  return (
    <Screen
      title="Friends"
      bottomInset={110}
      right={
        <IconButton
          name="user-plus"
          accessibilityLabel="Friends"
          badge={incoming > 0}
          onPress={() => router.push('/friends')}
        />
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await refreshProfiles();
            setRefreshing(false);
          }}
          tintColor={t.text}
        />
      }
    >
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'feed', label: 'Feed' },
          { value: 'ranks', label: 'Leaderboard' },
          { value: 'challenges', label: 'Challenges' },
        ]}
      />

      {tab === 'feed' ? (
        <Section>
          {incoming > 0 ? (
            <Card
              tone="accent"
              onPress={() => router.push('/friends')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <Icon name="hand-waving" size={22} color={t.onAccent} weight="fill" />
              <Text variant="bodyStrong" color={t.onAccent} style={{ flex: 1 }}>
                {incoming} friend request{incoming > 1 ? 's' : ''}
              </Text>
              <Text variant="caption" weight="bold" color={t.onAccent}>
                Review
              </Text>
            </Card>
          ) : null}
          {feed.length === 0 ? (
            <EmptyState
              icon="hands-clapping"
              title={friends ? 'Quiet for now' : 'Your feed is empty'}
              body={
                friends
                  ? 'Milestones, badges and level-ups from you and your friends show up here.'
                  : 'Add friends by username. Their streak milestones, badges and level-ups show up here for kudos.'
              }
              action={friends ? undefined : 'Find friends'}
              actionIcon="user-plus"
              onAction={() => router.push('/friends')}
            />
          ) : (
            <View style={{ gap: 10 }}>
              {feed.map((a) => (
                <ActivityCard key={a.id} item={a} />
              ))}
            </View>
          )}
        </Section>
      ) : null}

      {tab === 'ranks' ? <Leaderboards /> : null}
      {tab === 'challenges' ? <Challenges /> : null}
    </Screen>
  );
}
