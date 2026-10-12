import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { dayShort, formatMinutes, MIN, pauseStats, screenInsights, summarize } from '@/domain/screen';
import { useHabitList } from '@/data/hooks';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { formatTime, TimeSheet } from '@/features/habits/pickers';
import {
  enableScreenTime,
  needsRestrictedSettingsStep,
  openAppDetails,
  openPauseSettings,
  previewPause,
  refreshScreen,
  screenSupported,
  updateGuard,
  useScreen,
} from '@/features/screen';
import { HourStrip } from '@/features/screen/ScreenCard';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { Icon, IconName, isIconName } from '@/ui/Icon';
import { ListGroup, ListRow } from '@/ui/ListRow';
import { Screen, Section } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { radius, useTheme } from '@/ui/theme';

const weekAgo = () => Date.now() - 7 * 86_400_000;
const addMinutes = (hhmm: string, mins: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (h * 60 + m + mins + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export default function ScreenTimeScreen() {
  const access = useScreen((s) => s.access);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    await refreshScreen(7);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Coming back from Settings (usage access / accessibility): pick up the change immediately.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => sub.remove();
  }, [load]);

  if (!screenSupported) {
    return (
      <Screen back="close" title="Screen time">
        <EmptyState
          icon="hourglass-high"
          title="Screen time works on Android"
          body="Ritual reads Android's own usage log to show where your time goes and adds a mindful pause before the apps you choose."
        />
      </Screen>
    );
  }

  return access ? <Dashboard loading={loading} /> : <Intro onGranted={load} />;
}

// ─── Before access: show the value, then one action ─────────────────────────

const SAMPLE_HOURS = [6, 2, 0, 0, 0, 0, 0, 9, 21, 14, 9, 12, 24, 17, 8, 13, 19, 27, 33, 39, 46, 51, 37, 22].map(
  (m) => m * MIN,
);
const SAMPLE_APPS: { icon: IconName; label: string; minutes: number; tint: string }[] = [
  { icon: 'chats-circle', label: 'Social', minutes: 81, tint: 'rose' },
  { icon: 'film-slate', label: 'Video', minutes: 54, tint: 'lilac' },
  { icon: 'game-controller', label: 'Games', minutes: 23, tint: 'sky' },
];

function Intro({ onGranted }: { onGranted: () => void }) {
  const t = useTheme();
  return (
    <Screen
      back="close"
      footer={
        <View style={{ gap: 10 }}>
          <Button
            title="Show my screen time"
            size="lg"
            full
            onPress={() => {
              if (enableScreenTime()) onGranted();
            }}
          />
          <Text variant="caption" tone="muted" align="center">
            Next, switch on Ritual in the list that opens.
          </Text>
        </View>
      }
    >
      {/* A preview of what you'll see, built from the real components with sample data. */}
      <Animated.View entering={FadeIn.duration(300)} style={{ pointerEvents: 'none' }}>
        <View
          style={{
            padding: 20,
            gap: 16,
            borderRadius: radius.xl,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.border,
            overflow: 'hidden',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="label" tone="muted" style={{ flex: 1 }}>
              Today
            </Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: t.surface2 }}>
              <Text variant="caption" size={11} tone="muted">
                Example
              </Text>
            </View>
          </View>
          <View style={{ gap: 2 }}>
            <Text weight="heavy" size={44} tabular style={{ letterSpacing: -2, lineHeight: 48 }}>
              3h 12m
            </Text>
            <Text variant="caption" tone="muted">
              58 pickups · most of it after 6 PM
            </Text>
          </View>
          <HourStrip hourly={SAMPLE_HOURS} height={40} />
          <View style={{ gap: 12 }}>
            {SAMPLE_APPS.map((a) => (
              <View key={a.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <HabitIcon icon={a.icon} color={a.tint} size={30} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row' }}>
                    <Text variant="caption" weight="semibold" style={{ flex: 1 }}>
                      {a.label}
                    </Text>
                    <Text variant="caption" tone="muted" tabular>
                      {formatMinutes(a.minutes * MIN)}
                    </Text>
                  </View>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: t.surface3 }}>
                    <View
                      style={{
                        width: `${Math.round((a.minutes / 81) * 100)}%`,
                        height: '100%',
                        borderRadius: 2,
                        backgroundColor: t.text,
                      }}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
          <LinearGradient
            colors={[`${t.surface}00`, t.surface]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 56 }}
          />
        </View>
      </Animated.View>

      <View style={{ gap: 10, marginTop: 8 }}>
        <Text variant="hero" size={34}>
          Where did today go?
        </Text>
        <Text tone="muted">
          See your day by the hour, then put one breath between you and the apps that pull you in. You stay in charge:
          it never blocks, it just asks.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <TrustChip icon="device-mobile" label="Stays on this phone" />
        <TrustChip icon="eye-slash" label="Never sees your screen" />
        <TrustChip icon="battery-charging" label="No battery drain" />
      </View>
    </Screen>
  );
}

function TrustChip({ icon, label }: { icon: IconName; label: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 32,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: t.surface2,
      }}
    >
      <Icon name={icon} size={14} color={t.scheme === 'dark' ? t.accent : t.accentInk} weight="fill" />
      <Text variant="caption" weight="semibold">
        {label}
      </Text>
    </View>
  );
}

