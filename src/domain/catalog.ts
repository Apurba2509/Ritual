import type { AutoSource, CategoryId, Difficulty, HabitKind, Schedule } from './types';

export const HABIT_COLORS = [
  '#FF6A3D', // ember
  '#F59E0B', // amber
  '#EAB308', // sun
  '#84CC16', // lime
  '#22C55E', // green
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#D946EF', // fuchsia
  '#F43F5E', // rose
];

export interface Category {
  id: CategoryId;
  name: string;
  emoji: string;
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: 'health', name: 'Health', emoji: '🍎', color: '#22C55E' },
  { id: 'fitness', name: 'Fitness', emoji: '💪', color: '#FF6A3D' },
  { id: 'mind', name: 'Mind', emoji: '🧘', color: '#8B5CF6' },
  { id: 'learning', name: 'Learning', emoji: '📚', color: '#3B82F6' },
  { id: 'career', name: 'Career', emoji: '💻', color: '#06B6D4' },
  { id: 'productivity', name: 'Focus', emoji: '🎯', color: '#F59E0B' },
  { id: 'social', name: 'Social', emoji: '💬', color: '#D946EF' },
  { id: 'finance', name: 'Money', emoji: '💰', color: '#14B8A6' },
  { id: 'creativity', name: 'Creative', emoji: '🎨', color: '#F43F5E' },
  { id: 'home', name: 'Home', emoji: '🏡', color: '#84CC16' },
];

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export interface HabitTemplate {
  id: string;
  name: string;
  emoji: string;
  color: string;
  category: CategoryId;
  kind: HabitKind;
  target: number;
  unit: string | null;
  schedule: Schedule;
  difficulty: Difficulty;
  /** Template that can be auto-tracked once the matching integration is connected. */
  autoHint?: AutoSource['provider'];
  autoMetric?: 'steps' | 'exercise' | 'sleep';
}

