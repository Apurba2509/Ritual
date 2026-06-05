import { create } from 'zustand';

interface CelebrationData {
  streakCount: number;
  message?: string;
}

interface UIState {
  celebrationData: CelebrationData | null;
  triggerCelebration: (data: CelebrationData) => void;
  dismissCelebration: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  celebrationData: null,
  triggerCelebration: (data) => set({ celebrationData: data }),
  dismissCelebration: () => set({ celebrationData: null }),
}));
