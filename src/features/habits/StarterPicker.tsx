import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { TEMPLATES } from '@/domain/catalog';
import { scheduleLabel } from '@/domain/habits';
import type { CategoryId } from '@/domain/types';
import { useApp } from '@/data/store';
import { useUI } from '@/data/ui';
import { autoForTemplate, templateAutoAvailable } from '@/features/integrations/autoFor';
import { enableAutoSensing } from '@/features/sensing';
import { requestNotificationPermission, rescheduleSoon } from '@/features/notifications/scheduler';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { useFrameWidth } from '@/ui/layout';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { radius, useTheme } from '@/ui/theme';
import { formatAmount } from './format';
import { HabitIcon } from './HabitIcon';

const STARTERS = ['steps', 'water', 'code', 'read', 'meditate', 'run', 'sleep', 'leetcode', 'walk', 'journal'];

const REMINDER_BY_CATEGORY: Partial<Record<CategoryId, string>> = {
  fitness: '07:00',
  health: '09:00',
  mind: '07:30',
  learning: '21:00',
  career: '18:00',
  productivity: '09:30',
  social: '19:00',
  finance: '20:30',
  creativity: '19:30',
  home: '18:30',
};

/** The whole "onboarding": tap a few, done. Shown on Today until the first habit exists. */
export function StarterPicker() {
  const t = useTheme();
  const width = useFrameWidth();
  const [picked, setPicked] = useState<string[]>([]);
  const tile = (width - 40 - 10) / 2;
  const templates = STARTERS.map((id) => TEMPLATES.find((tp) => tp.id === id)!).filter(Boolean);

  const add = async () => {
    const app = useApp.getState();
    const chosen = templates.filter((tp) => picked.includes(tp.id));
    const remind = Platform.OS !== 'web' ? await requestNotificationPermission().catch(() => false) : false;
    // Phone-sensed habits need the physical-activity permission; ask once, in context.
    if (chosen.some((tp) => autoForTemplate(tp)?.provider === 'device')) await enableAutoSensing().catch(() => null);
    chosen.forEach((tpl, order) => {
      const auto = autoForTemplate(tpl);
      app.createHabit({
        name: tpl.name,
        icon: tpl.icon,
        color: tpl.color,
        kind: tpl.kind,
        target: tpl.target,
        unit: tpl.unit,
        schedule: tpl.schedule,
        reminders: remind ? [REMINDER_BY_CATEGORY[tpl.category] ?? '09:00'] : [],
        auto,
        category: tpl.category,
        difficulty: tpl.difficulty,
        intention: null,
        challengeId: null,
        order,
      });
    });
    app.setOnboarded(true);
    rescheduleSoon(500);
    const ui = useUI.getState();
    ui.burst();
    if (chosen.some((tp) => tp.autoHint === 'github' || tp.autoHint === 'leetcode')) {
      ui.toast('Connect GitHub so coding habits check themselves', {
        icon: 'lightning',
        action: { label: 'Connect', onPress: () => router.push('/integrations') },
      });
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <Text variant="title">Let’s set up your day</Text>
        <Text tone="muted">Tap a few to start. Targets, times and everything else can change later.</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {templates.map((tpl, i) => {
          const on = picked.includes(tpl.id);
          const autoAvailable = templateAutoAvailable(tpl);
          return (
            <Animated.View
              key={tpl.id}
              entering={FadeInDown.delay(i * 35)
                .springify()
                .damping(18)}
            >
              <Tap
                onPress={() => setPicked((p) => (p.includes(tpl.id) ? p.filter((x) => x !== tpl.id) : [...p, tpl.id]))}
                scaleTo={0.96}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={tpl.name}
                style={{
                  width: tile,
                  minHeight: 118,
                  padding: 14,
                  gap: 10,
                  borderRadius: radius.lg,
                  backgroundColor: t.surface,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? (t.scheme === 'dark' ? t.accent : t.text) : t.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <HabitIcon icon={tpl.icon} color={tpl.color} size={40} />
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? t.accent : 'transparent',
                      borderWidth: on ? 0 : 1.5,
                      borderColor: t.borderStrong,
                    }}
                  >
                    {on ? <Icon name="check" size={13} color={t.onAccent} /> : null}
                  </View>
                </View>
                <View style={{ gap: 2 }}>
                  <Text variant="bodyStrong" numberOfLines={2} style={{ lineHeight: 19 }}>
                    {tpl.name}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {autoAvailable ? 'Auto-tracks · ' : ''}
                    {tpl.kind === 'check' ? scheduleLabel(tpl.schedule) : formatAmount(tpl, tpl.target)}
                  </Text>
                </View>
              </Tap>
            </Animated.View>
          );
        })}
      </View>

      <Button
        title={picked.length ? `Add ${picked.length} habit${picked.length > 1 ? 's' : ''}` : 'Pick at least one'}
        iconRight={picked.length ? 'arrow-right' : undefined}
        size="lg"
        full
        disabled={!picked.length}
        onPress={add}
      />

      <Card onPress={() => router.push('/coach')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            backgroundColor: t.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="magic-wand" size={22} color={t.accentInk} weight="duotone" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Have a goal instead?</Text>
          <Text variant="caption" tone="muted">
            Describe it and the AI coach builds a plan
          </Text>
        </View>
        <Icon name="caret-right" size={16} color={t.textFaint} />
      </Card>
      <Button
        title="Create my own habit"
        icon="plus"
        variant="ghost"
        size="sm"
        onPress={() => router.push('/habit/edit')}
        style={{ alignSelf: 'center' }}
      />
    </View>
  );
}
