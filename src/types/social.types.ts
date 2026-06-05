import { Profile } from './user.types';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
}

export interface Challenge {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  emoji: string;
  habit_config: any; // Defines the requirements of the challenge
  start_date: string;
  end_date: string;
  is_public: boolean;
  participant_count: number;
  created_at: string;
}

export interface ChallengeParticipant {
  challenge_id: string;
  user_id: string;
  joined_at: string;
  current_streak: number;
  total_completed: number;
}

export interface ActivityItem {
  id: string;
  user_id: string;
  type: 'streak_milestone' | 'achievement' | 'challenge_joined' | 'challenge_completed' | 'habit_created';
  metadata: Record<string, any>;
  is_public: boolean;
  created_at: string;
  // Joined fields for feed rendering
  profiles?: Partial<Profile>;
}
