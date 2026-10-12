import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DayKey, fromDayKey, todayKey } from '@/domain/dates';
import { goalOf, isEntryDone } from '@/domain/habits';
import { entryId, Habit, Mood } from '@/domain/types';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { cloudinaryConfigured, thumb } from '@/lib/cloudinary';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { radius, useTheme } from '@/ui/theme';
import { setProgress, skipHabit } from './actions';
import { formatAmount, MOODS, stepFor } from './format';
import { HabitIcon } from './HabitIcon';
import { pickAndUpload } from './photo';

function Stepper({
  value,
  onChange,
  step,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  label: string;
}) {
  const t = useTheme();
  const btn = (name: 'minus' | 'plus', delta: number) => (
    <Tap
      onPress={() => onChange(Math.max(0, value + delta))}
      scaleTo={0.9}
      accessibilityLabel={name === 'plus' ? 'Increase' : 'Decrease'}
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: t.surface2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={name} size={22} />
    </Tap>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {btn('minus', -step)}
      <View style={{ alignItems: 'center' }}>
        <Text weight="heavy" size={40} tabular style={{ letterSpacing: -1.6 }}>
          {label}
        </Text>
      </View>
      {btn('plus', step)}
    </View>
  );
}

export function LogSheet({ habit, day, onClose }: { habit: Habit | null; day: DayKey; onClose: () => void }) {
  const t = useTheme();
  const entry = useApp((s) => (habit ? s.entries[entryId(habit.id, day)] : undefined));
  const live = entry && !entry.deleted ? entry : undefined;
  const [value, setValue] = useState(0);
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<Mood | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!habit) return;
    setValue(live?.value ?? 0);
    setNote(live?.note ?? '');
    setMood(live?.mood ?? null);
    setPhoto(live?.photoUrl ?? null);
    // reset only when the sheet opens for a habit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habit?.id, day]);

  if (!habit)
    return (
      <Sheet visible={false} onClose={onClose}>
        {null}
      </Sheet>
    );

  const isToday = day === todayKey();
  const dateLabel = isToday
    ? 'Today'
    : fromDayKey(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const step = stepFor(habit);
  // Past days are measured against the goal they were held to (it may differ from today's target).
  const goal = goalOf(habit, live);
  const doneNow = value >= goal;

  const save = () => {
    if (value !== (live?.value ?? 0)) setProgress(habit.id, day, value);
    if (note !== (live?.note ?? '') || mood !== (live?.mood ?? null)) {
      useApp.getState().setNote(habit.id, day, note, mood);
    }
    if (photo !== (live?.photoUrl ?? null)) useApp.getState().setPhoto(habit.id, day, photo);
    onClose();
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={habit.name}
      subtitle={dateLabel}
      footer={<Button title="Save" onPress={save} full size="lg" />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <HabitIcon icon={habit.icon} color={habit.color} size={40} />
        <Text tone="muted" style={{ flex: 1 }}>
          Target {formatAmount(habit, goal)}
          {habit.kind === 'check' ? '' : ` · logged ${formatAmount(habit, value)}`}
        </Text>
      </View>

      {habit.kind === 'check' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            title={doneNow ? 'Done' : 'Mark done'}
            icon={doneNow ? 'check-circle' : 'check'}
            variant={doneNow ? 'primary' : 'secondary'}
            onPress={() => setValue(doneNow ? 0 : goal)}
            style={{ flex: 1 }}
          />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Stepper value={value} onChange={setValue} step={step} label={formatAmount(habit, value)} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[step, step * 2, step * 5].map((s) => (
              <Chip key={s} label={`+${formatAmount(habit, s)}`} onPress={() => setValue(value + s)} size="sm" />
            ))}
            <Chip label="Hit target" icon="target" selected onPress={() => setValue(Math.max(value, goal))} size="sm" />
          </View>
          {habit.kind === 'duration' && isToday ? (
            <Button
              title="Start focus timer"
              variant="secondary"
              icon="play"
              onPress={() => {
                onClose();
                router.push(`/focus/${habit.id}`);
              }}
            />
          ) : null}
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Text variant="label" tone="muted">
          How did it feel?
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {MOODS.map((m) => {
            const selected = mood === m.value;
            return (
              <Tap
                key={m.value}
                onPress={() => setMood(selected ? null : (m.value as Mood))}
                scaleTo={0.85}
                accessibilityLabel={m.label}
                style={{
                  width: 58,
                  paddingVertical: 10,
                  gap: 4,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? t.accent : t.surface2,
                }}
              >
                <Icon
                  name={m.icon}
                  size={26}
                  color={selected ? t.onAccent : mood ? t.textFaint : t.text}
                  weight={selected ? 'fill' : 'regular'}
                />
                <Text variant="small" size={10} color={selected ? t.onAccent : t.textMuted}>
                  {m.label}
                </Text>
              </Tap>
            );
          })}
        </View>
      </View>

      {cloudinaryConfigured ? (
        <View style={{ gap: 8 }}>
          <Text variant="label" tone="muted">
            Photo proof
          </Text>
          {photo ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Image
                source={{ uri: thumb(photo, 300) }}
                style={{ width: 96, height: 96, borderRadius: radius.md }}
                contentFit="cover"
              />
              <Button title="Remove" variant="ghost" icon="x" size="sm" onPress={() => setPhoto(null)} />
            </View>
          ) : (
            <Button
              title={uploading ? 'Uploading…' : 'Add a photo'}
              icon="camera"
              variant="secondary"
              loading={uploading}
              onPress={async () => {
                setUploading(true);
                try {
                  const url = await pickAndUpload('checkins');
                  if (url) setPhoto(url);
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'Upload failed', { tone: 'error' });
                }
                setUploading(false);
              }}
            />
          )}
        </View>
      ) : null}

      <TextField
        label="Note"
        placeholder="What went well? What got in the way?"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={500}
      />

      {!isEntryDone(habit, live) ? (
        <Button
          title={live?.skipped ? 'Undo rest day' : 'Take a rest day (keeps your streak)'}
          variant="ghost"
          icon="moon"
          onPress={() => {
            skipHabit(habit.id, day, !live?.skipped);
            onClose();
          }}
        />
      ) : null}
    </Sheet>
  );
}
