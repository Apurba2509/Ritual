import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AppState, View } from 'react-native';
import { formatMinutes, guardedMs, pauseStats, summarize } from '@/domain/screen';
import { useApp } from '@/data/store';
import { Icon } from '@/ui/Icon';
import { Section } from '@/ui/Screen';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { radius, useTheme } from '@/ui/theme';
import { refreshScreen, screenSupported, useScreen } from './index';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Today's phone use at a glance, on Today. Tap for the full picture and the mindful pause. */
export function ScreenCard() {
  const t = useTheme();
  const access = useScreen((s) => s.access);
  const days = useScreen((s) => s.days);
  const events = useScreen((s) => s.events);
  const guard = useApp((s) => s.guard);

  useFocusEffect(
    useCallback(() => {
      if (!screenSupported) return;
      refreshScreen();
      const id = setInterval(() => AppState.currentState === 'active' && refreshScreen(), 120_000);
      return () => clearInterval(id);
    }, []),
  );

  if (!screenSupported) return null;

  if (!access) {
    return (
      <Section title="Screen time">
        <Tap
          onPress={() => router.push('/screen-time')}
          scaleTo={0.98}
          accessibilityRole="button"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 16,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: t.borderStrong,
            borderStyle: 'dashed',
          }}
        >
          <Icon name="hourglass-high" size={22} color={t.text} weight="fill" />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">See where your time goes</Text>
            <Text variant="caption" tone="muted">
              Screen time and a mindful pause before the apps that pull you in.
            </Text>
          </View>
          <Icon name="arrow-right" size={18} color={t.text} />
        </Tap>
      </Section>
    );
  }

  const s = summarize(days);
  const today = s.today;
  const guarded = new Set(guard.apps);
  const stats = pauseStats(events, startOfToday());
  const better = s.vsAvg !== null && s.vsAvg <= -0.1;
  const worse = s.vsAvg !== null && s.vsAvg >= 0.15;

  return (
    <Section title="Screen time">
      <Tap onPress={() => router.push('/screen-time')} scaleTo={0.99} accessibilityRole="button" style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text weight="bold" size={28} tabular style={{ letterSpacing: -1.2 }}>
            {today ? formatMinutes(today.totalMs) : '0m'}
          </Text>
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            {today ? `${today.pickups} pickups` : 'today'}
            {guard.apps.length && today ? ` · ${formatMinutes(guardedMs(today, guarded))} on guarded apps` : ''}
          </Text>
          {better || worse ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon
                name={better ? 'trend-down' : 'trend-up'}
                size={14}
                color={better ? (t.scheme === 'dark' ? t.accent : t.accentInk) : t.textMuted}
                weight="bold"
              />
              <Text variant="caption" weight="semibold" tone={better ? 'default' : 'muted'}>
                {Math.abs(Math.round((s.vsAvg ?? 0) * 100))}%
              </Text>
            </View>
          ) : null}
        </View>
        <HourStrip hourly={today?.hourly ?? []} />
        {guard.enabled && stats.resisted > 0 ? (
          <Text variant="caption" tone="muted">
            You chose not to open a guarded app {stats.resisted} time{stats.resisted > 1 ? 's' : ''} today.
          </Text>
        ) : !guard.enabled ? (
          <Text variant="caption" tone="muted">
            Add a mindful pause before the apps that pull you in.
          </Text>
        ) : null}
      </Tap>
    </Section>
  );
}

/** 24 thin bars: when today's screen time happened. */
export function HourStrip({ hourly, height = 28 }: { hourly: number[]; height?: number }) {
  const t = useTheme();
  const max = Math.max(15 * 60_000, ...hourly);
  const now = new Date().getHours();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height }}>
      {Array.from({ length: 24 }, (_, h) => {
        const v = hourly[h] ?? 0;
        const late = h >= 23 || h < 5;
        return (
          <View
            key={h}
            style={{
              flex: 1,
              height: Math.max(2, Math.round((v / max) * height)),
              borderRadius: 2,
              backgroundColor: v > 0 ? (late ? t.textMuted : t.text) : h <= now ? t.surface3 : t.surface2,
              opacity: v > 0 ? 1 : 0.7,
            }}
          />
        );
      })}
    </View>
  );
}
