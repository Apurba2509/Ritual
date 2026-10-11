import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { useSession } from '@/data/session';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { friendlyError } from '@/lib/errors';
import {
  acceptFriend,
  findByUsername,
  markInboxRead,
  removeFriendship,
  sendFriendRequest,
} from '@/features/social/api';
import { useSocial } from '@/features/social/live';
import type { PublicProfile } from '@/features/social/types';
import { timeAgo } from '@/features/habits/format';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Screen, Section } from '@/ui/Screen';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

function PersonRow({ p, right, sub }: { p: PublicProfile | undefined; right?: React.ReactNode; sub?: string }) {
  if (!p) return null;
  return (
    <Card
      onPress={() => router.push(`/user/${p.uid}`)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}
    >
      <Avatar emoji={p.avatar.emoji} color={p.avatar.color} photoUrl={p.avatar.photoUrl} size={42} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{p.displayName}</Text>
        <Text variant="caption" tone="muted">
          {sub ?? `@${p.username} · Lv ${p.level} · 🔥 ${p.streak}`}
        </Text>
      </View>
      {right}
    </Card>
  );
}

export default function FriendsScreen() {
  const uid = useSession((s) => s.user?.uid);
  const username = useApp((s) => s.profile.username);
  const friendships = useSocial((s) => s.friendships);
  const profiles = useSocial((s) => s.profiles);
  const inbox = useSocial((s) => s.inbox);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<PublicProfile | null | undefined>(undefined);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const unread = inbox.filter((i) => !i.read).map((i) => i.id);
    if (unread.length) markInboxRead(unread);
  }, [inbox]);

  if (!uid) {
    return (
      <Screen back title="Friends">
        <EmptyState
          emoji="🤝"
          title="Sign in to add friends"
          action="Create account"
          onAction={() => router.replace('/account')}
        />
      </Screen>
    );
  }

  const other = (ids: [string, string]) => ids.find((u) => u !== uid)!;
  const incoming = friendships.filter((f) => f.status === 'pending' && f.requester !== uid);
  const outgoing = friendships.filter((f) => f.status === 'pending' && f.requester === uid);
  const friends = friendships.filter((f) => f.status === 'accepted');

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResult(await findByUsername(query));
    } catch (e) {
      toast(friendlyError(e, 'Search failed'), { tone: 'error' });
    }
    setSearching(false);
  };

  const act = async (key: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    try {
      await fn();
      if (success) toast(success, { tone: 'success' });
      useSocial.getState().refreshProfiles();
    } catch (e) {
      toast(friendlyError(e, 'Something went wrong'), { tone: 'error' });
    }
    setBusy(null);
  };

  const existing = result ? friendships.find((f) => f.uids.includes(result.uid)) : undefined;

  return (
    <Screen back title="Friends">
      <Card tone="raised" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="muted">
            Your username
          </Text>
          <Text variant="subheading">@{username ?? '—'}</Text>
        </View>
        <Button
          title="Copy"
          size="sm"
          variant="secondary"
          icon="copy"
          onPress={async () => {
            if (!username) return;
            await Clipboard.setStringAsync(username);
            toast('Copied', { emoji: '📋' });
          }}
        />
        <Button
          title="Share"
          size="sm"
          icon="share"
          onPress={() => Share.share({ message: `Add me on Ritual: @${username} 🔥` })}
        />
      </Card>

      <TextField
        icon="search"
        value={query}
        onChangeText={(v) => {
          setQuery(v.toLowerCase().replace(/\s/g, ''));
          setResult(undefined);
        }}
        placeholder="Find by username"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={search}
        right={
          query ? (
            <Tap onPress={search} hitSlop={8}>
              <Text variant="bodyStrong" tone="accent">
                {searching ? '…' : 'Search'}
              </Text>
            </Tap>
          ) : null
        }
      />
      {result === null ? (
        <Text variant="caption" tone="muted" align="center">
          No one with that username.
        </Text>
      ) : result ? (
        <PersonRow
          p={result}
          right={
            result.uid === uid ? (
              <Text variant="caption" tone="faint">
                That’s you
              </Text>
            ) : existing?.status === 'accepted' ? (
              <Text variant="caption" tone="success">
                Friends ✓
              </Text>
            ) : existing && existing.requester === uid ? (
              <Text variant="caption" tone="muted">
                Requested
              </Text>
            ) : (
              <Button
                title={existing ? 'Accept' : 'Add'}
                size="sm"
                icon="user-plus"
                loading={busy === 'add'}
                onPress={() =>
                  act('add', () => sendFriendRequest(result.uid), existing ? 'You are now friends!' : 'Request sent')
                }
              />
            )
          }
        />
      ) : null}

      {incoming.length ? (
        <Section title="Requests">
          <View style={{ gap: 8 }}>
            {incoming.map((f) => (
              <PersonRow
                key={f.id}
                p={profiles[other(f.uids)]}
                sub={`wants to be friends · ${timeAgo(f.createdAt)}`}
                right={
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Button
                      title="Accept"
                      size="sm"
                      loading={busy === f.id}
                      onPress={() => act(f.id, () => acceptFriend(f.id), 'New friend!')}
                    />
                    <Button
                      title="✕"
                      size="sm"
                      variant="ghost"
                      onPress={() => act(`x${f.id}`, () => removeFriendship(f.id))}
                    />
                  </View>
                }
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title={`Friends · ${friends.length}`}>
        {friends.length ? (
          <View style={{ gap: 8 }}>
            {friends.map((f) => (
              <PersonRow key={f.id} p={profiles[other(f.uids)]} />
            ))}
          </View>
        ) : (
          <Card tone="outline">
            <Text tone="muted" align="center">
              Search a username above, or share yours. Friends see your milestones and can cheer you on.
            </Text>
          </Card>
        )}
      </Section>

      {outgoing.length ? (
        <Section title="Pending">
          <View style={{ gap: 8 }}>
            {outgoing.map((f) => (
              <PersonRow
                key={f.id}
                p={profiles[other(f.uids)]}
                sub="Request sent"
                right={
                  <Button
                    title="Cancel"
                    size="sm"
                    variant="ghost"
                    onPress={() => act(f.id, () => removeFriendship(f.id))}
                  />
                }
              />
            ))}
          </View>
        </Section>
      ) : null}

      {inbox.length ? (
        <Section title="Inbox">
          <View style={{ gap: 8 }}>
            {inbox.slice(0, 15).map((i) => (
              <Card key={i.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12 }}>
                <Avatar
                  emoji={i.fromAvatar?.emoji}
                  color={i.fromAvatar?.color}
                  photoUrl={i.fromAvatar?.photoUrl}
                  size={34}
                />
                <Text variant="caption" style={{ flex: 1 }}>
                  <Text variant="caption" style={{ fontFamily: 'Inter_600SemiBold' }}>
                    {i.fromName}
                  </Text>{' '}
                  {i.text}
                </Text>
                <Text variant="caption" tone="faint" size={11} numberOfLines={1} style={{ flexShrink: 0 }}>
                  {timeAgo(i.createdAt)}
                </Text>
              </Card>
            ))}
          </View>
        </Section>
      ) : null}
    </Screen>
  );
}
