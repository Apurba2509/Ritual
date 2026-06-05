export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export const HABIT_CATEGORIES: Category[] = [
  { id: 'health', name: 'Health & Fitness', emoji: '💪', color: '#10B981' }, // Emerald
  { id: 'mind', name: 'Mindfulness', emoji: '🧘', color: '#8B5CF6' }, // Violet
  { id: 'learning', name: 'Learning', emoji: '📚', color: '#3B82F6' }, // Blue
  { id: 'productivity', name: 'Productivity', emoji: '⚡', color: '#F59E0B' }, // Amber
  { id: 'social', name: 'Social & Family', emoji: '🤝', color: '#EC4899' }, // Pink
  { id: 'finance', name: 'Finance', emoji: '💰', color: '#14B8A6' }, // Teal
  { id: 'hobbies', name: 'Hobbies', emoji: '🎨', color: '#F43F5E' }, // Rose
  { id: 'chores', name: 'Chores', emoji: '🧹', color: '#6B7280' }, // Gray
];
