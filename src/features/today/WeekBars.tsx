import { View } from 'react-native';
import { addDays, DayKey, fromDayKey, startOfWeek } from '@/domain/dates';
import { useSnapshot, useToday } from '@/data/hooks';
import { useApp } from '@/data/store';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { alpha, useTheme } from '@/ui/theme';

/** The week at a glance: a slim bar per day. Tap a past day to edit it. */
export function WeekBars({ selected, onSelect }: { selected: DayKey; onSelect: (d: DayKey) => void }) {
  const t = useTheme();
  const today = useToday();
  const weekStart = useApp((s) => s.settings.weekStart);
  const snapshot = useSnapshot();
  const start = startOfWeek(today, weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const H = 34;

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 }}>
      {days.map((d) => {
        const future = d > today;
        const s = snapshot.days.get(d);
        const ratio = !future && s && s.due ? Math.min(1, s.done / s.due) : 0;
        const full = ratio >= 1;
        const isSel = d === selected;
        const date = fromDayKey(d);
        return (
          <Tap
            key={d}
            disabled={future}
            onPress={() => onSelect(d)}
            scaleTo={0.88}
            haptics="tap"
            accessibilityLabel={`${date.toDateString()}${s?.due ? `, ${s.done} of ${s.due} done` : ''}`}
            accessibilityState={{ selected: isSel }}
            style={{ alignItems: 'center', gap: 8, width: 36, opacity: future ? 0.35 : 1 }}
          >
            <View
              style={{
                width: 8,
                height: H,
                borderRadius: 4,
                backgroundColor: t.surface3,
                justifyContent: 'flex-end',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: Math.max(ratio > 0 ? 6 : 0, ratio * H),
                  borderRadius: 4,
                  backgroundColor: full ? (t.scheme === 'dark' ? t.accent : t.accentInk) : alpha(t.text, 0.45),
                }}
              />
            </View>
            <Text variant="small" color={isSel ? t.text : t.textFaint} weight={isSel ? 'bold' : 'semibold'}>
              {date.toLocaleDateString(undefined, { weekday: 'narrow' })}
            </Text>
            <View
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                marginTop: -4,
                backgroundColor: isSel ? (t.scheme === 'dark' ? t.accent : t.accentInk) : 'transparent',
              }}
            />
          </Tap>
        );
      })}
    </View>
  );
}
