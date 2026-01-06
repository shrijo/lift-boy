<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { listModulesByCategory } from '../../../modules/registry';
  import { currentLane } from '../../stores/session/lanes';
  import {
    isModuleSelectorOpen,
    selectorCategory,
    selectorSelectedIndex,
    closeModuleSelector,
    moveSelectorUp,
    moveSelectorDown,
  } from '../../stores/session/moduleSelection';
  import { onKeyboardEvent } from '../../utils/keyboard';
  import type { ModuleDefinition } from '../../types/project';

  export let onConfirm: (definitionId: string) => void;

  let unsubscribe: (() => void) | null = null;
  let modules: ModuleDefinition[] = [];

  $: if ($isModuleSelectorOpen && $selectorCategory) {
    modules = listModulesByCategory($selectorCategory);
  } else {
    modules = [];
  }

  $: currentModuleId = $currentLane?.modules[$selectorCategory!]?.definitionId;

  function handleKeyboard(detail: any) {
    if (!$isModuleSelectorOpen) return;

    switch (detail.type) {
      case 'scroll-prev-section':
      case 'adjust-input-up':
        moveSelectorUp();
        break;
      case 'scroll-next-section':
      case 'adjust-input-down':
        moveSelectorDown(modules.length - 1);
        break;
      case 'select-input':
        if (detail.inputIndex === 0) {
          // "1" key - confirm
          const selected = modules[$selectorSelectedIndex];
          if (selected) {
            onConfirm(selected.id);
          }
        } else if (detail.inputIndex === 1) {
          // "2" key - cancel
          closeModuleSelector();
        }
        break;
      case 'clear-input-selection':
        // Escape - cancel
        closeModuleSelector();
        break;
    }
  }

  onMount(() => {
    unsubscribe = onKeyboardEvent(handleKeyboard);
  });

  onDestroy(() => {
    unsubscribe?.();
  });

  function getCategoryLabel(category: string): string {
    switch (category) {
      case 'rhythm': return 'RHYTHM';
      case 'melody': return 'MELODY';
      case 'instrument': return 'INSTRUMENT';
      case 'effect': return 'EFFECT';
      default: return category.toUpperCase();
    }
  }
</script>

{#if $isModuleSelectorOpen && $selectorCategory}
  <div class="overlay">
    <div class="selector">
      <div class="header">
        SELECT {getCategoryLabel($selectorCategory)} MODULE
      </div>
      <div class="list">
        {#each modules as module, index}
          <button
            class="item"
            class:selected={index === $selectorSelectedIndex}
            class:current={module.id === currentModuleId}
            on:click={() => onConfirm(module.id)}
          >
            <span class="indicator">
              {#if index === $selectorSelectedIndex}▸{:else}&nbsp;{/if}
            </span>
            <span class="label">{module.label}</span>
            {#if module.id === currentModuleId}
              <span class="badge">CURRENT</span>
            {/if}
          </button>
        {/each}
      </div>
      <div class="footer">
        <span class="hint">1: Confirm</span>
        <span class="hint">2: Cancel</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .selector {
    background: var(--color-black);
    border: 1px solid var(--color-middle);
    min-width: 320px;
    max-width: 400px;
    max-height: 280px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
  }

  .header {
    padding: 12px 16px;
    background: var(--color-dark);
    color: var(--color-white);
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 1px;
    border-bottom: 1px solid var(--color-middle);
  }

  .list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .item {
    width: 100%;
    padding: 10px 16px;
    background: transparent;
    border: none;
    color: var(--color-middle);
    font: inherit;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .item:hover {
    background: var(--color-dark);
  }

  .item.selected {
    background: var(--color-middle);
    color: var(--color-black);
  }

  .item.selected .indicator {
    color: var(--color-black);
  }

  .indicator {
    width: 12px;
    flex-shrink: 0;
    color: var(--color-middle);
  }

  .label {
    flex: 1;
  }

  .badge {
    font-size: 9px;
    padding: 2px 6px;
    background: var(--color-dark);
    color: var(--color-middle);
    border-radius: 2px;
    letter-spacing: 0.5px;
  }

  .item.selected .badge {
    background: var(--color-black);
    color: var(--color-white);
  }

  .footer {
    padding: 12px 16px;
    background: var(--color-dark);
    border-top: 1px solid var(--color-middle);
    display: flex;
    gap: 16px;
    font-size: 10px;
    color: var(--color-middle);
  }

  .hint {
    letter-spacing: 0.5px;
  }
</style>
