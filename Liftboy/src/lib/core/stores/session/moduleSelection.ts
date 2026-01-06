/**
 * Module Selection State
 *
 * Manages the state of the module selection UI.
 * When user presses "L", opens a selector to swap the current module.
 */

import { writable, derived, get } from "svelte/store";
import type { ModuleCategory } from "../../types/project";

interface ModuleSelectionState {
  isOpen: boolean;
  category: ModuleCategory | null;
  selectedIndex: number;
}

const initialState: ModuleSelectionState = {
  isOpen: false,
  category: null,
  selectedIndex: 0,
};

const moduleSelectionState = writable<ModuleSelectionState>(initialState);

export const isModuleSelectorOpen = derived(
  moduleSelectionState,
  ($state) => $state.isOpen
);

export const selectorCategory = derived(
  moduleSelectionState,
  ($state) => $state.category
);

export const selectorSelectedIndex = derived(
  moduleSelectionState,
  ($state) => $state.selectedIndex
);

export function openModuleSelector(category: ModuleCategory) {
  moduleSelectionState.set({
    isOpen: true,
    category,
    selectedIndex: 0,
  });
}

export function closeModuleSelector() {
  moduleSelectionState.set(initialState);
}

export function moveSelectorUp() {
  moduleSelectionState.update((state) => ({
    ...state,
    selectedIndex: Math.max(0, state.selectedIndex - 1),
  }));
}

export function moveSelectorDown(maxIndex: number) {
  moduleSelectionState.update((state) => ({
    ...state,
    selectedIndex: Math.min(maxIndex, state.selectedIndex + 1),
  }));
}

export function getSelectorState() {
  return get(moduleSelectionState);
}
