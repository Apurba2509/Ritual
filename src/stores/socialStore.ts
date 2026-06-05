import { create } from 'zustand';

export interface ActivityItem {
  id: string;
  user_id: string;
  type: 'streak_milestone' | 'achievement' | 'challenge_joined' | 'challenge_completed' | 'habit_created';
  metadata: any;
  is_public: boolean;
  created_at: string;
  // Hydrated user details
  user?: {
    username: string;
    avatar_url: string;
  };
}

interface SocialState {
  feed: ActivityItem[];
  setFeed: (items: ActivityItem[]) => void;
  addFeedItem: (item: ActivityItem) => void;
  friends: any[];
  setFriends: (friends: any[]) => void;
}

export const useSocialStore = create<SocialState>((set) => ({
  feed: [],
  setFeed: (items) => set({ feed: items }),
  addFeedItem: (item) => set((state) => ({ feed: [item, ...state.feed] })),
  friends: [],
  setFriends: (friends) => set({ friends }),
}));
