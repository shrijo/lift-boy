/**
 * Module Swap Utility
 *
 * Handles swapping modules with state preservation.
 * Attempts to preserve compatible settings when changing modules.
 */

import type { ModuleCategory } from "../types/project";

/**
 * Preserve compatible state fields between old and new module states
 *
 * For rhythm modules: Preserve clockIndex and orderIndex
 * For melody modules: Preserve orderIndex
 * For effects: Preserve mix parameter if both have it
 */
export function preserveCompatibleState(
  oldState: any,
  newState: any,
  category: ModuleCategory
): any {
  if (!oldState || !newState) return newState;

  const preserved = { ...newState };

  try {
    switch (category) {
      case "rhythm":
        // All rhythm modules share clock and order settings
        if (
          oldState.settings &&
          newState.settings &&
          typeof oldState.settings.clockIndex === "number"
        ) {
          preserved.settings = {
            ...preserved.settings,
            clockIndex: oldState.settings.clockIndex,
          };
        }
        if (
          oldState.settings &&
          newState.settings &&
          typeof oldState.settings.orderIndex === "number"
        ) {
          preserved.settings = {
            ...preserved.settings,
            orderIndex: oldState.settings.orderIndex,
          };
        }
        break;

      case "melody":
        // All melody modules share order settings
        if (
          oldState.settings &&
          newState.settings &&
          typeof oldState.settings.orderIndex === "number"
        ) {
          preserved.settings = {
            ...preserved.settings,
            orderIndex: oldState.settings.orderIndex,
          };
        }
        break;

      case "effect":
        // Effects share mix parameter if both have it
        if (typeof oldState.mix === "number" && typeof newState.mix === "number") {
          preserved.mix = oldState.mix;
        }
        break;

      case "instrument":
        // Instrument modules currently don't share settings
        // Could preserve ADSR envelope if both have it
        break;
    }
  } catch (error) {
    console.warn("Error preserving module state:", error);
    return newState;
  }

  return preserved;
}
