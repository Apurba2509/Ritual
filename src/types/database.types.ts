export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          level: number
          xp_total: number
          streak_grace_remaining: number
          settings: Json
          onboarding_completed: boolean
          created_at: string
        }
        Insert: {
          id: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          level?: number
          xp_total?: number
          streak_grace_remaining?: number
          settings?: Json
          onboarding_completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          display_name?: string | null
          avatar_url?: string | null
          level?: number
          xp_total?: number
          streak_grace_remaining?: number
          settings?: Json
          onboarding_completed?: boolean
          created_at?: string
        }
      }
      habits: {
        Row: {
          id: string
          user_id: string
          name: string
          emoji: string
          color: string
          category: string | null
          difficulty: 'easy' | 'medium' | 'hard'
          tracking_type: 'boolean' | 'counter' | 'timer' | 'checklist'
          target_value: number | null
          target_unit: string | null
          frequency_type: 'daily' | 'weekdays' | 'custom' | 'x_per_week'
          frequency_days: number[] | null
          frequency_x: number | null
          group_id: string | null
          sort_order: number
          is_active: boolean
          is_archived: boolean
          reminder_time: string | null
          reminder_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          emoji?: string
          color?: string
          category?: string | null
          difficulty?: 'easy' | 'medium' | 'hard'
          tracking_type?: 'boolean' | 'counter' | 'timer' | 'checklist'
          target_value?: number | null
          target_unit?: string | null
          frequency_type?: 'daily' | 'weekdays' | 'custom' | 'x_per_week'
          frequency_days?: number[] | null
          frequency_x?: number | null
          group_id?: string | null
          sort_order?: number
          is_active?: boolean
          is_archived?: boolean
          reminder_time?: string | null
          reminder_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          emoji?: string
          color?: string
          category?: string | null
          difficulty?: 'easy' | 'medium' | 'hard'
          tracking_type?: 'boolean' | 'counter' | 'timer' | 'checklist'
          target_value?: number | null
          target_unit?: string | null
          frequency_type?: 'daily' | 'weekdays' | 'custom' | 'x_per_week'
          frequency_days?: number[] | null
          frequency_x?: number | null
          group_id?: string | null
          sort_order?: number
          is_active?: boolean
          is_archived?: boolean
          reminder_time?: string | null
          reminder_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      habit_completions: {
        Row: {
          id: string
          habit_id: string
          user_id: string
          completed_date: string
          value: number
          note: string | null
          mood: 'great' | 'good' | 'neutral' | 'bad' | 'terrible' | null
          energy_level: number | null
          photo_url: string | null
          voice_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          habit_id: string
          user_id: string
          completed_date: string
          value?: number
          note?: string | null
          mood?: 'great' | 'good' | 'neutral' | 'bad' | 'terrible' | null
          energy_level?: number | null
          photo_url?: string | null
          voice_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          habit_id?: string
          user_id?: string
          completed_date?: string
          value?: number
          note?: string | null
          mood?: 'great' | 'good' | 'neutral' | 'bad' | 'terrible' | null
          energy_level?: number | null
          photo_url?: string | null
          voice_url?: string | null
          created_at?: string
        }
      }
      habit_streaks: {
        Row: {
          habit_id: string
          current_streak: number
          longest_streak: number
          last_completed_date: string | null
          updated_at: string
        }
        Insert: {
          habit_id: string
          current_streak?: number
          longest_streak?: number
          last_completed_date?: string | null
          updated_at?: string
        }
        Update: {
          habit_id?: string
          current_streak?: number
          longest_streak?: number
          last_completed_date?: string | null
          updated_at?: string
        }
      }
      xp_events: {
        Row: {
          id: string
          user_id: string
          amount: number
          reason: string
          habit_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          reason: string
          habit_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          reason?: string
          habit_id?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
