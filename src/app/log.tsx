import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHabitList, useToday } from '@/data/hooks';
import { useApp } from '@/data/store';
import { toast } from '@/data/ui';
import { planQuickLog, QuickLogPlan } from '@/features/ai/features';
import { aiConfigured } from '@/features/ai/gemini';
import { useVoiceInput } from '@/features/ai/voice';
import { LiveDot } from '@/features/sensing/TrackingStatus';
import { addProgress } from '@/features/habits/actions';
import { formatAmount, stepFor } from '@/features/habits/format';
import { HabitIcon } from '@/features/habits/HabitIcon';
import { Button, IconButton } from '@/ui/Button';
import { Chip, Pill } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { Tap } from '@/ui/Tap';
import { Text } from '@/ui/Text';
import { fonts, radius, useTheme } from '@/ui/theme';

export default function QuickLogScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const habits = useHabitList();
  const today = useToday();
  const { voice } = useLocalSearchParams<{ voice?: string }>();
  const [text, setText] = useState('');
  const input = useRef<TextInput>(null);
  const mic = useVoiceInput((spoken, isFinal) => {
    setText(spoken);
    setPlan(null);
    if (isFinal) analyze(spoken);
  });
  useEffect(() => {
    const id = setTimeout(() => (voice === '1' ? mic.start() : input.current?.focus()), 250);
    return () => clearTimeout(id);
    // start once on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<QuickLogPlan | null>(null);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const examples = useMemo(
    () =>
      habits.slice(0, 4).map((h) => {
        const name = h.name.toLowerCase();
        if (h.kind === 'duration') return `${name} for ${h.target} min`;
        if (h.kind === 'count' && !/\d/.test(name)) return `${name} ${formatAmount(h, h.target)}`;
        return name;
      }),
    [habits],
  );

  const analyze = async (said: string = text) => {
    if (!said.trim()) return;
    setBusy(true);
    const result = await planQuickLog(said, habits);
    setPlan(result);
    setAmounts(Object.fromEntries(result.logs.map((l) => [l.habitId, l.amount])));
    setExcluded(new Set());
    setBusy(false);
  };

  const confirm = () => {
    if (!plan) return;
    let n = 0;
    for (const l of plan.logs) {
      if (excluded.has(l.habitId)) continue;
      const amount = amounts[l.habitId] ?? l.amount;
      if (amount <= 0) continue;
      addProgress(l.habitId, today, amount, 'ai');
      if (l.note) {
        const e = useApp.getState().entries[`${l.habitId}_${today}`];
        useApp.getState().setNote(l.habitId, today, l.note, e?.mood ?? null);
      }
      n++;
    }
    if (n) {
      useApp.getState().bumpAiLogs();
      toast(`Logged ${n} habit${n > 1 ? 's' : ''}`, { icon: 'magic-wand', tone: 'success' });
    }
    router.back();
  };

  const byId = new Map(habits.map((h) => [h.id, h]));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <Animated.View entering={FadeIn.duration(160)} style={{ flex: 1, backgroundColor: t.overlay }}>
        <Pressable style={{ flex: 1 }} onPress={() => router.back()} accessibilityLabel="Close" />
        <Animated.View
          entering={FadeInUp.springify().damping(18)}
          style={{
            position: 'absolute',
            top: insets.top + 12,
            left: 12,
            right: 12,
            maxHeight: '86%',
            backgroundColor: t.bgElevated,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: t.borderStrong,
            overflow: 'hidden',
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: t.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="sparkle" size={19} color={t.accentInk} weight="fill" />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="subheading">Tell Ritual what you did</Text>
                <Text variant="caption" tone="faint">
                  {aiConfigured ? 'Gemini turns it into check-ins' : 'Parsed on your device'}
                </Text>
              </View>
              <IconButton name="x" size={34} accessibilityLabel="Close" onPress={() => router.back()} />
            </View>

            <TextInput
              ref={input}
              multiline
              value={text}
              onChangeText={(v) => {
                setText(v);
                if (plan) setPlan(null);
              }}
              placeholder={
                mic.listening ? 'Listening…' : 'Ran 5k this morning, read 20 pages and drank 6 glasses of water…'
              }
              placeholderTextColor={t.textFaint}
              selectionColor={t.scheme === 'dark' ? t.accent : t.text}
              cursorColor={t.scheme === 'dark' ? t.accent : t.text}
              style={
                {
                  minHeight: 104,
                  maxHeight: 200,
                  color: t.text,
                  fontFamily: fonts.medium,
                  fontSize: 21,
                  lineHeight: 29,
                  letterSpacing: -0.4,
                  textAlignVertical: 'top',
                  outlineStyle: 'none',
                } as object
              }
              onSubmitEditing={() => analyze()}
              blurOnSubmit
              returnKeyType="done"
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Tap
                onPress={mic.listening ? mic.stop : mic.start}
                scaleTo={0.9}
                haptics="medium"
                accessibilityRole="button"
                accessibilityLabel={mic.listening ? 'Stop listening' : 'Speak instead'}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  height: 46,
                  paddingHorizontal: 18,
                  borderRadius: 23,
                  backgroundColor: mic.listening ? t.accent : t.surface2,
                }}
              >
                {mic.listening ? (
                  <LiveDot color={t.onAccent} size={8} />
                ) : (
                  <Icon name="microphone" size={18} color={t.text} weight="fill" />
                )}
                <Text variant="bodyStrong" color={mic.listening ? t.onAccent : t.text}>
                  {mic.listening ? 'Listening… tap to stop' : 'Say it'}
                </Text>
              </Tap>
              <Text variant="caption" tone="faint" style={{ flex: 1 }}>
                {mic.listening ? 'Speak naturally. Ritual logs it when you pause.' : 'or type, then press Log it'}
              </Text>
            </View>

            {!plan && examples.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {examples.map((e) => (
                  <Chip key={e} label={e} size="sm" onPress={() => setText(text ? `${text}, ${e}` : e)} />
                ))}
              </View>
            ) : null}

            {plan ? (
              <Animated.View entering={FadeInDown.springify().damping(18)} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text variant="label" tone="muted" style={{ flex: 1 }}>
                    {plan.logs.length ? 'Here’s what I got' : 'No matching habits'}
                  </Text>
                  <Pill
                    label={plan.engine === 'ai' ? 'Gemini' : 'On-device'}
                    color={plan.engine === 'ai' ? t.accentInk : t.textMuted}
                    icon={plan.engine === 'ai' ? 'sparkle' : 'device-mobile'}
                  />
                </View>
                {plan.logs.map((l) => {
                  const h = byId.get(l.habitId);
                  if (!h) return null;
                  const off = excluded.has(h.id);
                  const amount = amounts[h.id] ?? l.amount;
                  return (
                    <View
                      key={h.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        padding: 10,
                        borderRadius: radius.lg,
                        backgroundColor: t.surface2,
                        opacity: off ? 0.45 : 1,
                      }}
                    >
                      <HabitIcon icon={h.icon} color={h.color} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong" numberOfLines={1}>
                          {h.name}
                        </Text>
                        <Text variant="caption" tone="muted">
                          {h.kind === 'check' ? 'Mark done' : `+ ${formatAmount(h, amount)}`}
                          {l.note ? ` · “${l.note}”` : ''}
                        </Text>
                      </View>
                      {h.kind !== 'check' && !off ? (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <IconButton
                            name="minus"
                            size={30}
                            accessibilityLabel="Less"
                            onPress={() =>
                              setAmounts((a) => ({ ...a, [h.id]: Math.max(0, (a[h.id] ?? amount) - stepFor(h)) }))
                            }
                          />
                          <IconButton
                            name="plus"
                            size={30}
                            accessibilityLabel="More"
                            onPress={() => setAmounts((a) => ({ ...a, [h.id]: (a[h.id] ?? amount) + stepFor(h) }))}
                          />
                        </View>
                      ) : null}
                      <Tap
                        onPress={() =>
                          setExcluded((prev) => {
                            const next = new Set(prev);
                            if (next.has(h.id)) next.delete(h.id);
                            else next.add(h.id);
                            return next;
                          })
                        }
                        hitSlop={8}
                        accessibilityLabel={off ? 'Include' : 'Exclude'}
                      >
                        <Icon
                          name={off ? 'plus-circle' : 'check-circle'}
                          size={26}
                          color={off ? t.textFaint : t.accentInk}
                          weight={off ? 'regular' : 'fill'}
                        />
                      </Tap>
                    </View>
                  );
                })}
                {plan.unmatched.length ? (
                  <View style={{ gap: 6 }}>
                    <Text variant="caption" tone="faint">
                      Not a habit yet: {plan.unmatched.map((u) => `“${u}”`).join(', ')}
                    </Text>
                    <Tap
                      onPress={() => {
                        router.back();
                        setTimeout(() => router.push('/habit/edit'), 200);
                      }}
                    >
                      <Text variant="caption" weight="bold">
                        + Turn it into a habit
                      </Text>
                    </Tap>
                  </View>
                ) : null}
              </Animated.View>
            ) : null}

            {plan && plan.logs.length ? (
              <Button
                title={`Log ${plan.logs.length - excluded.size} habit${plan.logs.length - excluded.size === 1 ? '' : 's'}`}
                icon="check"
                size="lg"
                full
                disabled={plan.logs.length - excluded.size <= 0}
                onPress={confirm}
              />
            ) : (
              <Button
                title={busy ? 'Thinking…' : 'Log it'}
                icon="paper-plane-tilt"
                size="lg"
                full
                loading={busy}
                disabled={!text.trim()}
                onPress={() => analyze()}
              />
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
