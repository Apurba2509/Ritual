import { create } from 'zustand';
import type { IconName } from '@/ui/icons';

export type Celebration =
  | {
      kind: 'milestone';
      habitName: string;
      icon: string;
      color: string;
      streak: number;
      unit: 'day' | 'week';
      bonus: number;
    }
  | { kind: 'achievement'; id: string }
  | { kind: 'level'; level: number }
  | { kind: 'perfect'; streak: number };

export interface Toast {
  id: number;
  message: string;
  icon?: IconName;
  tone: 'default' | 'success' | 'error';
  action?: { label: string; onPress: () => void };
}

interface UIState {
  toasts: Toast[];
  celebrations: Celebration[];
  confetti: number;
  toast: (message: string, opts?: Partial<Omit<Toast, 'id' | 'message'>>) => void;
  dismissToast: (id: number) => void;
  celebrate: (c: Celebration) => void;
  shiftCelebration: () => void;
  burst: () => void;
}

let toastId = 0;

export const useUI = create<UIState>((set) => ({
  toasts: [],
  celebrations: [],
  confetti: 0,
  toast: (message, opts) =>
    set((s) => ({
      toasts: [...s.toasts.slice(-2), { id: ++toastId, message, tone: 'default', ...opts }],
    })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  celebrate: (c) => set((s) => ({ celebrations: [...s.celebrations, c] })),
  shiftCelebration: () => set((s) => ({ celebrations: s.celebrations.slice(1) })),
  burst: () => set((s) => ({ confetti: s.confetti + 1 })),
}));

export const toast = (message: string, opts?: Partial<Omit<Toast, 'id' | 'message'>>) =>
  useUI.getState().toast(message, opts);
