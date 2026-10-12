import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { addDays, fromDayKey, todayKey } from '@/domain/dates';
import { targetLabel } from '@/domain/habits';
import type { CoachAction, CoachCard as Card } from '@/domain/coach';
import { useBehavior, useCoachCards, useEasyMode, useHabitList } from '@/data/hooks';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { logTinyHabit } from '@/features/habits/actions';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { rescheduleSoon } from '@/features/notifications/scheduler';
import { Button } from '@/ui/Button';
import { Icon, isIconName } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { radius, useTheme } from '@/ui/theme';

/** How long a waved-away card stays quiet. */
const QUIET_DAYS: Partial<Record<Card['kind'], number>> = {
  'start-small': 365,
  'weak-day': 30,
  'best-time': 21,
  harder: 7,
  easier: 5,
};

export function runCoachAction(card: Card, action: CoachAction, openPicker: () => void) {
  const app = useApp.getState();
  const today = todayKey();
  switch (action.type) {
    case 'easy-mode': {
      app.setEasyMode(action.days);
      const until = fromDayKey(addDays(today, action.days - 1)).toLocaleDateString(undefined, { weekday: 'long' });
      toast(`Easy mode on until ${until}. Tiny versions count.`, { icon: 'plant', tone: 'success' });
      rescheduleSoon();
      break;
    }
    case 'log-tiny':
      logTinyHabit(action.habitId, today);
      break;
    case 'adjust': {
      app.applyAdjustment(action.adjustment);
      const h = useApp.getState().habits[action.adjustment.habitId];
      if (h)
        toast(
          `${h.name}: ${h.schedule.type === 'weekly' && action.adjustment.schedule ? `${h.schedule.times}× a week` : targetLabel(h)}`,
          { icon: 'check-circle', tone: 'success' },
        );
      rescheduleSoon();
      break;
    }
    case 'set-reminder': {
      app.updateHabit(action.habitId, { reminders: [action.time] });
      toast('Reminder moved', { icon: 'bell', tone: 'success' });
      rescheduleSoon();
      break;
    }
    case 'focus':
      router.push({ pathname: '/focus/[id]', params: { id: action.habitId, minutes: String(action.minutes) } });
      return; // the card stays until the habit is done
    case 'open-habit':
      router.push(`/habit/${action.habitId}`);
      return;
    case 'archive-picker':
      openPicker();
      return;
    case 'dismiss':
      break;
  }
  app.dismissCoach(card.key, QUIET_DAYS[card.kind] ?? 3);
}

/**
 * The coach's single most useful suggestion right now. Calm by design: one card, plain words,
 * one obvious action, and it goes away when waved off.
 */
