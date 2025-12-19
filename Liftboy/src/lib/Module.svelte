<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { SlideData } from './types';
  import { setSlideIndex } from './stores/navigation';
  import { steps, selectedStep, patternLength, selectStep, toggleStepActive } from './stores/sequencer';

  export let slides: SlideData[] = [];
  export let sectionIndex: number;

  let moduleElement: HTMLDivElement | null = null;
  let frameId: number | null = null;

  function updateSlideFromScroll() {
    if (!moduleElement || !slides.length) return;
    const width = moduleElement.clientWidth || 1;
    const rawIndex = Math.round(moduleElement.scrollLeft / width);
    const clamped = Math.min(Math.max(rawIndex, 0), slides.length - 1);
    setSlideIndex(sectionIndex, clamped);
  }

  function handleScroll() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(() => {
      updateSlideFromScroll();
      frameId = null;
    });
  }

  $: if (!slides.length) {
    frameId && cancelAnimationFrame(frameId);
    frameId = null;
  }

  onDestroy(() => {
    if (frameId) {
      cancelAnimationFrame(frameId);
    }
  });

  const columns = 16;

  $: visibleSteps = $steps.slice(0, $patternLength);

  function handleStepClick(index: number, event: MouseEvent) {
    selectStep(index);
    if (event.detail === 2) {
      toggleStepActive(index);
    }
  }
</script>

<div class="module" bind:this={moduleElement} on:scroll={handleScroll}>
  {#each slides as slide, index}
    <div class="slide" aria-label={slide.title ?? `Page ${index + 1}`}>
      <div class="grid-wrapper">
        <div class="grid" style={`grid-template-columns: repeat(${columns}, 18px);`}>
          {#each visibleSteps as step}
            <button
              class="cell"
              class:active={step.active}
              on:click={(event) => handleStepClick(step.id, event)}
              aria-pressed={step.active}
              aria-label={`Step ${step.id + 1}`}
            >
              {#if step.id === $selectedStep}
                <span class="cursor" aria-hidden="true"></span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/each}
</div>

<style>
  .module {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
    overflow-x: scroll;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .module::-webkit-scrollbar {
    display: none;
  }

  .slide {
    width: 100%;
    height: 100%;
    flex-shrink: 0;
    scroll-snap-align: start;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .grid-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .grid {
    display: grid;
    grid-auto-rows: 18px;
    gap: 2px;
    padding: 0;
  }

  .cell {
    width: 18px;
    height: 18px;
    border: none;
    background: var(--color-dark);
    color: var(--color-middle);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.2s ease;
    position: relative;
  }

  .cell.active {
    background: var(--color-middle);
  }

  .cursor {
    width: 10px;
    height: 10px;
    background: var(--color-black);
    border-radius: 50%;
    display: block;
  }
</style>
