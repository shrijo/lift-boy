import { writable, derived, get } from "svelte/store";
import type { StochasticSnapshot } from "../types";

// Re-export type for convenience
export type { StochasticSnapshot };

const MIN_NOTE = 0;
const MAX_NOTE = 7;
const DEFAULT_MIN = 0;
const DEFAULT_MAX = 7;
const DEFAULT_CHANGE_PROB = 50;

const DEFAULT_STOCHASTIC_SETTINGS = {
  orderIndex: 2, // Always random
};

export const stochasticMinNote = writable(DEFAULT_MIN);
export const stochasticMaxNote = writable(DEFAULT_MAX);
export const stochasticChangeProb = writable(DEFAULT_CHANGE_PROB);
export const stochasticCurrentNote = writable(DEFAULT_MIN);
export const stochasticSettings = writable(DEFAULT_STOCHASTIC_SETTINGS);

export const noteRange = derived(
  [stochasticMinNote, stochasticMaxNote],
  ([$min, $max]) => `${$min}-${$max}`
);

export function adjustStochasticMin(delta: number) {
  stochasticMinNote.update((value) => {
    const max = get(stochasticMaxNote);
    const next = Math.min(Math.max(value + delta, MIN_NOTE), MAX_NOTE);
    if (next > max) {
      stochasticMaxNote.set(next);
    }
    return next;
  });
}

export function adjustStochasticMax(delta: number) {
  stochasticMaxNote.update((value) => {
    const min = get(stochasticMinNote);
    const next = Math.min(Math.max(value + delta, MIN_NOTE), MAX_NOTE);
    if (next < min) {
      stochasticMinNote.set(next);
    }
    return next;
  });
}

export function adjustStochasticChangeProb(delta: number) {
  stochasticChangeProb.update((value) => {
    const next = Math.min(Math.max(value + delta * 5, 0), 100);
    return Math.round(next);
  });
}

export function setStochasticCurrentNote(note: number) {
  stochasticCurrentNote.set(Math.min(Math.max(note, MIN_NOTE), MAX_NOTE));
}

export function getStochasticSnapshot(): StochasticSnapshot {
  return {
    minNote: get(stochasticMinNote),
    maxNote: get(stochasticMaxNote),
    changeProb: get(stochasticChangeProb),
    currentNote: get(stochasticCurrentNote),
    settings: { ...get(stochasticSettings) },
  };
}

export function loadStochasticSnapshot(snapshot?: StochasticSnapshot) {
  const source = snapshot ?? createStochasticSnapshot();
  stochasticMinNote.set(Math.min(Math.max(source.minNote, MIN_NOTE), MAX_NOTE));
  stochasticMaxNote.set(Math.min(Math.max(source.maxNote, MIN_NOTE), MAX_NOTE));
  stochasticChangeProb.set(Math.min(Math.max(source.changeProb, 0), 100));
  stochasticCurrentNote.set(Math.min(Math.max(source.currentNote, MIN_NOTE), MAX_NOTE));
  stochasticSettings.set({
    orderIndex: 2, // Always random
  });
}

export function createStochasticSnapshot(): StochasticSnapshot {
  return {
    minNote: DEFAULT_MIN,
    maxNote: DEFAULT_MAX,
    changeProb: DEFAULT_CHANGE_PROB,
    currentNote: DEFAULT_MIN,
    settings: { ...DEFAULT_STOCHASTIC_SETTINGS },
  };
}

export function resetStochastic() {
  loadStochasticSnapshot(createStochasticSnapshot());
}
