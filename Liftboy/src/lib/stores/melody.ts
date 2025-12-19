import { writable, derived, get } from "svelte/store";

export type MelodyOrder = "forward" | "backwards" | "random";
export type SkipOption = "none" | "second" | "third" | "fourth";

export interface BarState {
  id: number;
  value: number; // 0-7 range
  glide: boolean;
  randomize: boolean;
}

const TOTAL_BARS = 32;
const INITIAL_LENGTH = 8;
const MAX_NOTE = 7;

const skipOptions: SkipOption[] = ["none", "second", "third", "fourth"];
const orderOptions: MelodyOrder[] = ["forward", "backwards", "random"];

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

export const melodySettings = writable({
  length: INITIAL_LENGTH,
  skipIndex: 0,
  orderIndex: 0,
});

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
  ($settings) => orderOptions[$settings.orderIndex]
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
    const count = orderOptions.length;
    const nextIndex = (settings.orderIndex + delta + count) % count;
    return { ...settings, orderIndex: nextIndex };
  });
}

export function resetMelody() {
  bars.set(createInitialBars());
  selectedBar.set(0);
  melodySettings.set({ length: TOTAL_BARS, skipIndex: 0, orderIndex: 0 });
}
