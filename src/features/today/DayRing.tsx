import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/ui/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** SVG arc from angle a1 to a2 (degrees, 0 = 12 o'clock, clockwise). */
function arc(cx: number, cy: number, r: number, a1: number, a2: number) {
  const rad = (a: number) => ((a - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(a1));
  const y1 = cy + r * Math.sin(rad(a1));
  const x2 = cx + r * Math.cos(rad(a2));
  const y2 = cy + r * Math.sin(rad(a2));
  const large = a2 - a1 > 180 ? 1 : 0;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * Ritual's signature visual: one ring for the day, one segment per habit. Each segment fills
 * with progress and lights up volt when done — a single glance tells you how today is going.
 * Arcs are explicit paths (no transforms), so it renders identically on Android, iOS and web.
 */
export function DayRing({
  segments,
  size = 232,
  stroke = 16,
  children,
}: {
  /** 0..1 progress for each habit due today, in display order. */
  segments: number[];
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  const values = segments.length ? segments : [0];
  const n = values.length;
  const pad = 2;
  const r = (size - stroke) / 2 - pad;
  const c = size / 2;
  const slice = 360 / n;
  const gapDeg = n === 1 ? 0 : Math.max(5, 12 - n);
  // Round caps poke out by stroke/2 at each end; shorten each arc so the gaps stay even.
  const capDeg = n === 1 ? 0 : (stroke / 2 / r) * (180 / Math.PI);
  const color = t.scheme === 'dark' ? t.accent : t.accentInk;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {values.map((p, i) => {
          // A single habit gets a (nearly) full circle; arcs can't span exactly 360°.
          const a1 = n === 1 ? 0 : i * slice + gapDeg / 2 + capDeg;
          const a2 = n === 1 ? 359.99 : (i + 1) * slice - gapDeg / 2 - capDeg;
          const d = arc(c, c, r, a1, Math.max(a1 + 0.5, a2));
          const len = r * (((Math.max(a1 + 0.5, a2) - a1) * Math.PI) / 180);
          return (
            <Segment
              key={i}
              d={d}
              len={len}
              progress={p}
              index={i}
              stroke={stroke}
              color={color}
              track={t.surface3}
              round={n > 1}
            />
          );
        })}
      </Svg>
      {children}
    </View>
  );
}

function Segment({
  d,
  len,
  progress,
  index,
  stroke,
  color,
  track,
  round,
}: {
  d: string;
  len: number;
  progress: number;
  index: number;
  stroke: number;
  color: string;
  track: string;
  round: boolean;
}) {
  const value = useSharedValue(0);
  useEffect(() => {
    value.value = withDelay(
      index * 60,
      withTiming(Math.max(0, Math.min(1, progress)), { duration: 650, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress, index, value]);

  const fill = useAnimatedProps(() => ({
    strokeDashoffset: len * (1 - value.value),
    strokeOpacity: value.value < 0.01 ? 0 : 1,
  }));
  const cap = round ? 'round' : 'butt';

  return (
    <>
      <Path d={d} fill="none" stroke={track} strokeWidth={stroke} strokeLinecap={cap} />
      <AnimatedPath
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap={cap}
        strokeDasharray={`${len} ${len}`}
        animatedProps={fill}
      />
    </>
  );
}
