import { writable, derived, get } from "svelte/store";
import type { EuclideanSnapshot } from "../types";
import { clockOptions, orderOptions } from "./sequencer";

// Re-export type for convenience
export type { EuclideanSnapshot };

const MIN_STEPS = 1;
const MAX_STEPS = 64;
const DEFAULT_STEPS = 16;
const DEFAULT_PULSES = 4;

const DEFAULT_EUCLIDEAN_SETTINGS = {
  steps: DEFAULT_STEPS,
  pulses: DEFAULT_PULSES,
  rotation: 0,
  settings: {
    clockIndex: 2,
    orderIndex: 0,
  },
};

export const euclideanSteps = writable(DEFAULT_STEPS);
export const euclideanPulses = writable(DEFAULT_PULSES);
export const euclideanRotation = writable(0);
export const euclideanSettings = writable(DEFAULT_EUCLIDEAN_SETTINGS.settings);

export const euclideanClockLabel = derived(
  euclideanSettings,
  ($settings) => clockOptions[$settings.clockIndex]?.label ?? "4 per beat"
);

export const euclideanOrderLabel = derived(
  euclideanSettings,
  ($settings) => orderOptions[$settings.orderIndex]
);

export function adjustEuclideanSteps(delta: number) {
  euclideanSteps.update((value) => {
    const next = Math.min(Math.max(value + delta, MIN_STEPS), MAX_STEPS);
    euclideanPulses.update((pulses) => Math.min(pulses, next));
    euclideanRotation.update((rotation) => Math.min(rotation, Math.max(next - 1, 0)));
    return next;
  });
}

export function adjustEuclideanPulses(delta: number) {
  euclideanPulses.update((value) => {
    const steps = get(euclideanSteps);
    return Math.min(Math.max(value + delta, 0), steps);
  });
}

export function adjustEuclideanRotation(delta: number) {
  euclideanRotation.update((value) => {
    const steps = get(euclideanSteps);
    const maxRotation = Math.max(steps - 1, 0);
    let next = value + delta;
    while (next < 0) next += steps;
    while (next > maxRotation) next -= steps;
    return next;
  });
}

export function cycleEuclideanClock(delta: number) {
  euclideanSettings.update((settings) => {
    const count = clockOptions.length;
    const nextIndex = (settings.clockIndex + delta + count) % count;
    return { ...settings, clockIndex: nextIndex };
  });
}

export function cycleEuclideanOrder(delta: number) {
  euclideanSettings.update((settings) => {
    const count = orderOptions.length;
    const nextIndex = (settings.orderIndex + delta + count) % count;
    return { ...settings, orderIndex: nextIndex };
  });
}

export function getEuclideanSnapshot(): EuclideanSnapshot {
  return {
    steps: get(euclideanSteps),
    pulses: get(euclideanPulses),
    rotation: get(euclideanRotation),
    settings: { ...get(euclideanSettings) },
  };
}

export function loadEuclideanSnapshot(snapshot?: EuclideanSnapshot) {
  const source = snapshot ?? createEuclideanSnapshot();
  euclideanSteps.set(Math.min(Math.max(source.steps, MIN_STEPS), MAX_STEPS));
  euclideanPulses.set(Math.min(Math.max(source.pulses, 0), source.steps));
  euclideanRotation.set(Math.min(Math.max(source.rotation, 0), Math.max(source.steps - 1, 0)));
  euclideanSettings.set({
    clockIndex: clampIndex(source.settings.clockIndex, clockOptions.length),
    orderIndex: clampIndex(source.settings.orderIndex, orderOptions.length),
  });
}

export function createEuclideanSnapshot(): EuclideanSnapshot {
  return { ...DEFAULT_EUCLIDEAN_SETTINGS };
}

export function resetEuclidean() {
  loadEuclideanSnapshot(createEuclideanSnapshot());
}

function clampIndex(index: number, length: number) {
  if (!length) return 0;
  const normalized = index % length;
  return normalized < 0 ? normalized + length : normalized;
}
