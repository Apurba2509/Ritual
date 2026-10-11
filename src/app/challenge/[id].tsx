import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { diffDays, fromDayKey, todayKey } from '@/domain/dates';
import { useSession } from '@/data/session';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { friendlyError } from '@/lib/errors';
import { formatAmount } from '@/features/habits/format';
import { challengeMembers, getChallenge, joinChallenge, leaveChallenge } from '@/features/social/api';
import { Challenge, ChallengeMember } from '@/features/social/types';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Meter } from '@/ui/charts';
import { Pill } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { Screen, Section } from '@/ui/Screen';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { alpha, useTheme } from '@/ui/theme';

export default function ChallengeScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useSession((s) => s.user?.uid);
  const linkedHabit = useApp((s) => Object.values(s.habits).find((h) => h.challengeId === id && !h.deleted));
  const [c, setC] = useState<Challenge | null | undefined>(undefined);
  const [members, setMembers] = useState<ChallengeMember[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getChallenge(id)
      .then(setC)
      .catch(() => setC(null));
    challengeMembers(id)
      .then(setMembers)
      .catch(() => {});
  }, [id]);
  useEffect(load, [load]);

  if (c === null) {
    return (
      <Screen back>
        <EmptyState emoji="🏁" title="Challenge not found" body="It may have been removed." />
      </Screen>
    );
  }
  if (!c) {
    return (
      <Screen back>
        <Text tone="muted" align="center">
          Loading…
        </Text>
      </Screen>
    );
  }

  const today = todayKey();
  const started = today >= c.startDate;
  const ended = today > c.endDate;
  const dayN = Math.min(c.durationDays, Math.max(0, diffDays(c.startDate, today) + 1));
  const joined = !!linkedHabit || members.some((m) => m.uid === uid);

  const join = async () => {
    if (!uid) return router.push('/account');
    setBusy(true);
    try {
      await joinChallenge(c);
      toast(`You're in! "${c.title}" is on your Today list`, { emoji: c.emoji, tone: 'success' });
      load();
    } catch (e) {
      toast(friendlyError(e, 'Could not join'), { tone: 'error' });
    }
    setBusy(false);
  };

  const leave = async () => {
    setBusy(true);
    try {
      await leaveChallenge(c);
      toast('Left the challenge — the habit stays on your list', { emoji: '👋' });
      load();
    } catch (e) {
      toast(friendlyError(e, 'Could not leave'), { tone: 'error' });
    }
    setBusy(false);
  };

  return (
    <Screen back>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(c.color, 0.16),
            borderWidth: 1.5,
            borderColor: alpha(c.color, 0.5),
          }}
        >
          <Text size={44}>{c.emoji}</Text>
        </View>
        <Text variant="title" align="center">
          {c.title}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Pill label={`${c.durationDays} days`} color={c.color} icon="calendar" />
          <Pill
            label={c.kind === 'check' ? 'Daily check-in' : `${formatAmount(c, c.target)} / day`}
            color={c.color}
            icon="target"
          />
          <Pill label={`${c.memberCount} joined`} color={c.color} icon="users" />
        </View>
        {c.description ? (
          <Text tone="muted" align="center">
            {c.description}
          </Text>
        ) : null}
        <Text variant="caption" tone="faint">
          {ended
            ? 'Finished'
            : started
              ? `Day ${dayN} of ${c.durationDays}`
              : `Starts ${fromDayKey(c.startDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`}{' '}
          · by {c.creatorName}
        </Text>
      </View>

      {started && !ended ? <Meter ratio={dayN / c.durationDays} color={c.color} /> : null}

      {joined ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            title="Invite"
            icon="share-2"
            style={{ flex: 1 }}
            onPress={() =>
              Share.share({
                message: `Join my "${c.title}" challenge on Ritual ${c.emoji}\n${Linking.createURL(`/challenge/${c.id}`)}`,
              })
            }
          />
          {linkedHabit ? (
            <Button
              title="My habit"
              variant="secondary"
              icon="arrow-right"
              style={{ flex: 1 }}
              onPress={() => router.push(`/habit/${linkedHabit.id}`)}
            />
          ) : null}
        </View>
      ) : (
        <Button
          title={ended ? 'Challenge ended' : 'Join challenge'}
          icon="flag"
          size="lg"
          full
          loading={busy}
          disabled={ended}
          onPress={join}
        />
      )}

      <Section title="Leaderboard">
        <Card padded={false} style={{ padding: 6 }}>
          {members.length === 0 ? (
            <Text tone="muted" align="center" style={{ padding: 16 }}>
              Be the first to join.
            </Text>
          ) : (
            members.map((m, i) => (
              <Tap
                key={m.uid}
                onPress={() => m.uid !== uid && router.push(`/user/${m.uid}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 10,
                  borderRadius: 14,
                  backgroundColor: m.uid === uid ? alpha(t.accent, 0.1) : 'transparent',
                }}
              >
                <Text variant="bodyStrong" tone="muted" style={{ width: 24, textAlign: 'center' }}>
                  {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                </Text>
                <Avatar emoji={m.avatar?.emoji} color={m.avatar?.color} photoUrl={m.avatar?.photoUrl} size={36} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{m.uid === uid ? 'You' : m.displayName}</Text>
                  <Text variant="caption" tone="muted">
                    🔥 {m.streak} streak
                  </Text>
                </View>
                <Text variant="number" size={18}>
                  {m.daysDone}
                  <Text variant="caption" tone="faint">
                    /{c.durationDays}
                  </Text>
                </Text>
              </Tap>
            ))
          )}
        </Card>
      </Section>

      {joined && !ended ? <Button title="Leave challenge" variant="ghost" loading={busy} onPress={leave} /> : null}
    </Screen>
  );
}
