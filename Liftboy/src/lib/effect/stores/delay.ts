import { writable, derived, get } from "svelte/store";
import type { DelaySnapshot } from "../types";

// Re-export type for convenience
export type { DelaySnapshot };

const MIN_TIME = 0;
const MAX_TIME = 2;
const TIME_STEP = 0.01;

const MIN_FEEDBACK = 0;
const MAX_FEEDBACK = 0.95; // Prevent runaway feedback

const MIN_MIX = 0;
const MAX_MIX = 1;
const MIX_STEP = 0.05;

const DEFAULT_DELAY_SETTINGS = {
  time: 0.25,
  feedback: 0.3,
  mix: 0.3,
};

export const delayTime = writable(DEFAULT_DELAY_SETTINGS.time);
export const delayFeedback = writable(DEFAULT_DELAY_SETTINGS.feedback);
export const delayMix = writable(DEFAULT_DELAY_SETTINGS.mix);

export const delayTimeLabel = derived(
  delayTime,
  ($time) => `${$time.toFixed(2)} s`
);

export const delayFeedbackLabel = derived(
  delayFeedback,
  ($feedback) => `${Math.round($feedback * 100)}%`
);

export const delayMixLabel = derived(
  delayMix,
  ($mix) => `${Math.round($mix * 100)}%`
);

export function adjustDelayTime(delta: number) {
  delayTime.update((value) => {
    const next = Math.min(Math.max(value + delta * TIME_STEP, MIN_TIME), MAX_TIME);
    return Number(next.toFixed(2));
  });
}

export function adjustDelayFeedback(delta: number) {
  delayFeedback.update((value) => {
    const next = Math.min(Math.max(value + delta * MIX_STEP, MIN_FEEDBACK), MAX_FEEDBACK);
    return Number(next.toFixed(2));
  });
}

export function adjustDelayMix(delta: number) {
  delayMix.update((value) => {
    const next = Math.min(Math.max(value + delta * MIX_STEP, MIN_MIX), MAX_MIX);
    return Number(next.toFixed(2));
  });
}

export function getDelaySnapshot(): DelaySnapshot {
  return {
    time: get(delayTime),
    feedback: get(delayFeedback),
    mix: get(delayMix),
  };
}

export function loadDelaySnapshot(snapshot?: DelaySnapshot) {
  const source = snapshot ?? createDelaySnapshot();
  delayTime.set(Math.min(Math.max(source.time, MIN_TIME), MAX_TIME));
  delayFeedback.set(Math.min(Math.max(source.feedback, MIN_FEEDBACK), MAX_FEEDBACK));
  delayMix.set(Math.min(Math.max(source.mix, MIN_MIX), MAX_MIX));
}

export function createDelaySnapshot(): DelaySnapshot {
  return { ...DEFAULT_DELAY_SETTINGS };
}

export function resetDelay() {
  loadDelaySnapshot(createDelaySnapshot());
}
