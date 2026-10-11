import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { rankForLevel } from '@/domain/xp';
import { useSession } from '@/data/session';
import { toast } from '@/data/ui';
import { friendlyError } from '@/lib/errors';
import { getProfile, removeFriendship, sendFriendRequest, sendNudge, toActivity } from '@/features/social/api';
import { ActivityCard } from '@/features/social/components';
import { useSocial } from '@/features/social/live';
import { Activity, pairId, PublicProfile } from '@/features/social/types';
import { requireFirebase } from '@/lib/firebase';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip, Pill } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { Screen, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';

const NUDGES = ['Don’t break the streak! 🔥', 'You got this 💪', 'Race you to a perfect day 🏁', 'Proud of you 🙌'];

export default function UserScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const me = useSession((s) => s.user?.uid);
  const friendship = useSocial((s) => s.friendships.find((f) => me && f.id === pairId(me, uid)));
  const cached = useSocial((s) => s.profiles[uid]);
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(cached);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getProfile(uid)
      .then(setProfile)
      .catch(() => setProfile(null));
    const { db } = requireFirebase();
    getDocs(query(collection(db, 'activity'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(15)))
      .then((snap) => setActivity(snap.docs.map((d) => toActivity(d.id, d.data()))))
      .catch(() => {});
  }, [uid]);

  if (profile === null) {
    return (
      <Screen back>
        <EmptyState emoji="🫥" title="User not found" />
      </Screen>
    );
  }
  if (!profile) {
    return (
      <Screen back>
        <Text tone="muted" align="center">
          Loading…
        </Text>
      </Screen>
    );
  }

  const rank = rankForLevel(profile.level);
  const isFriend = friendship?.status === 'accepted';

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      toast(msg, { tone: 'success' });
    } catch (e) {
      toast(friendlyError(e, 'Something went wrong'), { tone: 'error' });
    }
    setBusy(false);
  };

  return (
    <Screen back>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Avatar
          emoji={profile.avatar.emoji}
          color={profile.avatar.color}
          photoUrl={profile.avatar.photoUrl}
          size={88}
          ring={rank.color}
        />
        <View style={{ alignItems: 'center' }}>
          <Text variant="title">{profile.displayName}</Text>
          <Text variant="caption" tone="muted">
            @{profile.username}
          </Text>
        </View>
        <Pill label={`${rank.emoji} ${rank.title} · Level ${profile.level}`} color={rank.color} />
        {profile.bio ? (
          <Text tone="muted" align="center">
            {profile.bio}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[
          { label: 'Best streak now', value: profile.streak, emoji: '🔥' },
          { label: 'Check-ins', value: profile.totalCompletions, emoji: '✅' },
          { label: 'Badges', value: profile.achievements, emoji: '🏅' },
        ].map((s) => (
          <Card key={s.label} style={{ flex: 1, padding: 12, alignItems: 'center', gap: 2 }}>
            <Text size={16}>{s.emoji}</Text>
            <Text variant="number" size={22}>
              {s.value}
            </Text>
            <Text variant="caption" tone="muted" size={11} align="center">
              {s.label}
            </Text>
          </Card>
        ))}
      </View>

      {me && me !== uid ? (
        isFriend ? (
          <Section title="Send a nudge">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {NUDGES.map((n) => (
                <Chip key={n} label={n} onPress={() => run(() => sendNudge(uid, n), 'Nudge sent 👋')} />
              ))}
            </View>
          </Section>
        ) : (
          <Button
            title={friendship ? (friendship.requester === me ? 'Request sent' : 'Accept request') : 'Add friend'}
            icon="user-plus"
            size="lg"
            full
            disabled={friendship?.requester === me}
            loading={busy}
            onPress={() => run(() => sendFriendRequest(uid), friendship ? 'You are now friends!' : 'Request sent')}
          />
        )
      ) : null}

      <Section title="Recent">
        {activity.length ? (
          <View style={{ gap: 10 }}>
            {activity.map((a) => (
              <ActivityCard key={a.id} item={a} />
            ))}
          </View>
        ) : (
          <Text tone="muted">No public activity yet.</Text>
        )}
      </Section>

      {isFriend ? (
        <Button
          title="Remove friend"
          variant="ghost"
          onPress={() => run(() => removeFriendship(friendship!.id), 'Removed')}
        />
      ) : null}
    </Screen>
  );
}
