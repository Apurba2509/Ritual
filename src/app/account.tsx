import { sendEmailVerification } from 'firebase/auth';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { HABIT_COLORS } from '@/domain/catalog';
import { authErrorMessage, claimUsername, deleteAccount, normalizeUsername, USERNAME_RE } from '@/data/auth';
import { useSession } from '@/data/session';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { AuthForm } from '@/features/auth/AuthForm';
import { EmojiSheet } from '@/features/habits/pickers';
import { pickAndUpload } from '@/features/habits/photo';
import { cloudinaryConfigured } from '@/lib/cloudinary';
import { firebase, isFirebaseConfigured } from '@/lib/firebase';
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

function GuestUpgrade() {
  const t = useTheme();
  const [mode, setMode] = useState<'signUp' | 'signIn'>('signUp');
  const habits = useApp((s) => Object.values(s.habits).filter((h) => !h.deleted).length);
  return (
    <Screen back title={mode === 'signUp' ? 'Create your account' : 'Welcome back'}>
      <Card tone="raised" style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Icon name="cloud" size={22} color={t.success} />
        <Text variant="caption" tone="muted" style={{ flex: 1 }}>
          {mode === 'signUp'
            ? `Your ${habits} habit${habits === 1 ? '' : 's'} and full history move to your new account — backed up, synced across devices, ready for friends and challenges.`
            : 'Anything you tracked as a guest is merged into your account when you sign in.'}
        </Text>
      </Card>
      <AuthForm mode={mode} onSwitch={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')} />
    </Screen>
  );
}

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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!user) {
    if (!isFirebaseConfigured) {
      return (
        <Screen back title="Account">
          <Card>
            <Text tone="muted">
              Cloud accounts aren’t configured in this build. Your data is stored safely on this device.
            </Text>
          </Card>
        </Screen>
      );
    }
    return <GuestUpgrade />;
  }

  const handle = normalizeUsername(username);
  const save = async () => {
    setSaving(true);
    try {
      useApp.getState().updateProfile({ displayName: name.trim(), bio: bio.trim() || null });
      if (handle !== profile.username) {
        if (!USERNAME_RE.test(handle)) throw new Error('Usernames are 3–20 characters: letters, numbers, _ or .');
        await claimUsername(handle);
      }
      toast('Profile saved', { emoji: '✨', tone: 'success' });
      router.back();
    } catch (e) {
      toast(authErrorMessage(e), { tone: 'error' });
    }
    setSaving(false);
  };

  return (
    <>
      <Screen back title="Profile">
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Tap onPress={() => setEmojiOpen(true)} scaleTo={0.92} accessibilityLabel="Change avatar">
            <Avatar
              emoji={profile.avatar.emoji}
              color={profile.avatar.color}
              photoUrl={profile.avatar.photoUrl}
              size={96}
            />
            <View
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: t.accent,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: t.bg,
              }}
            >
              <Icon name="edit-2" size={13} color="#FFF" />
            </View>
          </Tap>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {HABIT_COLORS.map((c) => (
              <Tap
                key={c}
                onPress={() => useApp.getState().updateProfile({ avatar: { ...profile.avatar, color: c } })}
                scaleTo={0.85}
                accessibilityLabel={`Avatar color ${c}`}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: c,
                  borderWidth: 2,
                  borderColor: profile.avatar.color === c ? t.text : 'transparent',
                }}
              />
            ))}
          </View>
          {cloudinaryConfigured ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                title={profile.avatar.photoUrl ? 'Change photo' : 'Use a photo'}
                size="sm"
                variant="secondary"
                icon="camera"
                onPress={async () => {
                  try {
                    const url = await pickAndUpload('avatars', true);
                    if (url) useApp.getState().updateProfile({ avatar: { ...profile.avatar, photoUrl: url } });
                  } catch (e) {
                    toast(e instanceof Error ? e.message : 'Upload failed', { tone: 'error' });
                  }
                }}
              />
              {profile.avatar.photoUrl ? (
                <Button
                  title="Use emoji"
                  size="sm"
                  variant="ghost"
                  onPress={() => useApp.getState().updateProfile({ avatar: { ...profile.avatar, photoUrl: null } })}
                />
              ) : null}
            </View>
          ) : null}
        </View>

        <TextField label="Display name" value={name} onChangeText={setName} maxLength={40} icon="smile" />
        <TextField
          label="Username"
          value={username}
          onChangeText={(v) => setUsername(v.toLowerCase().replace(/\s/g, ''))}
          autoCapitalize="none"
          autoCorrect={false}
          icon="at-sign"
          maxLength={20}
          error={username && !USERNAME_RE.test(handle) ? '3–20 characters: letters, numbers, _ or .' : null}
        />
        <TextField
          label="Bio"
          value={bio}
          onChangeText={setBio}
          placeholder="Building one habit at a time"
          multiline
          maxLength={140}
        />
        <Button title="Save profile" size="lg" full loading={saving} onPress={save} />

        <Section title="Account">
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="mail" size={18} color={t.textMuted} />
              <Text style={{ flex: 1 }}>{user.email}</Text>
              <Text variant="caption" tone={user.emailVerified ? 'success' : 'muted'}>
                {user.emailVerified ? 'Verified' : 'Unverified'}
              </Text>
            </View>
            {!user.emailVerified ? (
              <Button
                title="Resend verification email"
                size="sm"
                variant="secondary"
                onPress={async () => {
                  const u = firebase()?.auth.currentUser;
                  if (u) {
                    await sendEmailVerification(u).catch(() => {});
                    toast('Verification email sent', { emoji: '📬' });
                  }
                }}
              />
            ) : null}
          </Card>
          <Button title="Delete account" variant="danger" icon="alert-triangle" onPress={() => setDeleteOpen(true)} />
        </Section>
      </Screen>
      <EmojiSheet
        visible={emojiOpen}
        onClose={() => setEmojiOpen(false)}
        onPick={(emoji) => useApp.getState().updateProfile({ avatar: { ...profile.avatar, emoji } })}
      />
      <Sheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your account?"
        subtitle="Every habit, check-in, friend and badge is permanently erased. This can’t be undone."
        footer={
          <Button
            title="Delete forever"
            variant="danger"
            full
            size="lg"
            loading={deleting}
            disabled={!password}
            onPress={async () => {
              setDeleting(true);
              setDeleteError(null);
              try {
                await deleteAccount(password);
                setDeleteOpen(false);
                toast('Account deleted', { emoji: '👋' });
              } catch (e) {
                setDeleteError(authErrorMessage(e));
              }
              setDeleting(false);
            }}
          />
        }
      >
        <TextField
          label="Confirm with your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          error={deleteError}
        />
      </Sheet>
    </>
  );
}
