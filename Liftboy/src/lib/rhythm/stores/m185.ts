import { writable, derived, get } from "svelte/store";
import type { M185Snapshot, M185Entry, M185Mode } from "../types";
import { clockOptions, orderOptions } from "./sequencer";

// Re-export types for convenience
export type { M185Snapshot, M185Entry, M185Mode };

const TOTAL_ENTRIES = 32;
const DEFAULT_LENGTH = 8;
const MIN_STEPS = 1;
const MAX_STEPS = 8;

export const modeOptions: M185Mode[] = ["repeat", "hold", "skip"];

const createInitialEntries = (): M185Entry[] =>
  Array.from(
    { length: TOTAL_ENTRIES },
    (_, id): M185Entry => ({
      id,
      steps: 1,
      mode: "repeat",
    })
  );

const DEFAULT_M185_SETTINGS = {
  length: DEFAULT_LENGTH,
  clockIndex: 2,
  orderIndex: 0,
};

export const m185Entries = writable<M185Entry[]>(createInitialEntries());
export const selectedEntry = writable(0);
export const m185Settings = writable(DEFAULT_M185_SETTINGS);

export const activeEntry = derived(
  [m185Entries, selectedEntry],
  ([$entries, $selected]) => $entries[$selected]
);

export const m185Length = derived(
  m185Settings,
  ($settings) => $settings.length
);

export const m185ClockLabel = derived(
  m185Settings,
  ($settings) => clockOptions[$settings.clockIndex]?.label ?? "4 per beat"
);

export const m185OrderLabel = derived(
  m185Settings,
  ($settings) => orderOptions[$settings.orderIndex]
);

export const modeLabel = derived(
  activeEntry,
  ($entry) => $entry?.mode ?? "repeat"
);

function clampSelected(index: number) {
  const length = get(m185Settings).length;
  return Math.max(0, Math.min(index, Math.max(length - 1, 0)));
}

export function selectM185Entry(index: number) {
  selectedEntry.set(clampSelected(index));
}

export function incrementSelectedEntry(delta: number) {
  const next = clampSelected(get(selectedEntry) + delta);
  selectedEntry.set(next);
}

export function adjustEntrySteps(delta: number, index = get(selectedEntry)) {
  m185Entries.update((list) =>
    list.map((entry, idx) => {
      if (idx !== index) return entry;
      const next = Math.min(Math.max(entry.steps + delta, MIN_STEPS), MAX_STEPS);
      return { ...entry, steps: next };
    })
  );
}

export function cycleEntryMode(delta: number, index = get(selectedEntry)) {
  m185Entries.update((list) =>
    list.map((entry, idx) => {
      if (idx !== index) return entry;
      const count = modeOptions.length;
      const currentIndex = modeOptions.indexOf(entry.mode);
      const nextIndex = (currentIndex + delta + count) % count;
      return { ...entry, mode: modeOptions[nextIndex] };
    })
  );
}

export function adjustM185Length(delta: number) {
  m185Settings.update((settings) => {
    const nextLength = Math.min(
      Math.max(settings.length + delta, 1),
      TOTAL_ENTRIES
    );
    const nextSettings = { ...settings, length: nextLength };
    selectedEntry.update((value) =>
      value >= nextLength ? Math.max(nextLength - 1, 0) : value
    );
    return nextSettings;
  });
}

export function cycleM185Clock(delta: number) {
  m185Settings.update((settings) => {
    const count = clockOptions.length;
    const nextIndex = (settings.clockIndex + delta + count) % count;
    return { ...settings, clockIndex: nextIndex };
  });
}

export function cycleM185Order(delta: number) {
  m185Settings.update((settings) => {
    const count = orderOptions.length;
    const nextIndex = (settings.orderIndex + delta + count) % count;
    return { ...settings, orderIndex: nextIndex };
  });
}

export function getM185Snapshot(): M185Snapshot {
  return {
    entries: cloneEntries(get(m185Entries)),
    selectedEntry: get(selectedEntry),
    settings: { ...get(m185Settings) },
  };
}

export function loadM185Snapshot(snapshot?: M185Snapshot) {
  const source = snapshot ?? createM185Snapshot();
  m185Entries.set(cloneEntries(source.entries));
  m185Settings.set({
    length: Math.min(Math.max(source.settings.length, 1), TOTAL_ENTRIES),
    clockIndex: clampIndex(source.settings.clockIndex, clockOptions.length),
    orderIndex: clampIndex(source.settings.orderIndex, orderOptions.length),
  });
  selectedEntry.set(0);
}

export function createM185Snapshot(): M185Snapshot {
  return {
    entries: createInitialEntries(),
    selectedEntry: 0,
    settings: { ...DEFAULT_M185_SETTINGS },
  };
}

export function resetM185() {
  loadM185Snapshot(createM185Snapshot());
}

function cloneEntries(list: M185Entry[]): M185Entry[] {
  return list.map((entry) => ({ ...entry }));
}

function clampIndex(index: number, length: number) {
  if (!length) return 0;
  const normalized = index % length;
  return normalized < 0 ? normalized + length : normalized;
}
