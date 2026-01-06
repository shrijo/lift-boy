import { writable, get } from "svelte/store";
import type { ClapState } from "../types";

// Re-export type for convenience
export type { ClapState };

const INITIAL_STATE: ClapState = {
  tone: 0.6,
  decay: 0.08,
  spread: 0.5,
};

const TONE_RANGE = { min: 0, max: 1, step: 0.05 } as const;
const DECAY_RANGE = { min: 0, max: 1, step: 0.01 } as const;
const SPREAD_RANGE = { min: 0, max: 1, step: 0.05 } as const;

export const clapSettings = writable<ClapState>(INITIAL_STATE);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function adjustValue(
  key: keyof ClapState,
  range: { min: number; max: number; step: number },
  delta: number
) {
  clapSettings.update((state) => ({
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

export function adjustSpread(delta: number) {
  adjustValue("spread", SPREAD_RANGE, delta);
}

export function getClapSnapshot(): ClapState {
  return { ...get(clapSettings) };
}

export function loadClapSnapshot(state?: Partial<ClapState>) {
  const base = createClapSnapshot();
  const next = state ? { ...base, ...state } : base;
  clapSettings.set(next as ClapState);
}

export function createClapSnapshot(): ClapState {
  return { ...INITIAL_STATE };
}

export function resetClap() {
  loadClapSnapshot();
}
