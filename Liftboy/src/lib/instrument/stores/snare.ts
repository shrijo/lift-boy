import { writable, get } from "svelte/store";
import type { SnareState } from "../types";

// Re-export type for convenience
export type { SnareState };

const INITIAL_STATE: SnareState = {
  tone: 0.5,
  snap: 0.8,
  decay: 0.15,
};

const TONE_RANGE = { min: 0, max: 1, step: 0.05 } as const;
const SNAP_RANGE = { min: 0, max: 1, step: 0.05 } as const;
const DECAY_RANGE = { min: 0, max: 1, step: 0.01 } as const;

export const snareSettings = writable<SnareState>(INITIAL_STATE);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function adjustValue(
  key: keyof SnareState,
  range: { min: number; max: number; step: number },
  delta: number
) {
  snareSettings.update((state) => ({
    ...state,
    [key]: Number(
      clamp(state[key] + range.step * delta, range.min, range.max).toFixed(2)
    ),
  }));
}

export function adjustTone(delta: number) {
  adjustValue("tone", TONE_RANGE, delta);
}

export function adjustSnap(delta: number) {
  adjustValue("snap", SNAP_RANGE, delta);
}

export function adjustDecay(delta: number) {
  adjustValue("decay", DECAY_RANGE, delta);
}

export function getSnareSnapshot(): SnareState {
  return { ...get(snareSettings) };
}

export function loadSnareSnapshot(state?: Partial<SnareState>) {
  const base = createSnareSnapshot();
  const next = state ? { ...base, ...state } : base;
  snareSettings.set(next as SnareState);
}

export function createSnareSnapshot(): SnareState {
  return { ...INITIAL_STATE };
}

export function resetSnare() {
  loadSnareSnapshot();
}
