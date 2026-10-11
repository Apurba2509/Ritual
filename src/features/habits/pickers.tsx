import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ICON_GROUPS } from '@/domain/catalog';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Icon, isIconName } from '@/ui/Icon';
import { useFrameWidth } from '@/ui/layout';
import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { alpha, radius, tint, useTheme } from '@/ui/theme';

export function IconSheet({
  visible,
  onClose,
  onPick,
  color,
  selected,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (icon: string) => void;
  color: string;
  selected: string;
}) {
  const t = useTheme();
  const width = useFrameWidth();
  const c = tint(color, t);
  // 6 per row, edge to edge inside the sheet's 20px padding
  const size = Math.floor((width - 40 - 5 * 8) / 6);
  return (
    <Sheet visible={visible} onClose={onClose} title="Choose an icon">
      {ICON_GROUPS.map((g) => (
        <View key={g.title} style={{ gap: 10 }}>
          <Text variant="label" tone="muted">
            {g.title}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {g.icons.filter(isIconName).map((name) => {
              const on = name === selected;
              return (
                <Tap
                  key={name}
                  onPress={() => {
                    onPick(name);
                    onClose();
                  }}
                  scaleTo={0.85}
                  accessibilityLabel={name.replace(/-/g, ' ')}
                  accessibilityState={{ selected: on }}
                  style={{
                    width: size,
                    height: size,
                    borderRadius: radius.md,
                    backgroundColor: on ? alpha(c, t.scheme === 'dark' ? 0.2 : 0.16) : t.surface2,
                    borderWidth: on ? 1.5 : 0,
                    borderColor: c,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    name={name}
                    size={Math.round(size * 0.46)}
                    color={on ? c : t.text}
                    weight={on ? 'fill' : 'regular'}
                  />
                </Tap>
              );
            })}
          </View>
        </View>
      ))}
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
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Tap
        onPress={() => onChange((val + step) % max)}
        scaleTo={0.85}
        style={{
          width: 48,
          height: 40,
          borderRadius: radius.md,
          backgroundColor: t.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityLabel={`Increase ${label}`}
      >
        <Icon name="caret-up" size={20} color={t.text} />
      </Tap>
      <Text weight="heavy" size={56} tabular style={{ letterSpacing: -2, lineHeight: 64 }}>
        {String(val).padStart(2, '0')}
      </Text>
      <Tap
        onPress={() => onChange((val - step + max) % max)}
        scaleTo={0.85}
        style={{
          width: 48,
          height: 40,
          borderRadius: radius.md,
          backgroundColor: t.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityLabel={`Decrease ${label}`}
      >
        <Icon name="caret-down" size={20} color={t.text} />
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
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        {wheel('hour', h, setH, 24, 1)}
        <Text weight="heavy" size={48} tone="faint">
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
