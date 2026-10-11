import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { sendEmailVerification } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { authErrorMessage, claimUsername, deleteAccount, normalizeUsername, USERNAME_RE } from '@/data/auth';
import { useSession } from '@/data/session';
import { useApp } from '@/data/store';
import { sync } from '@/data/sync';
import { toast } from '@/data/ui';
import { GoogleG } from '@/features/auth/GoogleButton';
import { pickAndUpload } from '@/features/habits/photo';
import { cloudinaryConfigured } from '@/lib/cloudinary';
import { firebase } from '@/lib/firebase';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { Screen, Section } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { useTheme } from '@/ui/theme';

export default function AccountScreen() {
  const t = useTheme();
  const user = useSession((s) => s.user);
  const profile = useApp((s) => s.profile);
  const [name, setName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  // Follow the stored profile when it changes underneath us (e.g. right after sign-up or a sync).
  useEffect(() => setName(profile.displayName), [profile.displayName]);
  useEffect(() => setUsername(profile.username ?? ''), [profile.username]);
  useEffect(() => setBio(profile.bio ?? ''), [profile.bio]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const params = useLocalSearchParams<{ delete?: string }>();
  const [deleteOpen, setDeleteOpen] = useState(params.delete === '1');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!user) return <Redirect href="/upgrade" />;

  const google = user.provider === 'google';
  const handle = normalizeUsername(username);
  const dirty =
    name.trim() !== profile.displayName || handle !== (profile.username ?? '') || (bio.trim() || null) !== profile.bio;

  const setPhoto = (photoUrl: string | null) => {
    useApp.getState().updateProfile({ avatar: { ...useApp.getState().profile.avatar, photoUrl } });
    sync.schedulePublish();
  };

  const changePhoto = async () => {
    setUploading(true);
    try {
      const url = await pickAndUpload('avatars', true);
      if (url) {
        setPhoto(url);
        toast('Profile photo updated', { icon: 'camera', tone: 'success' });
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed', { tone: 'error' });
    }
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      useApp.getState().updateProfile({ displayName: name.trim(), bio: bio.trim() || null });
      if (handle !== profile.username) {
        if (!USERNAME_RE.test(handle)) throw new Error('Usernames are 3–20 characters: letters, numbers, _ or .');
        await claimUsername(handle);
      }
      sync.schedulePublish();
      toast('Profile saved', { tone: 'success' });
      router.back();
    } catch (e) {
      toast(authErrorMessage(e), { tone: 'error' });
    }
    setSaving(false);
  };

  return (
    <>
      <Screen
        back
        title="Profile"
        footer={<Button title="Save changes" size="lg" full loading={saving} disabled={!dirty} onPress={save} />}
      >
        <View style={{ alignItems: 'center', gap: 14 }}>
          <Tap
            onPress={cloudinaryConfigured ? changePhoto : undefined}
            disabled={!cloudinaryConfigured || uploading}
            scaleTo={0.94}
            accessibilityLabel="Change profile photo"
          >
            <Avatar photoUrl={profile.avatar.photoUrl} name={name || profile.displayName} seed={user.uid} size={104} />
            {uploading ? (
              <View
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 52,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
            {cloudinaryConfigured ? (
              <View
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: t.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 3,
                  borderColor: t.bg,
                }}
              >
                <Icon name="camera" size={15} color={t.onAccent} weight="fill" />
              </View>
            ) : null}
          </Tap>
          {profile.avatar.photoUrl ? (
            <Button title="Remove photo" size="sm" variant="ghost" onPress={() => setPhoto(null)} />
          ) : cloudinaryConfigured ? (
            <Text variant="caption" tone="muted">
              Tap to add a photo
            </Text>
          ) : null}
        </View>

        <TextField label="Name" value={name} onChangeText={setName} maxLength={40} icon="user" />
        <TextField
          label="Username"
          value={username}
          onChangeText={(v) => setUsername(v.toLowerCase().replace(/\s/g, ''))}
          autoCapitalize="none"
          autoCorrect={false}
          icon="at"
          maxLength={20}
          error={username && !USERNAME_RE.test(handle) ? '3–20 characters: letters, numbers, _ or .' : null}
          hint="Friends find you with this."
        />
        <TextField
          label="Bio"
          value={bio}
          onChangeText={setBio}
          placeholder="Building one habit at a time"
          multiline
          maxLength={140}
        />

        <Section title="Sign-in">
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: google ? '#FFFFFF' : t.surface2,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {google ? <GoogleG size={18} /> : <Icon name="envelope-simple" size={18} color={t.text} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{google ? 'Google' : 'Email & password'}</Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
              {!google ? (
                <Text variant="caption" weight="semibold" tone={user.emailVerified ? 'accent' : 'muted'}>
                  {user.emailVerified ? 'Verified' : 'Unverified'}
                </Text>
              ) : null}
            </View>
            {!google && !user.emailVerified ? (
              <Button
                title="Resend verification email"
                size="sm"
                variant="secondary"
                onPress={async () => {
                  const u = firebase()?.auth.currentUser;
                  if (u) {
                    await sendEmailVerification(u).catch(() => {});
                    toast('Verification email sent', { icon: 'paper-plane-tilt' });
                  }
                }}
              />
            ) : null}
          </Card>
        </Section>

        <Section title="Danger zone">
          <Button title="Delete account" variant="danger" icon="trash" full onPress={() => setDeleteOpen(true)} />
          <Text variant="caption" tone="faint">
            Erases your profile, habits, history, workouts, friends and badges from Ritual’s servers and this device.
          </Text>
        </Section>
      </Screen>
      <Sheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your account?"
        subtitle="Every habit, check-in, friend and badge is permanently erased. This can’t be undone."
        footer={
          <Button
            title={google ? 'Confirm with Google & delete' : 'Delete forever'}
            variant="danger"
            full
            size="lg"
            loading={deleting}
            disabled={!google && !password}
            onPress={async () => {
              setDeleting(true);
              setDeleteError(null);
              try {
                await deleteAccount(google ? undefined : password);
                setDeleteOpen(false);
                toast('Account deleted', { icon: 'hand-waving' });
              } catch (e) {
                setDeleteError(authErrorMessage(e));
              }
              setDeleting(false);
            }}
          />
        }
      >
        {google ? (
          <Text tone="muted">You’ll be asked to pick your Google account once more to confirm it’s you.</Text>
        ) : (
          <TextField
            label="Confirm with your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            icon="lock-simple"
          />
        )}
        {deleteError ? (
          <Text variant="caption" tone="danger">
            {deleteError}
          </Text>
        ) : null}
      </Sheet>
    </>
  );
}
