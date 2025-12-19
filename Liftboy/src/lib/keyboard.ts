/**
 * Keyboard control dispatcher for scroll actions.
 */

export type KeyboardEventType =
  | "scroll-next-section"
  | "scroll-prev-section"
  | "scroll-next-slide"
  | "scroll-prev-slide"
  | "select-input"
  | "clear-input-selection"
  | "adjust-input-up"
  | "adjust-input-down";

export interface KeyboardEventDetail {
  type: KeyboardEventType;
  inputIndex?: number;
}

const EVENT_NAME = "keyboard-control";
const keyMap: Record<string, KeyboardEventType> = {
  ArrowUp: "scroll-prev-section",
  ArrowDown: "scroll-next-section",
  ArrowLeft: "scroll-prev-slide",
  ArrowRight: "scroll-next-slide",
};

let isInitialized = false;
let activeInputIndex: number | null = null;

function emit(type: KeyboardEventType, inputIndex?: number) {
  window.dispatchEvent(
    new CustomEvent<KeyboardEventDetail>(EVENT_NAME, {
      detail: { type, inputIndex },
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

  if (event.key >= "1" && event.key <= "4") {
    activeInputIndex = Number(event.key) - 1;
    emit("select-input", activeInputIndex);
    event.preventDefault();
    return;
  }

  if (event.key === "Escape") {
    if (activeInputIndex !== null) {
      activeInputIndex = null;
      emit("clear-input-selection");
      event.preventDefault();
    }
    return;
  }

  const action = keyMap[event.key];
  if (!action) return;

  const isVertical = event.key === "ArrowUp" || event.key === "ArrowDown";
  if (activeInputIndex !== null && isVertical) {
    emit(
      event.key === "ArrowUp" ? "adjust-input-up" : "adjust-input-down",
      activeInputIndex
    );
    event.preventDefault();
    return;
  }

  event.preventDefault();
  emit(action);
}

function handleKeyUp(event: KeyboardEvent) {
  if (event.key >= "1" && event.key <= "4") {
    if (activeInputIndex !== null) {
      activeInputIndex = null;
      emit("clear-input-selection");
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
