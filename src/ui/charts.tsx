import { useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { addDays, DayKey, fromDayKey, startOfWeek, WeekStart, WEEKDAY_LETTER, orderedWeekdays } from '@/domain/dates';
import { Text } from './Text';
import { alpha, useTheme } from './theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * GitHub-style contribution heatmap. `value(day)` returns 0..1 completion, or null when
 * nothing was scheduled.
 */
export function Heatmap({
  today,
  weeks = 26,
  weekStart,
  value,
  color,
  cell = 13,
  gap = 3,
}: {
  today: DayKey;
  weeks?: number;
  weekStart: WeekStart;
  value: (day: DayKey) => number | null;
  color?: string;
  cell?: number;
  gap?: number;
}) {
  const t = useTheme();
  const scroll = useRef<ScrollView>(null);
  const lastWeek = startOfWeek(today, weekStart);
  const firstWeek = addDays(lastWeek, -(weeks - 1) * 7);

  const shade = (v: number | null) => {
    if (v === null || v <= 0) return t.heat[0];
    if (color) return alpha(color, 0.25 + 0.75 * Math.min(1, v));
    if (v < 0.34) return t.heat[1];
    if (v < 0.67) return t.heat[2];
    if (v < 1) return t.heat[3];
    return t.heat[4];
  };

  const columns: DayKey[] = Array.from({ length: weeks }, (_, i) => addDays(firstWeek, i * 7));

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <View style={{ gap, paddingTop: 16 }}>
        {orderedWeekdays(weekStart).map((wd, i) => (
          <View key={wd} style={{ height: cell, justifyContent: 'center' }}>
            {i % 2 === 1 ? (
              <Text variant="caption" size={9} tone="faint">
                {WEEKDAY_LETTER[wd]}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      >
        <View style={{ flexDirection: 'row', gap }}>
          {columns.map((week, wi) => {
            const d0 = fromDayKey(week);
            const showMonth = wi === 0 || fromDayKey(addDays(week, -7)).getMonth() !== d0.getMonth();
            return (
              <View key={week} style={{ gap }}>
                <View style={{ height: 13, width: cell, overflow: 'visible' }}>
                  {showMonth && wi < columns.length - 1 ? (
                    <Text variant="caption" size={9} tone="faint" style={{ position: 'absolute', left: 0, width: 32 }}>
                      {MONTHS[d0.getMonth()]}
                    </Text>
                  ) : null}
                </View>
                {Array.from({ length: 7 }, (_, di) => {
                  const day = addDays(week, di);
                  const future = day > today;
                  return (
                    <View
                      key={day}
                      style={{
                        width: cell,
                        height: cell,
                        borderRadius: 3,
                        backgroundColor: future ? 'transparent' : shade(value(day)),
                        borderWidth: day === today ? 1.5 : 0,
                        borderColor: t.text,
                      }}
                    />
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function Bar({
  ratio,
  color,
  height,
  delay,
  faded,
}: {
  ratio: number;
  color: string;
  height: number;
  delay: number;
  faded?: boolean;
}) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withDelay(delay, withTiming(ratio, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [ratio, delay, h]);
  const style = useAnimatedStyle(() => ({ height: Math.max(4, h.value * height) }));
  return (
    <Animated.View
      style={[{ width: '62%', borderRadius: 6, backgroundColor: color, opacity: faded ? 0.45 : 1 }, style]}
    />
  );
}

export function BarChart({
  data,
  height = 120,
  color,
  max,
  formatValue,
}: {
  data: { label: string; value: number; highlight?: boolean; faded?: boolean }[];
  height?: number;
  color?: string;
  max?: number;
  formatValue?: (v: number) => string;
}) {
  const t = useTheme();
  const c = color ?? t.accent;
  const top = Math.max(max ?? 0, ...data.map((d) => d.value), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
      {data.map((d, i) => (
        <View key={`${d.label}-${i}`} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          {formatValue ? (
            <Text variant="caption" size={10} tone={d.highlight ? 'default' : 'faint'}>
              {d.value > 0 ? formatValue(d.value) : ''}
            </Text>
          ) : null}
          <View style={{ height, justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                width: '62%',
                height,
                borderRadius: 6,
                backgroundColor: alpha(c, t.scheme === 'dark' ? 0.08 : 0.07),
              }}
            />
            <Bar
              ratio={d.value / top}
              color={d.highlight ? c : alpha(c, 0.7)}
              height={height}
              delay={i * 35}
              faded={d.faded}
            />
          </View>
          <Text variant="caption" size={10} tone={d.highlight ? 'default' : 'faint'}>
            {d.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Horizontal meter, e.g. completion rate per habit. */
export function Meter({ ratio, color, height = 8 }: { ratio: number; color?: string; height?: number }) {
  const t = useTheme();
  const c = color ?? t.accent;
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(1, ratio)), { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [ratio, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: alpha(c, 0.14), overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: c }, style]} />
    </View>
  );
}
