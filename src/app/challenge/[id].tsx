import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { diffDays, fromDayKey, todayKey } from '@/domain/dates';
import { useSession } from '@/data/session';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { friendlyError } from '@/lib/errors';
import { formatAmount } from '@/features/habits/format';
import { HabitIcon } from '@/features/habits/HabitIcon';
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
import { useTheme } from '@/ui/theme';
import { shareText } from '@/lib/share';

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
        <EmptyState icon="flag" title="Challenge not found" body="It may have been removed." />
      </Screen>
    );
  }
  if (!c) {
    return (
      <Screen back>
        <ActivityIndicator color={t.textMuted} style={{ marginTop: 80 }} />
      </Screen>
    );
  }

  const today = todayKey();
  const started = today >= c.startDate;
  const ended = today > c.endDate;
  const dayN = Math.min(c.durationDays, Math.max(0, diffDays(c.startDate, today) + 1));
  const joined = !!linkedHabit || members.some((m) => m.uid === uid);

  const join = async () => {
    if (!uid) return router.push('/upgrade');
    setBusy(true);
    try {
      await joinChallenge(c);
      toast(`You're in! "${c.title}" is on your Today list`, { icon: 'flag', tone: 'success' });
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
      toast('Left the challenge. The habit stays on your list', { icon: 'hand-waving' });
      load();
    } catch (e) {
      toast(friendlyError(e, 'Could not leave'), { tone: 'error' });
    }
    setBusy(false);
  };

  return (
    <Screen back>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <HabitIcon icon={c.icon} color={c.color} size={84} />
        <Text variant="title" align="center">
          {c.title}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Pill label={`${c.durationDays} days`} icon="calendar-blank" />
          <Pill label={c.kind === 'check' ? 'Daily check-in' : `${formatAmount(c, c.target)} / day`} icon="target" />
          <Pill label={`${c.memberCount} joined`} icon="users-three" />
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

      {started && !ended ? <Meter ratio={dayN / c.durationDays} height={8} /> : null}

      {joined ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            title="Invite"
            icon="share-network"
            style={{ flex: 1 }}
            onPress={() =>
              shareText(`Join my "${c.title}" challenge on Ritual\n${Linking.createURL(`/challenge/${c.id}`)}`)
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
        <Card padded={false} style={{ overflow: 'hidden' }}>
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
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: m.uid === uid ? t.accentSoft : 'transparent',
                  borderBottomWidth: i < members.length - 1 ? 1 : 0,
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
                    backgroundColor: i === 0 ? t.accent : i < 3 ? t.surface3 : 'transparent',
                  }}
                >
                  <Text variant="caption" weight="bold" color={i === 0 ? t.onAccent : i < 3 ? t.text : t.textMuted}>
                    {i + 1}
                  </Text>
                </View>
                <Avatar photoUrl={m.avatar?.photoUrl} name={m.displayName} seed={m.uid} size={36} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{m.uid === uid ? 'You' : m.displayName}</Text>
                  <Text variant="caption" tone="muted">
                    {m.streak}-day streak
                  </Text>
                </View>
                <Text weight="bold" size={18} tabular>
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
