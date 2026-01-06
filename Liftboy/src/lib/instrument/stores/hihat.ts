import { writable, get } from "svelte/store";
import type { HihatState } from "../types";

// Re-export type for convenience
export type { HihatState };

const INITIAL_STATE: HihatState = {
  tone: 0.7,
  decay: 0.05,
  resonance: 0.5,
};

const TONE_RANGE = { min: 0, max: 1, step: 0.05 } as const;
const DECAY_RANGE = { min: 0, max: 1, step: 0.01 } as const;
const RESONANCE_RANGE = { min: 0, max: 1, step: 0.05 } as const;

export const hihatSettings = writable<HihatState>(INITIAL_STATE);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function adjustValue(
  key: keyof HihatState,
  range: { min: number; max: number; step: number },
  delta: number
) {
  hihatSettings.update((state) => ({
    ...state,
    [key]: Number(
      clamp(state[key] + range.step * delta, range.min, range.max).toFixed(2)
    ),
  }));
}

export function adjustTone(delta: number) {
  adjustValue("tone", TONE_RANGE, delta);
}

export function adjustDecay(delta: number) {
  adjustValue("decay", DECAY_RANGE, delta);
}

export function adjustResonance(delta: number) {
  adjustValue("resonance", RESONANCE_RANGE, delta);
}

export function getHihatSnapshot(): HihatState {
  return { ...get(hihatSettings) };
}

export function loadHihatSnapshot(state?: Partial<HihatState>) {
  const base = createHihatSnapshot();
  const next = state ? { ...base, ...state } : base;
  hihatSettings.set(next as HihatState);
}

export function createHihatSnapshot(): HihatState {
  return { ...INITIAL_STATE };
}

export function resetHihat() {
  loadHihatSnapshot();
}
