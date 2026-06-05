import { Database } from './database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type XPEvent = Database['public']['Tables']['xp_events']['Row'];

export interface UserSettings {
  theme: 'dark' | 'light' | 'system';
  weekStartDay: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
  notificationsEnabled: boolean;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_key: string;
  earned_at: string;
}
