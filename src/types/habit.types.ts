export type TrackingType = 'boolean' | 'counter' | 'timer' | 'checklist';
export type FrequencyType = 'daily' | 'weekdays' | 'custom' | 'x_per_week';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  color: string;
  category: string | null;
  difficulty: Difficulty;
  tracking_type: TrackingType;
  target_value: number | null;
  target_unit: string | null;
  frequency_type: FrequencyType;
  frequency_days: number[];
  frequency_x: number;
  group_id: string | null;
  sort_order: number;
  is_active: boolean;
  is_archived: boolean;
  reminder_time: string | null;
  reminder_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface HabitCompletion {
  id: string;
  habit_id: string;
  user_id: string;
  completed_date: string; // YYYY-MM-DD
  value: number;
  note: string | null;
  mood: 'great' | 'good' | 'neutral' | 'bad' | 'terrible' | null;
  energy_level: number | null;
  photo_url: string | null;
  voice_url: string | null;
  created_at: string;
}

export type NewHabit = Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_active' | 'is_archived'>;
