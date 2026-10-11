import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useTheme } from './theme';

export type IconName = ComponentProps<typeof Feather>['name'];

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const t = useTheme();
  return <Feather name={name} size={size} color={color ?? t.text} />;
}
