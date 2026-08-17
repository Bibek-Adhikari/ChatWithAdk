import { create } from 'zustand';
import type { TraceStep } from '../lib/trace-generator';

export interface VisualizerState {
  isOpen: boolean;
  code: string;
  trace: TraceStep[];
  currentStep: number;
  isPlaying: boolean;
  speed: number;

  open: (code?: string) => void;
  close: () => void;
  setCode: (code: string) => void;
  setTrace: (trace: TraceStep[]) => void;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  reset: () => void;
}

function clampStep(step: number, traceLength: number): number {
  const max = Math.max(0, traceLength - 1);
  return Math.max(0, Math.min(step, max));
}

export const useVisualizerStore = create<VisualizerState>()((set, get) => ({
  isOpen: false,
  code: '',
  trace: [],
  currentStep: 0,
  isPlaying: false,
  speed: 1,

  open: (code) =>
    set({
      isOpen: true,
      code: code ?? get().code,
      isPlaying: false,
    }),

  close: () => set({ isOpen: false, isPlaying: false }),

  setCode: (code) => set({ code }),

  setTrace: (trace) =>
    set({ trace, currentStep: 0, isPlaying: false }),

  goToStep: (step) =>
    set((s) => ({ currentStep: clampStep(step, s.trace.length) })),

  nextStep: () =>
    set((s) => ({
      currentStep: clampStep(s.currentStep + 1, s.trace.length),
      isPlaying: false,
    })),

  prevStep: () =>
    set((s) => ({
      currentStep: clampStep(s.currentStep - 1, s.trace.length),
      isPlaying: false,
    })),

  togglePlay: () =>
    set((s) => {
      if (s.isPlaying) return { isPlaying: false };
      const last = Math.max(0, s.trace.length - 1);
      if (s.currentStep >= last) return { currentStep: 0, isPlaying: true };
      return { isPlaying: true };
    }),

  setSpeed: (speed) => set({ speed }),

  reset: () =>
    set({ trace: [], currentStep: 0, isPlaying: false, code: '', isOpen: false }),
}));

export default useVisualizerStore;
