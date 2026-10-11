import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Achievement, TIER_COLORS } from '@/domain/achievements';
import { Icon, isIconName } from '@/ui/Icon';
import { alpha, useTheme } from '@/ui/theme';

/** Rounded hexagon path for a w×h box. */
function hexPath(w: number, h: number) {
  const r = w * 0.12;
  const pts = [
    [w / 2, 0],
    [w, h * 0.25],
    [w, h * 0.75],
    [w / 2, h],
    [0, h * 0.75],
    [0, h * 0.25],
  ];
  // Round each corner with a quadratic curve through the vertex.
  let d = '';
  pts.forEach(([x, y], i) => {
    const [px, py] = pts[(i + pts.length - 1) % pts.length];
    const [nx, ny] = pts[(i + 1) % pts.length];
    const toPrev = Math.hypot(px - x, py - y);
    const toNext = Math.hypot(nx - x, ny - y);
    const a = [x + ((px - x) * r) / toPrev, y + ((py - y) * r) / toPrev];
    const b = [x + ((nx - x) * r) / toNext, y + ((ny - y) * r) / toNext];
    d += `${i === 0 ? 'M' : 'L'}${a[0].toFixed(2)} ${a[1].toFixed(2)} Q${x} ${y} ${b[0].toFixed(2)} ${b[1].toFixed(2)} `;
  });
  return `${d}Z`;
}

/** Achievement medal: a tier-coloured hexagon when earned, a quiet outline when locked. */
export function AchievementBadge({
  achievement,
  unlocked,
  size = 52,
}: {
  achievement: Achievement;
  unlocked: boolean;
  size?: number;
}) {
  const t = useTheme();
  const tier = TIER_COLORS[achievement.tier];
  const w = size;
  const h = size * 1.1;
  const d = hexPath(w - 2, h - 2);
  const id = `b-${achievement.id}-${size}`;
  return (
    <View style={{ width: w, height: h, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={w} height={h} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tier} stopOpacity={t.scheme === 'dark' ? 0.32 : 0.28} />
            <Stop offset="1" stopColor={tier} stopOpacity={t.scheme === 'dark' ? 0.1 : 0.08} />
          </LinearGradient>
        </Defs>
        <Path
          d={d}
          transform="translate(1 1)"
          fill={unlocked ? `url(#${id})` : t.surface2}
          stroke={unlocked ? alpha(tier, 0.75) : t.borderStrong}
          strokeWidth={1.5}
        />
      </Svg>
      <Icon
        name={isIconName(achievement.icon) ? achievement.icon : 'medal'}
        size={Math.round(size * 0.44)}
        color={unlocked ? (t.scheme === 'dark' ? tier : t.text) : t.textFaint}
        weight={unlocked ? 'fill' : 'regular'}
      />
    </View>
  );
}
