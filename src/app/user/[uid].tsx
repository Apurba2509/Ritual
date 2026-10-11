import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
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
import { isIconName } from '@/ui/Icon';
import { useTheme } from '@/ui/theme';

const NUDGES = ['Don’t break the streak!', 'You got this', 'Race you to a perfect day', 'Proud of you'];

export default function UserScreen() {
  const t = useTheme();
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
        <EmptyState icon="magnifying-glass" title="User not found" />
      </Screen>
    );
  }
  if (!profile) {
    return (
      <Screen back>
        <ActivityIndicator color={t.textMuted} style={{ marginTop: 80 }} />
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
        <Avatar photoUrl={profile.avatar?.photoUrl} name={profile.displayName} seed={profile.uid} size={92} />
        <View style={{ alignItems: 'center' }}>
          <Text variant="title">{profile.displayName}</Text>
          <Text variant="caption" tone="muted">
            @{profile.username}
          </Text>
        </View>
        <Pill
          label={`${rank.title} · Level ${profile.level}`}
          color={t.accentInk}
          icon={isIconName(rank.icon) ? rank.icon : 'sparkle'}
        />
        {profile.bio ? (
          <Text tone="muted" align="center">
            {profile.bio}
          </Text>
        ) : null}
      </View>

      <Card padded={false} style={{ flexDirection: 'row', paddingVertical: 16 }}>
        {[
          { label: 'Best streak', value: profile.streak },
          { label: 'Check-ins', value: profile.totalCompletions },
          { label: 'Badges', value: profile.achievements },
        ].map((s, i) => (
          <View
            key={s.label}
            style={{
              flex: 1,
              gap: 4,
              paddingHorizontal: 14,
              borderRightWidth: i < 2 ? 1 : 0,
              borderRightColor: t.border,
            }}
          >
            <Text weight="bold" size={26} tabular>
              {s.value.toLocaleString()}
            </Text>
            <Text variant="caption" tone="muted">
              {s.label}
            </Text>
          </View>
        ))}
      </Card>

      {me && me !== uid ? (
        isFriend ? (
          <Section title="Send a nudge">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {NUDGES.map((n) => (
                <Chip key={n} label={n} onPress={() => run(() => sendNudge(uid, n), 'Nudge sent')} />
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
          <EmptyState compact icon="hands-clapping" title="Nothing yet" body="Milestones and badges show up here." />
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
