import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { addDays, DayKey, fromDayKey, startOfWeek, WeekStart, WEEKDAY_LETTER, orderedWeekdays } from '@/domain/dates';
import Svg, { Circle as SvgCircle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
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
  const [avail, setAvail] = useState(0);
  const lastWeek = startOfWeek(today, weekStart);
  const firstWeek = addDays(lastWeek, -(weeks - 1) * 7);

  // Fill the card exactly when the columns stay readable; only very long ranges scroll.
  const LABEL_COL = 16;
  const fitted = avail ? Math.floor(((avail - LABEL_COL + gap) / weeks - gap) * 2) / 2 : 0;
  const fits = fitted >= 9;
  const size = fits ? Math.min(fitted, Math.round(cell * 1.6)) : cell;

  const shade = (v: number | null) => {
    if (v === null || v <= 0) return t.heat[0];
    if (color) return alpha(color, 0.25 + 0.75 * Math.min(1, v));
    if (v < 0.34) return t.heat[1];
    if (v < 0.67) return t.heat[2];
    if (v < 1) return t.heat[3];
    return t.heat[4];
  };

  const columns: DayKey[] = Array.from({ length: weeks }, (_, i) => addDays(firstWeek, i * 7));
  const monthOf = (wi: number) => fromDayKey(columns[wi]).getMonth();
  // A label needs ~3 columns of room; skip the leading partial month if the next one starts sooner.
  const showMonth = (wi: number) => {
    if (wi >= columns.length - 1) return false;
    if (wi > 0) return monthOf(wi) !== monthOf(wi - 1);
    return [1, 2].every((k) => k >= columns.length || monthOf(k) === monthOf(0));
  };

  const grid = (
    <View style={{ flexDirection: 'row', gap }}>
      {columns.map((week, wi) => (
        <View key={week} style={{ gap }}>
          <View style={{ height: 13, width: size, overflow: 'visible' }}>
            {showMonth(wi) ? (
              <Text variant="caption" size={9} tone="faint" style={{ position: 'absolute', left: 0, width: 32 }}>
                {MONTHS[monthOf(wi)]}
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
                  width: size,
                  height: size,
                  borderRadius: Math.round(size * 0.28),
                  backgroundColor: future ? 'transparent' : shade(value(day)),
                  borderWidth: day === today ? 1.5 : 0,
                  borderColor: t.text,
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );

  return (
    <View
      style={{ flexDirection: 'row', minHeight: 16 + 7 * (size + gap) }}
      onLayout={(e) => setAvail(e.nativeEvent.layout.width)}
    >
      <View style={{ gap, paddingTop: 16, width: LABEL_COL }}>
        {orderedWeekdays(weekStart).map((wd, i) => (
          <View key={wd} style={{ height: size, justifyContent: 'center' }}>
            {i % 2 === 1 ? (
              <Text variant="caption" size={9} tone="faint">
                {WEEKDAY_LETTER[wd]}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      {!avail ? null : fits ? (
        grid
      ) : (
        <ScrollView
          ref={scroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        >
          {grid}
        </ScrollView>
      )}
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
  const c = color ?? (t.scheme === 'dark' ? t.accent : t.text);
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
                backgroundColor: t.surface2,
              }}
            />
            <Bar
              ratio={d.value / top}
              color={d.highlight ? c : alpha(c, 0.55)}
              height={height}
              delay={i * 35}
              faded={d.faded}
            />
          </View>
          <Text variant="small" size={10} tone={d.highlight ? 'default' : 'faint'}>
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
  const c = color ?? t.accentInk;
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(1, ratio)), { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [ratio, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: t.surface3, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: c }, style]} />
    </View>
  );
}

/** Smooth area sparkline for a trend (values 0..1). Last point gets a dot. */
export function Sparkline({
  values,
  width,
  height = 64,
}: {
  values: (number | null)[];
  width: number;
  height?: number;
}) {
  const t = useTheme();
  const pts = values
    .map((v, i) => (v === null ? null : ([i, v] as [number, number])))
    .filter((p): p is [number, number] => p !== null);
  if (pts.length < 2) return <View style={{ height }} />;
  const n = values.length - 1;
  const x = (i: number) => (i / n) * (width - 8) + 4;
  const y = (v: number) => height - 6 - v * (height - 14);
  // Catmull-Rom → cubic Bézier for a calm, smooth line.
  let d = `M${x(pts[0][0]).toFixed(1)} ${y(pts[0][1]).toFixed(1)}`;
  for (let k = 0; k < pts.length - 1; k++) {
    const p0 = pts[Math.max(0, k - 1)];
    const p1 = pts[k];
    const p2 = pts[k + 1];
    const p3 = pts[Math.min(pts.length - 1, k + 2)];
    const c1x = x(p1[0]) + (x(p2[0]) - x(p0[0])) / 6;
    const c1y = y(p1[1]) + (y(p2[1]) - y(p0[1])) / 6;
    const c2x = x(p2[0]) - (x(p3[0]) - x(p1[0])) / 6;
    const c2y = y(p2[1]) - (y(p3[1]) - y(p1[1])) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${x(p2[0]).toFixed(1)} ${y(p2[1]).toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  const area = `${d} L${x(last[0]).toFixed(1)} ${height} L${x(pts[0][0]).toFixed(1)} ${height} Z`;
  const c = t.scheme === 'dark' ? t.accent : t.accentInk;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c} stopOpacity={0.28} />
          <Stop offset="1" stopColor={c} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      <Path d={area} fill="url(#spark)" />
      <Path d={d} fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" />
      <SvgCircle cx={x(last[0])} cy={y(last[1])} r={4.5} fill={c} stroke={t.bg} strokeWidth={2} />
    </Svg>
  );
}
