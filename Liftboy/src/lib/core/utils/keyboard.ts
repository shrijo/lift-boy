/**
 * Keyboard Control System
 *
 * Global keyboard event dispatcher for Lift-Boy's keyboard-first workflow.
 * Manages input selection state and emits custom events for components.
 *
 * Features:
 * - Global keydown listener with custom event dispatch
 * - Dual-mode arrow keys (navigate sections OR adjust inputs)
 * - Input selection state (1-4 keys select inputs)
 * - BPM selection mode (T key)
 * - Playback control (Space key)
 *
 * State Machine:
 * - No selection: Arrow keys navigate sections/slides
 * - Input selected (1-4): Arrow keys adjust that input's value
 * - BPM selected (T): Arrow keys adjust BPM
 * - Escape: Clear all selections
 *
 * See: docs/KEYBOARD.md for full documentation
 */

export type KeyboardEventType =
  | "scroll-next-section"
  | "scroll-prev-section"
  | "scroll-next-slide"
  | "scroll-prev-slide"
  | "select-input"
  | "clear-input-selection"
  | "adjust-input-up"
  | "adjust-input-down"
  | "increment-input"
  | "select-bpm"
  | "clear-bpm-selection"
  | "adjust-bpm-up"
  | "adjust-bpm-down"
  | "toggle-playback"
  | "open-module-selector";

export interface KeyboardEventDetail {
  type: KeyboardEventType;
  inputIndex?: number;
  magnitude?: number;
}

const EVENT_NAME = "keyboard-control";
const keyMap: Record<string, KeyboardEventType> = {
  ArrowUp: "scroll-prev-section",
  ArrowDown: "scroll-next-section",
  ArrowLeft: "scroll-prev-slide",
  ArrowRight: "scroll-next-slide",
};

const TAP_THRESHOLD_MS = 200; // Time threshold for tap vs hold

let isInitialized = false;
let activeInputIndex: number | null = null;
let bpmSelected = false;
let keyPressTimestamps: Map<string, number> = new Map();

function emit(type: KeyboardEventType, inputIndex?: number, magnitude?: number) {
  window.dispatchEvent(
    new CustomEvent<KeyboardEventDetail>(EVENT_NAME, {
      detail: { type, inputIndex, magnitude },
    })
  );
}

function shouldIgnoreTarget(active: Element | null): boolean {
  if (!active) return false;
  const tag = active.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    (active as HTMLElement).isContentEditable
  );
}

function handleKeyDown(event: KeyboardEvent) {
  if (shouldIgnoreTarget(document.activeElement)) return;

  if (event.key === " ") {
    emit("toggle-playback");
    event.preventDefault();
    return;
  }

  if (event.key === "t" || event.key === "T") {
    if (!bpmSelected) {
      bpmSelected = true;
      emit("select-bpm");
    }
    event.preventDefault();
    return;
  }

  if (event.key === "l" || event.key === "L") {
    emit("open-module-selector");
    event.preventDefault();
    return;
  }

  if (event.key >= "1" && event.key <= "4") {
    const pressedIndex = Number(event.key) - 1;

    // Track press time for tap detection
    if (!keyPressTimestamps.has(event.key)) {
      keyPressTimestamps.set(event.key, Date.now());
    }

    if (activeInputIndex !== pressedIndex) {
      activeInputIndex = pressedIndex;
      emit("select-input", activeInputIndex);
    }
    event.preventDefault();
    return;
  }

  if (event.key === "Escape") {
    const hadSelection = activeInputIndex !== null;
    const hadBpm = bpmSelected;
    if (activeInputIndex !== null) {
      activeInputIndex = null;
      emit("clear-input-selection");
    }
    if (bpmSelected) {
      bpmSelected = false;
      emit("clear-bpm-selection");
    }
    if (hadSelection || hadBpm) {
      event.preventDefault();
    }
    return;
  }

  const action = keyMap[event.key];
  if (!action) return;

  const isVertical = event.key === "ArrowUp" || event.key === "ArrowDown";
  const isHorizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
  const magnitude = 1; // All arrows use 1x increment

  if (bpmSelected && isVertical) {
    emit(event.key === "ArrowUp" ? "adjust-bpm-up" : "adjust-bpm-down");
    event.preventDefault();
    return;
  }
  if (activeInputIndex !== null && (isVertical || isHorizontal)) {
    const eventType =
      event.key === "ArrowUp" || event.key === "ArrowRight"
        ? "adjust-input-up"
        : "adjust-input-down";
    emit(eventType, activeInputIndex, magnitude);
    event.preventDefault();
    return;
  }

  event.preventDefault();
  emit(action);
}

function handleKeyUp(event: KeyboardEvent) {
  if (event.key >= "1" && event.key <= "4") {
    const releasedIndex = Number(event.key) - 1;
    const pressTime = keyPressTimestamps.get(event.key);
    const duration = pressTime ? Date.now() - pressTime : 0;

    // Check if it was a quick tap (not a hold)
    if (duration > 0 && duration < TAP_THRESHOLD_MS && activeInputIndex === releasedIndex) {
      // Quick tap - increment the value
      emit("increment-input", releasedIndex);
    }

    // Clean up
    keyPressTimestamps.delete(event.key);

    if (activeInputIndex === releasedIndex) {
      activeInputIndex = null;
      emit("clear-input-selection");
    }
    return;
  }

  if (event.key === "t" || event.key === "T") {
    if (bpmSelected) {
      bpmSelected = false;
      emit("clear-bpm-selection");
    }
  }
}

export function initKeyboardControls() {
  if (isInitialized) return;
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  isInitialized = true;
}

export function destroyKeyboardControls() {
  if (!isInitialized) return;
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  activeInputIndex = null;
  bpmSelected = false;
  keyPressTimestamps.clear();
  isInitialized = false;
}

export function onKeyboardEvent(
  callback: (detail: KeyboardEventDetail) => void
) {
  const listener = (event: Event) => {
    callback((event as CustomEvent<KeyboardEventDetail>).detail);
  };

  window.addEventListener(EVENT_NAME, listener as EventListener);

  return () => {
    window.removeEventListener(EVENT_NAME, listener as EventListener);
  };
}
