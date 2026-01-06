import { writable, get } from "svelte/store";
import type { KickState } from "../types";

// Re-export type for convenience
export type { KickState };

const INITIAL_STATE: KickState = {
  pitch: 60,
  pitchDecay: 0.05,
  tone: 0.5,
  decay: 0.3,
};

const PITCH_RANGE = { min: 20, max: 100, step: 1 } as const;
const PITCH_DECAY_RANGE = { min: 0, max: 1, step: 0.01 } as const;
const TONE_RANGE = { min: 0, max: 1, step: 0.05 } as const;
const DECAY_RANGE = { min: 0, max: 2, step: 0.05 } as const;

export const kickSettings = writable<KickState>(INITIAL_STATE);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function adjustValue(
  key: keyof KickState,
  range: { min: number; max: number; step: number },
  delta: number
) {
  kickSettings.update((state) => ({
    ...state,
    [key]: Number(
      clamp(state[key] + range.step * delta, range.min, range.max).toFixed(2)
    ),
  }));
}

export function adjustPitch(delta: number) {
  adjustValue("pitch", PITCH_RANGE, delta);
}

export function adjustPitchDecay(delta: number) {
  adjustValue("pitchDecay", PITCH_DECAY_RANGE, delta);
}

export function adjustTone(delta: number) {
  adjustValue("tone", TONE_RANGE, delta);
}

export function adjustDecay(delta: number) {
  adjustValue("decay", DECAY_RANGE, delta);
}

export function getKickSnapshot(): KickState {
  return { ...get(kickSettings) };
}

export function loadKickSnapshot(state?: Partial<KickState>) {
  const base = createKickSnapshot();
  const next = state ? { ...base, ...state } : base;
  kickSettings.set(next as KickState);
}

export function createKickSnapshot(): KickState {
  return { ...INITIAL_STATE };
}

export function resetKick() {
  loadKickSnapshot();
}
