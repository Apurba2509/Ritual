import type { HabitTemplate } from '@/domain/catalog';
import type { AutoSource } from '@/domain/types';
import { screenSupported } from '@/features/screen';
import { sensingSupported } from '@/features/sensing';
import { healthSupported } from './health';
import { leetcodeSupported } from './leetcode';

/** The best automatic source for a template on this device (phone sensors first, then Health Connect). */
export function autoForTemplate(tpl: HabitTemplate): AutoSource | null {
  if (tpl.autoHint === 'screen' && tpl.screen && screenSupported) {
    return { provider: 'screen', scope: tpl.screen.scope, limitMin: tpl.screen.limitMin };
  }
  if (tpl.autoHint === 'device' && tpl.deviceMetric && sensingSupported) {
    return { provider: 'device', metric: tpl.deviceMetric };
  }
  if ((tpl.autoHint === 'device' || tpl.autoHint === 'health') && tpl.autoMetric && healthSupported) {
    return { provider: 'health', metric: tpl.autoMetric };
  }
  return null;
}

/** Whether a template can track itself here (GitHub/LeetCode still need a username). */
export function templateAutoAvailable(tpl: HabitTemplate): boolean {
  if (tpl.autoHint === 'github') return true;
  if (tpl.autoHint === 'leetcode') return leetcodeSupported;
  return autoForTemplate(tpl) !== null;
}
