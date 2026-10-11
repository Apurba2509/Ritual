import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Polyline, Stop } from 'react-native-svg';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { alpha, useTheme } from '@/ui/theme';

/**
 * A route drawn as art — no map tiles, so it renders offline and looks the same everywhere.
 * Points are projected with a local equirectangular projection (fine at city scale).
 */
export function RouteArt({
  points,
  width,
  height,
  color,
  strokeWidth = 4,
  padding = 16,
  emptyLabel = 'No GPS route — distance from steps',
}: {
  points: [number, number][];
  width: number;
  height: number;
  color?: string;
  strokeWidth?: number;
  padding?: number;
  emptyLabel?: string;
}) {
  const t = useTheme();
  const c = color ?? t.accentInk;
  const projected = useMemo(() => {
    if (points.length < 2) return null;
    const lat0 = (points.reduce((s, p) => s + p[0], 0) / points.length) * (Math.PI / 180);
    const xy = points.map(([lat, lon]) => [lon * Math.cos(lat0), -lat] as [number, number]);
    const xs = xy.map((p) => p[0]);
    const ys = xy.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(1e-9, Math.max(...xs) - minX);
    const spanY = Math.max(1e-9, Math.max(...ys) - minY);
    const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
    const offX = (width - spanX * scale) / 2;
    const offY = (height - spanY * scale) / 2;
    return xy.map(([x, y]) => [offX + (x - minX) * scale, offY + (y - minY) * scale] as [number, number]);
  }, [points, width, height, padding]);

  if (!projected) {
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Icon name="footprints" size={28} color={t.textFaint} weight="duotone" />
        <Text variant="caption" tone="faint" align="center" style={{ maxWidth: width - 40 }}>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  const pts = projected.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [sx, sy] = projected[0];
  const [ex, ey] = projected[projected.length - 1];
  return (
    <Svg width={width} height={height}>
      <Polyline
        points={pts}
        fill="none"
        stroke={alpha(c, 0.22)}
        strokeWidth={strokeWidth * 3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Polyline
        points={pts}
        fill="none"
        stroke={c}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={sx} cy={sy} r={strokeWidth * 1.6} fill={t.bg} stroke={t.text} strokeWidth={2.5} />
      <Circle cx={ex} cy={ey} r={strokeWidth * 1.9} fill={c} stroke={t.bg} strokeWidth={2.5} />
    </Svg>
  );
}

/** Smooth elevation profile (area chart). */
export function ElevationChart({ values, width, height }: { values: number[]; width: number; height: number }) {
  const t = useTheme();
  if (values.length < 3) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(4, max - min);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 4 - ((v - min) / span) * (height - 12)] as [number, number]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="elev" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={t.accentInk} stopOpacity={0.35} />
          <Stop offset="1" stopColor={t.accentInk} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#elev)" />
      <Path d={line} fill="none" stroke={t.accentInk} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
