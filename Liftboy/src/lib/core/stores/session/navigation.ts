import { writable, derived } from "svelte/store";

export const currentSection = writable(0);
export const slideIndices = writable<number[]>([]);

export function initializeNavigation(sectionCount: number) {
  slideIndices.set(Array(sectionCount).fill(0));
  currentSection.set(0);
}

export function setCurrentSection(index: number) {
  currentSection.set(index);
}

export function setSlideIndex(sectionIndex: number, slideIndex: number) {
  slideIndices.update((indices) => {
    if (!indices.length) {
      return indices;
    }

    const next = [...indices];
    next[sectionIndex] = slideIndex;
    return next;
  });
}

export const currentSlideIndex = derived(
  [currentSection, slideIndices],
  ([$section, $slides]) => $slides[$section] ?? 0
);
