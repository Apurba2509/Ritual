import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { EMOJI_GROUPS } from '@/domain/catalog';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { radius, useTheme } from '@/ui/theme';

export function EmojiSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
}) {
  const t = useTheme();
  const [custom, setCustom] = useState('');
  return (
    <Sheet visible={visible} onClose={onClose} title="Pick an icon">
      {EMOJI_GROUPS.map((g) => (
        <View key={g.title} style={{ gap: 8 }}>
          <Text variant="label" tone="muted">
            {g.title}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {g.emojis.map((e) => (
              <Tap
                key={e}
                onPress={() => {
                  onPick(e);
                  onClose();
                }}
                scaleTo={0.85}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.md,
                  backgroundColor: t.surface,
                  borderWidth: 1,
                  borderColor: t.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text size={24}>{e}</Text>
              </Tap>
            ))}
          </View>
        </View>
      ))}
      <TextField
        label="Or type any emoji"
        value={custom}
        onChangeText={(v) => setCustom(v)}
        placeholder="🎯"
        maxLength={8}
        right={
          custom ? (
            <Tap
              onPress={() => {
                onPick([...custom.trim()].slice(0, 2).join(''));
                setCustom('');
                onClose();
              }}
            >
              <Text variant="bodyStrong" tone="accent">
                Use
              </Text>
            </Tap>
          ) : null
        }
      />
    </Sheet>
  );
}

const PRESETS = ['06:30', '07:00', '08:00', '09:00', '12:30', '17:00', '18:30', '20:00', '21:00', '22:00'];

export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function TimeSheet({
  visible,
  initial = '08:00',
  onClose,
  onPick,
  title = 'Reminder time',
}: {
  visible: boolean;
  initial?: string;
  onClose: () => void;
  onPick: (hhmm: string) => void;
  title?: string;
}) {
  const t = useTheme();
  const [h, setH] = useState(8);
  const [m, setM] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const [hh, mm] = initial.split(':').map(Number);
    setH(hh);
    setM(mm);
  }, [visible, initial]);

  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const wheel = (label: string, val: number, onChange: (v: number) => void, max: number, step: number) => (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Tap
        onPress={() => onChange((val + step) % max)}
        scaleTo={0.85}
        style={{ padding: 8 }}
        accessibilityLabel={`Increase ${label}`}
      >
        <Icon name="chevron-up" size={26} color={t.textMuted} />
      </Tap>
      <Text variant="hero" size={48}>
        {String(val).padStart(2, '0')}
      </Text>
      <Tap
        onPress={() => onChange((val - step + max) % max)}
        scaleTo={0.85}
        style={{ padding: 8 }}
        accessibilityLabel={`Decrease ${label}`}
      >
        <Icon name="chevron-down" size={26} color={t.textMuted} />
      </Tap>
    </View>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <Button
          title={`Set ${formatTime(value)}`}
          full
          size="lg"
          onPress={() => {
            onPick(value);
            onClose();
          }}
        />
      }
    >
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 18 }}>
        {wheel('hour', h, setH, 24, 1)}
        <Text variant="hero" size={48} tone="faint">
          :
        </Text>
        {wheel('minutes', m, setM, 60, 5)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {PRESETS.map((p) => (
          <Chip
            key={p}
            label={formatTime(p)}
            size="sm"
            selected={p === value}
            onPress={() => {
              const [hh, mm] = p.split(':').map(Number);
              setH(hh);
              setM(mm);
            }}
          />
        ))}
      </View>
    </Sheet>
  );
}