// ─── With access: the day, the week, the apps, and the pause ────────────────

function Dashboard({ loading }: { loading: boolean }) {
  const t = useTheme();
  const serviceOn = useScreen((s) => s.serviceOn);
  const days = useScreen((s) => s.days);
  const apps = useScreen((s) => s.apps);
  const events = useScreen((s) => s.events);
  const suggestedAll = useScreen((s) => s.suggested);
  const guard = useApp((s) => s.guard);
  const habits = useHabitList();
  const [tuneOpen, setTuneOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  const guarded = useMemo(() => new Set(guard.apps), [guard.apps]);
  const suggested = suggestedAll.filter((a) => !guarded.has(a.pkg)).slice(0, 8);
  const labels = useMemo(() => Object.fromEntries(Object.values(apps).map((a) => [a.pkg, a.label])), [apps]);
  const s = summarize(days);
  const today = s.today;
  const hasData = days.some((d) => d.totalMs > 0);
  const weekStats = pauseStats(events, weekAgo());
  const hasLimitHabit = habits.some((h) => h.auto?.provider === 'screen');
  const insights = screenInsights(days, labels, guarded, {
    bedtimeOn: guard.bedtime.enabled && guard.enabled,
    hasLimitHabit,
    selfPkg: Constants.expoConfig?.android?.package,
  });
  const max = Math.max(60 * MIN, ...days.map((d) => d.totalMs));
  const firstPickup = today?.firstPickupAt
    ? new Date(today.firstPickupAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : null;

  const toggleGuard = (pkg: string) =>
    updateGuard({ apps: guarded.has(pkg) ? guard.apps.filter((p) => p !== pkg) : [...guard.apps, pkg] });

  const setPause = (on: boolean) => {
    updateGuard({ enabled: on });
    if (on && !serviceOn) setSetupOpen(true);
  };

  return (
    <>
      <Screen back="close" title="Screen time">
        {hasData ? (
          <Animated.View entering={FadeIn.duration(220)} style={{ gap: 16 }}>
            <View style={{ gap: 4 }}>
              <Text weight="heavy" size={52} tabular style={{ letterSpacing: -2.5, lineHeight: 56 }}>
                {today ? formatMinutes(today.totalMs) : '0m'}
              </Text>
              {s.vsAvg !== null ? (
                <Text variant="caption" tone="muted">
                  {s.vsAvg <= 0
                    ? `${Math.round(-s.vsAvg * 100)}% less than usual by this time`
                    : `${Math.round(s.vsAvg * 100)}% more than usual by this time`}
                </Text>
              ) : null}
            </View>
            {today?.estimated ? (
              <Text variant="caption" tone="muted">
                From Android’s daily summary. Pickups and the hour-by-hour view appear once the detailed log fills in.
              </Text>
            ) : (
              <View style={{ flexDirection: 'row', gap: 22 }}>
                <Mini label="Pickups" value={today ? String(today.pickups) : '0'} />
                <Mini label="First pickup" value={firstPickup ?? '—'} />
                <Mini label="Longest stretch" value={today?.longestMs ? formatMinutes(today.longestMs) : '—'} />
              </View>
            )}
            <View style={{ gap: 8, display: today?.estimated ? 'none' : 'flex' }}>
              <HourStrip hourly={today?.hourly ?? []} height={44} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {['12 AM', '6 AM', '12 PM', '6 PM', '11 PM'].map((l) => (
                  <Text key={l} variant="caption" size={10} tone="faint">
                    {l}
                  </Text>
                ))}
              </View>
            </View>
          </Animated.View>
        ) : (
          <View
            style={{
              padding: 20,
              gap: 8,
              borderRadius: radius.lg,
              backgroundColor: t.surface,
              borderWidth: 1,
              borderColor: t.border,
            }}
          >
            <Icon name="hourglass-high" size={22} color={t.text} weight="fill" />
            <Text variant="subheading">{loading ? 'Reading your day…' : 'Collecting your first day'}</Text>
            <Text variant="caption" tone="muted">
              Android shares usage with Ritual from now on. Your day fills in as you use your phone; check back in a few
              hours.
            </Text>
          </View>
        )}

        {hasData && days.length > 1 ? (
          <Section title="This week">
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 92 }}>
              {days.map((d) => (
                <View key={d.day} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <View
                    style={{
                      width: '100%',
                      height: Math.max(3, Math.round((d.totalMs / max) * 64)),
                      borderRadius: 6,
                      backgroundColor: d.final ? t.surface3 : t.text,
                    }}
                  />
                  <Text
                    variant="caption"
                    size={11}
                    tone={d.final ? 'muted' : 'default'}
                    weight={d.final ? undefined : 'bold'}
                  >
                    {dayShort(d.day)}
                  </Text>
                </View>
              ))}
            </View>
            {s.avgMs !== null ? (
              <Text variant="caption" tone="muted">
                About {formatMinutes(s.avgMs)} a day · {Math.round(s.avgPickups ?? 0)} pickups
              </Text>
            ) : null}
          </Section>
        ) : null}

        {/* The pause: one switch, the guarded apps, everything else one tap away */}
        <Section title="Mindful pause">
          <View
            style={{
              borderRadius: radius.lg,
              backgroundColor: t.surface,
              borderWidth: 1,
              borderColor: t.border,
              overflow: 'hidden',
            }}
          >
            <ListRow
              icon="hand-palm"
              title="Breathe before guarded apps"
              subtitle={
                !guard.enabled
                  ? 'A short pause before the apps you choose'
                  : !serviceOn
                    ? 'One quick setup step left'
                    : guard.apps.length
                      ? `On for ${guard.apps.length} app${guard.apps.length > 1 ? 's' : ''}`
                      : 'On · guard an app below'
              }
              toggle={guard.enabled}
              onToggle={setPause}
              last
            />
            {guard.enabled && !serviceOn ? (
              <Tap
                onPress={() => setSetupOpen(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  marginHorizontal: 16,
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: radius.md,
                  backgroundColor: t.surface2,
                }}
              >
                <Icon name="warning" size={16} color={t.warning} weight="fill" />
                <Text variant="caption" weight="semibold" style={{ flex: 1 }}>
                  Finish setup to turn it on
                </Text>
                <Icon name="caret-right" size={14} color={t.textMuted} />
              </Tap>
            ) : null}
            {guard.apps.length ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 16,
                  paddingBottom: 14,
                }}
              >
                <View style={{ flexDirection: 'row' }}>
                  {guard.apps.slice(0, 5).map((pkg, i) =>
                    apps[pkg]?.icon ? (
                      <Image
                        key={pkg}
                        source={{ uri: apps[pkg].icon }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          marginLeft: i ? -6 : 0,
                          borderWidth: 2,
                          borderColor: t.surface,
                        }}
                      />
                    ) : null,
                  )}
                </View>
                <Text variant="caption" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
                  {guard.apps.map((p) => labels[p] ?? p.split('.').pop()).join(', ')}
                </Text>
              </View>
            ) : null}
            {suggested.length ? (
              <View style={{ gap: 8, paddingHorizontal: 16, paddingBottom: 14 }}>
                <Text variant="caption" tone="muted">
                  {guard.apps.length ? 'Also on this phone' : 'Tap the apps that pull you in'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {suggested.map((a) => (
                    <Tap
                      key={a.pkg}
                      onPress={() => toggleGuard(a.pkg)}
                      accessibilityRole="button"
                      accessibilityLabel={`Guard ${a.label}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        height: 36,
                        paddingLeft: 6,
                        paddingRight: 12,
                        borderRadius: 18,
                        backgroundColor: t.surface2,
                      }}
                    >
                      {a.icon ? (
                        <Image source={{ uri: a.icon }} style={{ width: 24, height: 24, borderRadius: 7 }} />
                      ) : null}
                      <Text variant="caption" weight="semibold">
                        {a.label}
                      </Text>
                      <Icon name="plus" size={12} color={t.textMuted} weight="bold" />
                    </Tap>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
              <Button
                title="Preview"
                icon="eye"
                size="sm"
                variant="secondary"
                onPress={() => previewPause(guard.apps[0] ?? s.topApps[0]?.pkg ?? 'com.android.settings')}
              />
              <Button
                title="Fine-tune"
                icon="sliders-horizontal"
                size="sm"
                variant="ghost"
                onPress={() => setTuneOpen(true)}
              />
            </View>
          </View>
          {weekStats.shown > 0 ? (
            <View style={{ flexDirection: 'row', gap: 22, paddingTop: 4 }}>
              <Mini label="Pauses this week" value={String(weekStats.shown)} />
              <Mini label="Chose not to open" value={String(weekStats.resisted)} highlight />
              <Mini label="Swapped for a habit" value={String(weekStats.swapped)} />
            </View>
          ) : null}
        </Section>

        {/* Insights, phrased as facts with one action each */}
        {insights.length ? (
          <Section title="Worth knowing">
            <View style={{ gap: 10 }}>
              {insights.slice(0, 2).map((i) => (
                <View
                  key={i.id}
                  style={{
                    padding: 16,
                    gap: 10,
                    borderRadius: radius.lg,
                    backgroundColor: t.surface,
                    borderWidth: 1,
                    borderColor: t.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Icon name={isIconName(i.icon) ? i.icon : 'sparkle'} size={18} color={t.text} weight="fill" />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text variant="bodyStrong">{i.title}</Text>
                      <Text variant="caption" tone="muted">
                        {i.body}
                      </Text>
                    </View>
                  </View>
                  {i.action ? (
                    <View style={{ flexDirection: 'row', paddingLeft: 30 }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        title={
                          i.action === 'bedtime'
                            ? 'Turn on bedtime pause'
                            : i.action === 'guard'
                              ? 'Guard it'
                              : i.action === 'catchup'
                                ? 'Set catch-up times'
                                : 'Make it a habit'
                        }
                        onPress={() => {
                          if (i.action === 'bedtime') {
                            setPause(true);
                            updateGuard({ bedtime: { ...guard.bedtime, enabled: true } });
                            toast('Longer pause after 11 PM', { icon: 'moon', tone: 'success' });
                          } else if (i.action === 'guard' && i.id.startsWith('top:')) {
                            toggleGuard(i.id.slice(4));
                            if (!guard.enabled) setPause(true);
                          } else if (i.action === 'catchup') {
                            setTuneOpen(true);
                          } else {
                            router.push({ pathname: '/habit/edit', params: { template: 'screen_cap' } });
                          }
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {/* Apps */}
        {s.topApps.length ? (
          <Section
            title="Apps today"
            action={
              loading ? (
                <Text variant="caption" tone="faint">
                  Updating…
                </Text>
              ) : undefined
            }
          >
            <ListGroup>
              {s.topApps.map((a, idx, arr) => {
                const info = apps[a.pkg];
                const on = guarded.has(a.pkg);
                return (
                  <ListRow
                    key={a.pkg}
                    leading={
                      info?.icon ? (
                        <Image source={{ uri: info.icon }} style={{ width: 34, height: 34, borderRadius: 9 }} />
                      ) : (
                        <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: t.surface2 }} />
                      )
                    }
                    title={info?.label ?? a.pkg}
                    subtitle={`${formatMinutes(a.ms)} · opened ${a.opens}×`}
                    right={
                      <Tap
                        onPress={() => toggleGuard(a.pkg)}
                        hitSlop={10}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`Guard ${info?.label ?? a.pkg}`}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          height: 32,
                          paddingHorizontal: 12,
                          borderRadius: 16,
                          backgroundColor: on ? t.text : t.surface2,
                        }}
                      >
                        <Icon
                          name={on ? 'shield-check' : 'hand-palm'}
                          size={14}
                          color={on ? t.bg : t.textMuted}
                          weight="fill"
                        />
                        <Text variant="caption" weight="bold" color={on ? t.bg : t.textMuted}>
                          {on ? 'Guarded' : 'Guard'}
                        </Text>
                      </Tap>
                    }
                    last={idx === arr.length - 1}
                  />
                );
              })}
            </ListGroup>
          </Section>
        ) : null}

        <Text variant="caption" tone="faint" align="center">
          From Android’s own usage log. No tracking service, no polling, nothing leaves your phone.
        </Text>
      </Screen>

      <TuneSheet visible={tuneOpen} onClose={() => setTuneOpen(false)} />
      {/* Stays open while they're in Settings; closes itself once the pause is on. */}
      <SetupSheet visible={setupOpen && !serviceOn} onClose={() => setSetupOpen(false)} />
    </>
  );
}

// ─── Fine-tuning (progressive disclosure) ───────────────────────────────────

function TuneSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const guard = useApp((s) => s.guard);
  const habits = useHabitList();
  const [timeEdit, setTimeEdit] = useState<{ kind: 'catchup' | 'bed-start' | 'bed-end'; index?: number } | null>(null);

  return (
    <>
      <Sheet visible={visible} onClose={onClose} title="Fine-tune the pause">
        <View style={{ gap: 8 }}>
          <Text variant="label" tone="muted">
            When you continue, allow
          </Text>
          <Segmented<string>
            size="sm"
            value={String(guard.allowMinutes)}
            onChange={(v) => updateGuard({ allowMinutes: Number(v) })}
            options={[
              { value: '2', label: '2 min' },
              { value: '5', label: '5 min' },
              { value: '10', label: '10 min' },
              { value: '15', label: '15 min' },
            ]}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label" tone="muted">
            Catch-up times
          </Text>
          <Text variant="caption" tone="muted">
            Guarded apps open freely here. Knowing there’s a set time takes the edge off missing out.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {guard.catchups.map((c, i) => (
              <Chip
                key={`${c.start}-${i}`}
                icon="clock"
                label={`${formatTime(c.start)} – ${formatTime(c.end)}`}
                selected
                onPress={() => setTimeEdit({ kind: 'catchup', index: i })}
              />
            ))}
            {guard.catchups.length < 4 ? (
              <Chip icon="plus" label="Add" onPress={() => setTimeEdit({ kind: 'catchup' })} />
            ) : null}
          </View>
          {guard.catchups.length ? (
            <Tap onPress={() => updateGuard({ catchups: guard.catchups.slice(0, -1) })} hitSlop={8}>
              <Text variant="caption" tone="faint">
                Remove the last one
              </Text>
            </Tap>
          ) : null}
        </View>

        <ListGroup>
          <ListRow
            icon="moon"
            title="Longer pause at bedtime"
            subtitle={`${formatTime(guard.bedtime.start)} – ${formatTime(guard.bedtime.end)}`}
            toggle={guard.bedtime.enabled}
            onToggle={(v) => updateGuard({ bedtime: { ...guard.bedtime, enabled: v } })}
            last
          />
        </ListGroup>

        <View style={{ gap: 8 }}>
          <Text variant="label" tone="muted">
            Offer instead
          </Text>
          <Text variant="caption" tone="muted">
            The pause suggests the two-minute version of this habit, so the urge goes somewhere good.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {habits
              .filter((h) => h.auto?.provider !== 'screen')
              .slice(0, 8)
              .map((h) => {
                const on = guard.swapHabitId === h.id;
                return (
                  <Tap
                    key={h.id}
                    onPress={() => updateGuard({ swapHabitId: on ? null : h.id })}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingVertical: 6,
                      paddingLeft: 6,
                      paddingRight: 12,
                      borderRadius: 20,
                      backgroundColor: on ? t.text : t.surface2,
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <HabitIcon icon={h.icon} color={h.color} size={24} />
                    <Text variant="caption" weight="semibold" color={on ? t.bg : t.text}>
                      {h.name}
                    </Text>
                  </Tap>
                );
              })}
          </View>
        </View>
      </Sheet>

      <TimeSheet
        visible={!!timeEdit}
        title={timeEdit?.kind === 'catchup' ? 'Catch-up starts at' : 'Bedtime'}
        initial={
          timeEdit?.kind === 'catchup' && timeEdit.index !== undefined ? guard.catchups[timeEdit.index].start : '17:00'
        }
        onClose={() => setTimeEdit(null)}
        onPick={(v) => {
          if (timeEdit?.kind !== 'catchup') return;
          const win = { start: v, end: addMinutes(v, 30) };
          const list = [...guard.catchups];
          if (timeEdit.index !== undefined) list[timeEdit.index] = win;
          else list.push(win);
          updateGuard({ catchups: list.sort((a, b) => a.start.localeCompare(b.start)) });
        }}
      />
    </>
  );
}

/** One-time Android setup, only shown when someone actually turns the pause on. */
function SetupSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const restricted = needsRestrictedSettingsStep();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="One quick setup"
      subtitle="Android asks you to switch the pause on yourself. It sees which app opens, never what's on screen."
      scroll={false}
      footer={<Button title="Open Accessibility" icon="arrow-up-right" size="lg" full onPress={openPauseSettings} />}
    >
      <View style={{ gap: 14 }}>
        <Step n={1} text="In Accessibility → Installed apps, choose “Ritual mindful pause” and switch it on." />
        {/* Android only offers "Allow restricted settings" after it has blocked the switch once. */}
        {restricted ? (
          <Step
            n={2}
            text="If Android says “Restricted setting”, tap OK. Then open App info, tap ⋮ at the top right, choose Allow restricted settings, and do step 1 again."
            action="Open App info"
            onPress={openAppDetails}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

function Mini({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ gap: 2, flexShrink: 1 }}>
      <Text
        weight="bold"
        size={20}
        tabular
        color={highlight ? (t.scheme === 'dark' ? t.accent : t.accentInk) : undefined}
      >
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

function Step({ n, text, action, onPress }: { n: number; text: string; action?: string; onPress?: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: t.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="caption" weight="bold">
          {n}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Text variant="caption">{text}</Text>
        {action && onPress ? (
          <View style={{ flexDirection: 'row' }}>
            <Button size="sm" variant="secondary" title={action} icon="arrow-up-right" onPress={onPress} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
