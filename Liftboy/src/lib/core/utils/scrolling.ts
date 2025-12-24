/**
 * Scrolling Utilities
 *
 * Reusable scroll helpers to eliminate duplication across components.
 * Provides element scrolling and debouncing for smooth navigation.
 */

export interface ScrollOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  inline?: ScrollLogicalPosition;
}

/**
 * Scroll to a specific element within a container
 *
 * @param container - Parent element containing the target
 * @param selector - CSS selector for target element
 * @param options - ScrollIntoView options
 * @returns true if element was found and scrolled to
 */
export function scrollToElement(
  container: HTMLElement,
  selector: string,
  options: ScrollOptions = {}
): boolean {
  const element = container.querySelector(selector);
  if (!element) return false;

  element.scrollIntoView({
    behavior: options.behavior ?? "smooth",
    block: options.block ?? "start",
    inline: options.inline ?? "start",
  });

  return true;
}

/**
 * Scroll to an element by index within a NodeList
 *
 * @param container - Parent element containing the targets
 * @param selector - CSS selector for target elements
 * @param index - Zero-based index of element to scroll to
 * @param options - ScrollIntoView options
 * @returns true if element was found and scrolled to
 */
export function scrollToIndex(
  container: HTMLElement,
  selector: string,
  index: number,
  options: ScrollOptions = {}
): boolean {
  const elements = container.querySelectorAll(selector);
  const target = elements[index];
  if (!target) return false;

  target.scrollIntoView({
    behavior: options.behavior ?? "smooth",
    block: options.block ?? "start",
    inline: options.inline ?? "start",
  });

  return true;
}

/**
 * Create a scroll debouncer to prevent scroll spam
 *
 * Usage:
 * ```ts
 * const debouncer = createScrollDebouncer(400);
 *
 * function handleScroll() {
 *   debouncer.execute(() => {
 *     // Scroll logic here
 *   });
 * }
 *
 * onDestroy(() => debouncer.cleanup());
 * ```
 *
 * @param delay - Debounce delay in milliseconds
 * @returns Debouncer interface with execute and cleanup methods
 */
export function createScrollDebouncer(delay: number = 400) {
  let scrolling = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return {
    /**
     * Check if currently scrolling
     */
    isScrolling: () => scrolling,

    /**
     * Execute callback if not currently scrolling
     *
     * @param callback - Function to execute
     * @returns true if callback was executed, false if blocked by debounce
     */
    execute: (callback: () => void): boolean => {
      if (scrolling) return false;

      scrolling = true;
      callback();

      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        scrolling = false;
        timeout = null;
      }, delay);

      return true;
    },

    /**
     * Clean up timers (call in onDestroy)
     */
    cleanup: () => {
      if (timeout) clearTimeout(timeout);
      scrolling = false;
      timeout = null;
    },
  };
}
