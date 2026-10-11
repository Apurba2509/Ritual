import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { addDays, startOfWeek, todayKey } from '@/domain/dates';
import type { HabitKind } from '@/domain/types';
import { useSession } from '@/data/session';
import { toast } from '@/data/ui';
import { friendlyError } from '@/lib/errors';
import { formatAmount } from '@/features/habits/format';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { IconSheet } from '@/features/habits/pickers';
import { createChallenge, getChallenge, joinChallenge } from '@/features/social/api';
import { CHALLENGE_TEMPLATES, ChallengeTemplate } from '@/features/social/challengeTemplates';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Screen, Section } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { useTheme } from '@/ui/theme';

export default function NewChallengeScreen() {
  const t = useTheme();
  const user = useSession((s) => s.user);
  const [tpl, setTpl] = useState<ChallengeTemplate | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('flag');
  const [color, setColor] = useState<string>('lime');
  const [kind, setKind] = useState<HabitKind>('check');
  const [target, setTarget] = useState('1');
  const [unit, setUnit] = useState('');
  const [days, setDays] = useState(30);
  const [start, setStart] = useState<'today' | 'tomorrow' | 'monday'>('today');
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);

  const use = (c: ChallengeTemplate) => {
    setTpl(c);
    setTitle(c.title);
    setDescription(c.description);
    setIcon(c.icon);
    setColor(c.color);
    setKind(c.kind);
    setTarget(String(c.target));
    setUnit(c.unit ?? '');
    setDays(c.durationDays);
  };

  const create = async () => {
    if (!user) return router.replace('/upgrade');
    if (!title.trim()) return toast('Name your challenge', { tone: 'error' });
    setBusy(true);
    try {
      const today = todayKey();
      const startDate =
        start === 'today' ? today : start === 'tomorrow' ? addDays(today, 1) : addDays(startOfWeek(today, 1), 7);
      const targetNum = kind === 'check' ? 1 : Math.max(1, Number(target) || 1);
      const id = await createChallenge({
        title: title.trim(),
        description: description.trim(),
        icon,
        color,
        kind,
        target: targetNum,
        unit: kind === 'check' ? null : kind === 'duration' ? 'min' : unit.trim() || null,
        schedule: tpl?.schedule ?? { type: 'daily' },
        durationDays: days,
        startDate,
        isPublic,
      });
      const c = await getChallenge(id);
      if (c) await joinChallenge(c);
      toast('Challenge is live. Invite your friends!', { icon: 'flag', tone: 'success' });
      router.replace(`/challenge/${id}`);
    } catch (e) {
      toast(friendlyError(e, 'Could not create challenge'), { tone: 'error' });
    }
    setBusy(false);
  };

  return (
    <>
      <Screen
        back="close"
        title="New challenge"
        footer={<Button title="Create & join" icon="flag" size="lg" full loading={busy} onPress={create} />}
      >
        <Section title="Templates">
          <View style={{ gap: 8 }}>
            {CHALLENGE_TEMPLATES.map((c) => (
              <Card
                key={c.id}
                onPress={() => use(c)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderWidth: tpl?.id === c.id ? 2 : 1,
                  borderColor: tpl?.id === c.id ? (t.scheme === 'dark' ? t.accent : t.text) : t.border,
                }}
              >
                <HabitIcon icon={c.icon} color={c.color} size={40} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{c.title}</Text>
                  <Text variant="caption" tone="muted">
                    {c.durationDays} days · {c.kind === 'check' ? 'daily check' : formatAmount(c, c.target)}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        </Section>

        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <Tap onPress={() => setIconOpen(true)} scaleTo={0.9} accessibilityLabel="Change icon">
            <HabitIcon icon={icon} color={color} size={62} />
          </Tap>
          <View style={{ flex: 1 }}>
            <TextField
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="30 Days of Code"
              maxLength={40}
            />
          </View>
        </View>
        <TextField
          label="Rules"
          value={description}
          onChangeText={setDescription}
          placeholder="What counts? Keep it simple."
          multiline
          maxLength={240}
        />

        <Section title="Daily goal">
          <Segmented<HabitKind>
            value={kind}
            onChange={setKind}
            options={[
              { value: 'check', label: 'Yes / No' },
              { value: 'count', label: 'Count' },
              { value: 'duration', label: 'Minutes' },
            ]}
          />
          {kind !== 'check' ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label={kind === 'duration' ? 'Minutes' : 'Target'}
                  value={target}
                  onChangeText={setTarget}
                  keyboardType="numeric"
                />
              </View>
              {kind === 'count' ? (
                <View style={{ flex: 1 }}>
                  <TextField label="Unit" value={unit} onChangeText={setUnit} placeholder="pages" />
                </View>
              ) : null}
            </View>
          ) : null}
        </Section>

        <Section title="Length">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[7, 14, 21, 30, 66, 75, 100].map((d) => (
              <Chip key={d} label={`${d} days`} selected={days === d} onPress={() => setDays(d)} />
            ))}
          </View>
        </Section>

        <Section title="Starts">
          <Segmented
            value={start}
            onChange={setStart}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'tomorrow', label: 'Tomorrow' },
              { value: 'monday', label: 'Next Monday' },
            ]}
          />
        </Section>

        <ListGroup>
          <ListRow
            icon="globe-simple"
            title="Public"
            subtitle="Anyone can find and join. Off = invite link only."
            toggle={isPublic}
            onToggle={setIsPublic}
            last
          />
        </ListGroup>
      </Screen>
      <IconSheet visible={iconOpen} onClose={() => setIconOpen(false)} onPick={setIcon} color={color} selected={icon} />
    </>
  );
}
