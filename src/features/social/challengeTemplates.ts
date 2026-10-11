import type { HabitKind, Schedule } from '@/domain/types';

export interface ChallengeTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  kind: HabitKind;
  target: number;
  unit: string | null;
  schedule: Schedule;
  durationDays: number;
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: 'code30',
    title: '30 Days of Code',
    description: 'Ship something every day for a month. Commits, PRs, LeetCode — it all counts.',
    icon: 'git-commit',
    color: 'lime',
    kind: 'check',
    target: 1,
    unit: null,
    schedule: { type: 'daily' },
    durationDays: 30,
  },
  {
    id: 'steps21',
    title: '10K Steps · 21 Days',
    description: 'Walk 10,000 steps a day for three weeks.',
    icon: 'footprints',
    color: 'mint',
    kind: 'count',
    target: 10000,
    unit: 'steps',
    schedule: { type: 'daily' },
    durationDays: 21,
  },
  {
    id: 'nosugar',
    title: 'No Sugar November',
    description: 'Zero added sugar for 30 days. Read the labels.',
    icon: 'prohibit',
    color: 'rose',
    kind: 'check',
    target: 1,
    unit: null,
    schedule: { type: 'daily' },
    durationDays: 30,
  },
  {
    id: 'read',
    title: 'Read 20 Pages a Day',
    description: '20 pages, every day, for a month — that’s 2–3 books.',
    icon: 'book-open-text',
    color: 'butter',
    kind: 'count',
    target: 20,
    unit: 'pages',
    schedule: { type: 'daily' },
    durationDays: 30,
  },
  {
    id: 'calm',
    title: '14 Days of Calm',
    description: '10 minutes of meditation daily for two weeks.',
    icon: 'flower-lotus',
    color: 'lilac',
    kind: 'duration',
    target: 10,
    unit: 'min',
    schedule: { type: 'daily' },
    durationDays: 14,
  },
  {
    id: 'hard75',
    title: '75 Hard (Lite)',
    description: 'Work out 45 minutes every day for 75 days. No days off.',
    icon: 'barbell',
    color: 'coral',
    kind: 'duration',
    target: 45,
    unit: 'min',
    schedule: { type: 'daily' },
    durationDays: 75,
  },
];