export function CoachCard({ habitId }: { habitId?: string }) {
  const t = useTheme();
  const all = useCoachCards();
  const cards = habitId ? all.filter((c) => c.habitId === habitId) : all;
  const card = cards[0];
  const [picker, setPicker] = useState(false);
  if (!card) return null;

  const accent = t.scheme === 'dark' ? t.accent : t.accentInk;
  const iconColor = card.tone === 'care' ? t.text : accent;

  return (
    <>
      <Animated.View key={card.key} entering={FadeIn.duration(260)} exiting={FadeOut.duration(160)}>
        <View
          style={{
            borderRadius: radius.lg + 2,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: card.tone === 'win' ? t.accentSoft : t.border,
            padding: 16,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: card.tone === 'win' ? t.accentSoft : t.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={isIconName(card.icon) ? card.icon : 'sparkle'} size={18} color={iconColor} weight="fill" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="label" tone="muted">
                Coach
              </Text>
              <Text variant="subheading">{card.title}</Text>
              <Text variant="caption" tone="muted">
                {card.body}
              </Text>
            </View>
            <Tap
              onPress={() => runCoachAction(card, { type: 'dismiss' }, () => {})}
              hitSlop={12}
              accessibilityLabel="Dismiss"
              style={{ padding: 2 }}
            >
              <Icon name="x" size={16} color={t.textFaint} />
            </Tap>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button
              title={card.primary.label}
              size="sm"
              variant={card.tone === 'tip' ? 'secondary' : 'primary'}
              onPress={() => runCoachAction(card, card.primary.action, () => setPicker(true))}
            />
            {card.secondary ? (
              <Button
                title={card.secondary.label}
                size="sm"
                variant="ghost"
                onPress={() => runCoachAction(card, card.secondary!.action, () => setPicker(true))}
              />
            ) : null}
          </View>
        </View>
      </Animated.View>
      <PausePicker
        visible={picker}
        onClose={() => setPicker(false)}
        onDone={() => runCoachAction(card, { type: 'dismiss' }, () => {})}
      />
    </>
  );
}

/** "Fewer habits, more wins": pick what to put on hold (archived, history kept). */
function PausePicker({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const t = useTheme();
  const habits = useHabitList();
  const { patterns } = useBehavior();
  const [paused, setPaused] = useState<Set<string>>(new Set());
  // Suggest pausing the ones that are struggling the most; keep the strongest.
  const sorted = [...habits].sort(
    (a, b) => (patterns.get(a.id)?.strength.value ?? 0) - (patterns.get(b.id)?.strength.value ?? 0),
  );
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Focus on what's working"
      subtitle="Paused habits keep their history. Bring them back any time from Archive."
      footer={
        <Button
          title={paused.size ? `Pause ${paused.size} habit${paused.size > 1 ? 's' : ''}` : 'Keep all'}
          size="lg"
          full
          onPress={() => {
            for (const id of paused) useApp.getState().archiveHabit(id, true);
            if (paused.size)
              toast(`${paused.size} paused. Fewer things, done well.`, { icon: 'check-circle', tone: 'success' });
            rescheduleSoon();
            setPaused(new Set());
            onDone();
            onClose();
          }}
        />
      }
    >
      {sorted.map((h) => {
        const p = patterns.get(h.id);
        const on = paused.has(h.id);
        return (
          <Tap
            key={h.id}
            onPress={() =>
              setPaused((prev) => {
                const next = new Set(prev);
                if (next.has(h.id)) next.delete(h.id);
                else next.add(h.id);
                return next;
              })
            }
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
          >
            <HabitIcon icon={h.icon} color={h.color} size={36} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{h.name}</Text>
              <Text variant="caption" tone="muted">
                {p?.rate14 !== null && p?.rate14 !== undefined
                  ? `${Math.round(p.rate14 * 100)}% the last two weeks`
                  : 'New'}
              </Text>
            </View>
            <Icon
              name={on ? 'pause' : 'plus'}
              size={18}
              color={on ? t.text : t.textFaint}
              weight={on ? 'fill' : 'regular'}
            />
          </Tap>
        );
      })}
    </Sheet>
  );
}

/** Slim banner while easy mode is on. */
export function EasyModeBanner() {
  const t = useTheme();
  const on = useEasyMode();
  const until = useApp((s) => s.easyUntil);
  if (!on || !until) return null;
  const last = until === todayKey();
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: radius.md,
        backgroundColor: t.accentSoft,
      }}
    >
      <Icon name="plant" size={16} color={t.scheme === 'dark' ? t.accent : t.accentInk} weight="fill" />
      <Text variant="caption" style={{ flex: 1 }}>
        <Text variant="caption" weight="bold">
          Easy mode
        </Text>
        {` · tiny versions count ${last ? 'today' : `until ${fromDayKey(until).toLocaleDateString(undefined, { weekday: 'long' })}`}`}
      </Text>
      <Tap onPress={() => useApp.getState().setEasyMode(null)} hitSlop={10} accessibilityRole="button">
        <Text variant="caption" weight="bold">
          End
        </Text>
      </Tap>
    </Animated.View>
  );
}
