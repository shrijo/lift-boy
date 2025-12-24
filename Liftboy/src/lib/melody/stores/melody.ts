import { writable, derived, get } from "svelte/store";
import type { MelodyOrder, SkipOption, BarState, MelodySettings, MelodySnapshot } from "../types";

// Re-export types for convenience
export type { MelodyOrder, SkipOption, BarState, MelodySettings, MelodySnapshot };

const TOTAL_BARS = 32;
const INITIAL_LENGTH = 8;
const MAX_NOTE = 7;

export const skipOptions: SkipOption[] = ["none", "second", "third", "fourth"];
export const melodyOrderOptions: MelodyOrder[] = [
  "forward",
  "backwards",
  "random",
];

const createInitialBars = () =>
  Array.from(
    { length: TOTAL_BARS },
    (_, id): BarState => ({
      id,
      value: 0,
      glide: false,
      randomize: false,
    })
  );

export const bars = writable<BarState[]>(createInitialBars());
export const selectedBar = writable(0);

const DEFAULT_MELODY_SETTINGS: MelodySettings = {
  length: INITIAL_LENGTH,
  skipIndex: 0,
  orderIndex: 0,
};

export const melodySettings = writable<MelodySettings>({ ...DEFAULT_MELODY_SETTINGS });

export const activeBar = derived(
  [bars, selectedBar],
  ([$bars, $selected]) => $bars[$selected]
);
export const sequenceLength = derived(
  melodySettings,
  ($settings) => $settings.length
);
export const skipLabel = derived(
  melodySettings,
  ($settings) => skipOptions[$settings.skipIndex]
);
export const orderLabel = derived(
  melodySettings,
  ($settings) => melodyOrderOptions[$settings.orderIndex]
);

function clampSelected(index: number) {
  const { length } = get(melodySettings);
  return Math.max(0, Math.min(index, Math.max(length - 1, 0)));
}

export function selectBar(index: number) {
  selectedBar.set(clampSelected(index));
}

export function incrementSelectedBar(delta: number) {
  const next = clampSelected(get(selectedBar) + delta);
  selectedBar.set(next);
}

export function adjustBarValue(delta: number, index = get(selectedBar)) {
  bars.update((list) =>
    list.map((bar, idx) => {
      if (idx !== index) return bar;
      const next = Math.max(0, Math.min(bar.value + delta, MAX_NOTE));
      return { ...bar, value: next };
    })
  );
}

export function setBarGlide(active: boolean, index = get(selectedBar)) {
  bars.update((list) =>
    list.map((bar, idx) => (idx === index ? { ...bar, glide: active } : bar))
  );
}

export function setBarRandomize(active: boolean, index = get(selectedBar)) {
  bars.update((list) =>
    list.map((bar, idx) =>
      idx === index ? { ...bar, randomize: active } : bar
    )
  );
}

export function randomizeBar(index = get(selectedBar)) {
  bars.update((list) =>
    list.map((bar, idx) =>
      idx === index
        ? { ...bar, value: Math.floor(Math.random() * (MAX_NOTE + 1)) }
        : bar
    )
  );
}

export function adjustMelodyLength(delta: number) {
  melodySettings.update((settings) => {
    const nextLength = Math.min(
      Math.max(settings.length + delta, 1),
      TOTAL_BARS
    );
    const nextSettings = { ...settings, length: nextLength };
    selectedBar.update((value) =>
      value >= nextLength ? Math.max(nextLength - 1, 0) : value
    );
    return nextSettings;
  });
}

export function cycleSkip(delta: number) {
  melodySettings.update((settings) => {
    const count = skipOptions.length;
    const nextIndex = (settings.skipIndex + delta + count) % count;
    return { ...settings, skipIndex: nextIndex };
  });
}

export function cycleMelodyOrder(delta: number) {
  melodySettings.update((settings) => {
    const count = melodyOrderOptions.length;
    const nextIndex = (settings.orderIndex + delta + count) % count;
    return { ...settings, orderIndex: nextIndex };
  });
}

export function resetMelody() {
  loadMelodySnapshot(createMelodySnapshot());
}

export function getMelodySnapshot(): MelodySnapshot {
  return {
    bars: cloneBars(get(bars)),
    settings: { ...get(melodySettings) },
  };
}

export function loadMelodySnapshot(snapshot?: MelodySnapshot) {
  const source = snapshot ?? createMelodySnapshot();
  bars.set(cloneBars(source.bars));
  const targetSettings: MelodySettings = {
    length: Math.min(Math.max(source.settings.length, 1), TOTAL_BARS),
    skipIndex: clampIndex(source.settings.skipIndex, skipOptions.length),
    orderIndex: clampIndex(
      source.settings.orderIndex,
      melodyOrderOptions.length
    ),
  };
  melodySettings.set(targetSettings);
  selectedBar.set(0);
}

export function createMelodySnapshot(): MelodySnapshot {
  return {
    bars: createInitialBars(),
    settings: { ...DEFAULT_MELODY_SETTINGS },
  };
}

function cloneBars(list: BarState[]) {
  return list.map((bar) => ({ ...bar }));
}

function clampIndex(index: number, length: number) {
  if (!length) return 0;
  const normalized = index % length;
  return normalized < 0 ? normalized + length : normalized;
}
