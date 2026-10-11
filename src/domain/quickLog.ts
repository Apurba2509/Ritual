import type { Habit } from './types';

/**
 * On-device natural-language logging: "ran 5k, read 20 pages and meditated 15 min".
 * Gemini handles this when AI is configured; this parser is the instant offline fallback
 * (and a cheap pre-pass so obvious matches don't need a network round trip).
 */

export interface ParsedLog {
  habitId: string;
  /** Amount to add to today's value (check habits: the full target). */
  amount: number;
  clause: string;
  confidence: number;
}

export interface QuickLogResult {
  logs: ParsedLog[];
  unmatched: string[];
}

const SYNONYMS: Record<string, string[]> = {
  run: ['run', 'ran', 'running', 'jog', 'jogged', 'jogging', 'sprint', 'km', '5k', '10k'],
  walk: ['walk', 'walked', 'walking', 'steps', 'stroll', 'hike', 'hiked'],
  read: ['read', 'reading', 'pages', 'page', 'book', 'chapter', 'chapters'],
  meditate: ['meditate', 'meditated', 'meditation', 'mindfulness', 'breathwork', 'breathing'],
  water: ['water', 'drank', 'drink', 'drinking', 'hydrate', 'hydrated', 'glasses', 'glass', 'bottles'],
  workout: ['workout', 'worked', 'gym', 'exercise', 'exercised', 'lifted', 'lifting', 'trained', 'training', 'weights'],
  code: ['code', 'coded', 'coding', 'programmed', 'programming', 'commit', 'committed', 'shipped', 'github'],
  leetcode: ['leetcode', 'problem', 'problems', 'dsa', 'algorithm', 'algorithms', 'solved'],
  journal: ['journal', 'journaled', 'journaling', 'wrote', 'diary'],
  sleep: ['sleep', 'slept', 'sleeping', 'nap'],
  stretch: ['stretch', 'stretched', 'stretching', 'yoga', 'mobility'],
  sugar: ['sugar', 'sweets', 'dessert', 'candy'],
  language: ['language', 'duolingo', 'spanish', 'french', 'german', 'japanese', 'hindi'],
  gratitude: ['gratitude', 'grateful', 'thankful', 'gratitudes'],
  tidy: ['tidy', 'tidied', 'clean', 'cleaned', 'cleaning', 'chores'],
  family: ['family', 'mom', 'dad', 'parents', 'called', 'call'],
  phone: ['phone', 'screen', 'social', 'instagram', 'scrolling'],
};

/** Words that turn a clause into "I did NOT do this". Plain "no" is excluded so "no sugar" still counts. */
const NEGATION = /\b(skip(ped|ping)?|didn'?t|did not|missed|couldn'?t|could not|no time for|forgot|failed to)\b/i;

const STOP = new Set([
  'a',
  'an',
  'the',
  'my',
  'for',
  'of',
  'to',
  'i',
  'did',
  'done',
  'and',
  'some',
  'today',
  'just',
  'min',
  'mins',
  'minutes',
  'hour',
  'hours',
  'hr',
  'hrs',
  'no',
  'every',
  'day',
]);

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  half: 0.5,
};

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

function canonical(token: string): string | null {
  for (const [key, words] of Object.entries(SYNONYMS)) if (words.includes(token)) return key;
  return null;
}

function habitConcepts(habit: Habit): { words: Set<string>; concepts: Set<string> } {
  const words = new Set(tokenize(habit.name).filter((w) => !STOP.has(w)));
  const concepts = new Set<string>();
  for (const w of words) {
    const c = canonical(w);
    if (c) concepts.add(c);
    // crude stemming so "meditating" ~ "meditate"
    for (const [key, list] of Object.entries(SYNONYMS)) {
      if (list.some((x) => x.length > 3 && (w.startsWith(x.slice(0, 4)) || x.startsWith(w.slice(0, 4))))) {
        concepts.add(key);
      }
    }
  }
  if (habit.auto?.provider === 'github') concepts.add('code');
  if (habit.auto?.provider === 'leetcode') concepts.add('leetcode');
  if (habit.unit) {
    const c = canonical(habit.unit.toLowerCase());
    if (c) concepts.add(c);
  }
  return { words, concepts };
}

/** Minutes from "1h 20m", "90 min", "1.5 hours", "half an hour". */
function parseMinutes(clause: string): number | null {
  const s = clause.toLowerCase();
  let total = 0;
  let found = false;
  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
  if (h) {
    total += parseFloat(h[1]) * 60;
    found = true;
  }
  const m = s.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/);
  if (m) {
    total += parseInt(m[1], 10);
    found = true;
  }
  if (!found && /half an hour/.test(s)) return 30;
  if (!found && /an hour/.test(s)) return 60;
  return found ? Math.round(total) : null;
}

function parseNumber(clause: string): number | null {
  const s = clause.toLowerCase().replace(/,(\d{3})/g, '$1');
  const k = s.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (k) return parseFloat(k[1]) * (/(step|walk)/.test(s) ? 1000 : 1);
  const n = s.match(/(\d+(?:\.\d+)?)/);
  if (n) return parseFloat(n[1]);
  for (const w of tokenize(s)) if (WORD_NUMBERS[w] !== undefined) return WORD_NUMBERS[w];
  return null;
}

export function splitClauses(text: string): string[] {
  return text
    .split(/[,;\n]|\band then\b|\bthen\b|\band\b|&|\.(?!\d)|\+/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 1);
}

export function parseQuickLog(text: string, habits: Habit[]): QuickLogResult {
  const active = habits.filter((h) => !h.archived && !h.deleted);
  const profiles = active.map((h) => ({ habit: h, ...habitConcepts(h) }));
  const logs = new Map<string, ParsedLog>();
  const unmatched: string[] = [];

  for (const clause of splitClauses(text)) {
    // "skipped meditation" / "didn't run" are not completions — and not new habits either.
    if (NEGATION.test(clause)) continue;
    const tokens = tokenize(clause);
    const clauseConcepts = new Set(tokens.map(canonical).filter(Boolean) as string[]);
    let best: { habit: Habit; score: number } | null = null;

    for (const p of profiles) {
      let score = 0;
      for (const c of clauseConcepts) if (p.concepts.has(c)) score += 2;
      for (const t of tokens) if (p.words.has(t)) score += 1.5;
      for (const t of tokens) {
        if (t.length < 4) continue;
        for (const w of p.words)
          if (w.length >= 4 && (w.startsWith(t.slice(0, 4)) || t.startsWith(w.slice(0, 4)))) score += 0.5;
      }
      if (score > 0 && (!best || score > best.score)) best = { habit: p.habit, score };
    }

    if (!best || best.score < 1.5) {
      unmatched.push(clause);
      continue;
    }

    const h = best.habit;
    let amount: number;
    if (h.kind === 'check') amount = h.target;
    else if (h.kind === 'duration') amount = parseMinutes(clause) ?? parseNumber(clause) ?? h.target;
    else amount = parseNumber(clause) ?? h.target;

    const prev = logs.get(h.id);
    logs.set(h.id, {
      habitId: h.id,
      amount: h.kind === 'check' ? h.target : (prev?.amount ?? 0) + amount,
      clause: prev ? `${prev.clause}, ${clause}` : clause,
      confidence: Math.min(1, best.score / 4),
    });
  }

  return { logs: [...logs.values()], unmatched };
}