export const TEMPLATES: HabitTemplate[] = [
  {
    id: 'water',
    name: 'Drink water',
    emoji: '💧',
    color: '#06B6D4',
    category: 'health',
    kind: 'count',
    target: 8,
    unit: 'glasses',
    schedule: { type: 'daily' },
    difficulty: 'easy',
  },
  {
    id: 'steps',
    name: 'Walk 8,000 steps',
    emoji: '🚶',
    color: '#22C55E',
    category: 'fitness',
    kind: 'count',
    target: 8000,
    unit: 'steps',
    schedule: { type: 'daily' },
    difficulty: 'medium',
    autoHint: 'health',
    autoMetric: 'steps',
  },
  {
    id: 'workout',
    name: 'Work out',
    emoji: '🏋️',
    color: '#FF6A3D',
    category: 'fitness',
    kind: 'duration',
    target: 30,
    unit: 'min',
    schedule: { type: 'weekly', times: 4 },
    difficulty: 'hard',
    autoHint: 'health',
    autoMetric: 'exercise',
  },
  {
    id: 'sleep',
    name: 'Sleep 7+ hours',
    emoji: '😴',
    color: '#6366F1',
    category: 'health',
    kind: 'duration',
    target: 420,
    unit: 'min',
    schedule: { type: 'daily' },
    difficulty: 'medium',
    autoHint: 'health',
    autoMetric: 'sleep',
  },
  {
    id: 'meditate',
    name: 'Meditate',
    emoji: '🧘',
    color: '#8B5CF6',
    category: 'mind',
    kind: 'duration',
    target: 10,
    unit: 'min',
    schedule: { type: 'daily' },
    difficulty: 'medium',
  },
  {
    id: 'read',
    name: 'Read',
    emoji: '📖',
    color: '#3B82F6',
    category: 'learning',
    kind: 'count',
    target: 20,
    unit: 'pages',
    schedule: { type: 'daily' },
    difficulty: 'medium',
  },
  {
    id: 'code',
    name: 'Code every day',
    emoji: '👨‍💻',
    color: '#14B8A6',
    category: 'career',
    kind: 'check',
    target: 1,
    unit: null,
    schedule: { type: 'daily' },
    difficulty: 'medium',
    autoHint: 'github',
  },
  {
    id: 'leetcode',
    name: 'Solve a LeetCode problem',
    emoji: '🧩',
    color: '#F59E0B',
    category: 'career',
    kind: 'count',
    target: 1,
    unit: 'problems',
    schedule: { type: 'daily' },
    difficulty: 'hard',
    autoHint: 'leetcode',
  },
  {
    id: 'journal',
    name: 'Journal',
    emoji: '✍️',
    color: '#D946EF',
    category: 'mind',
    kind: 'check',
    target: 1,
    unit: null,
    schedule: { type: 'daily' },
    difficulty: 'easy',
  },
  {
    id: 'no_sugar',
    name: 'No added sugar',
    emoji: '🍭',
    color: '#F43F5E',
    category: 'health',
    kind: 'check',
    target: 1,
    unit: null,
    schedule: { type: 'daily' },
    difficulty: 'hard',
  },
  {
    id: 'deep_work',
    name: 'Deep work block',
    emoji: '🎯',
    color: '#F59E0B',
    category: 'productivity',
    kind: 'duration',
    target: 90,
    unit: 'min',
    schedule: { type: 'days', days: [1, 2, 3, 4, 5] },
    difficulty: 'hard',
  },
  {
    id: 'language',
    name: 'Practice a language',
    emoji: '🗣️',
    color: '#84CC16',
    category: 'learning',
    kind: 'duration',
    target: 15,
    unit: 'min',
    schedule: { type: 'daily' },
    difficulty: 'medium',
  },
  {
    id: 'stretch',
    name: 'Stretch',
    emoji: '🤸',
    color: '#22C55E',
    category: 'fitness',
    kind: 'duration',
    target: 10,
    unit: 'min',
    schedule: { type: 'daily' },
    difficulty: 'easy',
  },
  {
    id: 'gratitude',
    name: 'Write 3 gratitudes',
    emoji: '🙏',
    color: '#EAB308',
    category: 'mind',
    kind: 'count',
    target: 3,
    unit: 'things',
    schedule: { type: 'daily' },
    difficulty: 'easy',
  },
  {
    id: 'no_phone',
    name: 'No phone first hour',
    emoji: '📵',
    color: '#6366F1',
    category: 'productivity',
    kind: 'check',
    target: 1,
    unit: null,
    schedule: { type: 'daily' },
    difficulty: 'hard',
  },
  {
    id: 'call_family',
    name: 'Call family',
    emoji: '📞',
    color: '#D946EF',
    category: 'social',
    kind: 'check',
    target: 1,
    unit: null,
    schedule: { type: 'weekly', times: 2 },
    difficulty: 'easy',
  },
  {
    id: 'budget',
    name: 'Track spending',
    emoji: '💸',
    color: '#14B8A6',
    category: 'finance',
    kind: 'check',
    target: 1,
    unit: null,
    schedule: { type: 'daily' },
    difficulty: 'easy',
  },
  {
    id: 'tidy',
    name: 'Tidy up 10 min',
    emoji: '🧹',
    color: '#84CC16',
    category: 'home',
    kind: 'duration',
    target: 10,
    unit: 'min',
    schedule: { type: 'daily' },
    difficulty: 'easy',
  },
  {
    id: 'create',
    name: 'Make something',
    emoji: '🎨',
    color: '#F43F5E',
    category: 'creativity',
    kind: 'duration',
    target: 30,
    unit: 'min',
    schedule: { type: 'weekly', times: 3 },
    difficulty: 'medium',
  },
  {
    id: 'run',
    name: 'Go for a run',
    emoji: '🏃',
    color: '#FF6A3D',
    category: 'fitness',
    kind: 'check',
    target: 1,
    unit: null,
    schedule: { type: 'days', days: [1, 3, 5] },
    difficulty: 'hard',
    autoHint: 'health',
    autoMetric: 'exercise',
  },
];

export const TEMPLATE_BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

export const EMOJI_GROUPS: { title: string; emojis: string[] }[] = [
  {
    title: 'Body',
    emojis: ['💧', '🏃', '🚶', '🏋️', '🤸', '🧘', '🚴', '🏊', '🥗', '🍎', '😴', '💊', '🦷', '🧴', '🥤', '🚭'],
  },
  { title: 'Mind', emojis: ['🧠', '📖', '✍️', '📓', '🙏', '🌿', '☀️', '🌙', '🎧', '🕯️', '💭', '❤️'] },
  { title: 'Work', emojis: ['💻', '👨‍💻', '🧩', '🎯', '📈', '📝', '📚', '🗣️', '⏰', '📵', '✅', '🚀'] },
  { title: 'Life', emojis: ['🏡', '🧹', '🪴', '🐶', '📞', '💬', '💰', '💸', '🎨', '🎸', '📷', '🍳'] },
];

export const DEFAULT_HABIT_EMOJI = '✨';
