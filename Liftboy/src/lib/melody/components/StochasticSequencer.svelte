<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { SlideData } from '../../core/types/types';
  import { setSlideIndex } from '../../core/stores/session/navigation';
  import Inputs from '../../core/components/ui/Inputs.svelte';
  import {
    stochasticMinNote,
    stochasticMaxNote,
    stochasticCurrentNote,
  } from '../stores/stochastic';

  export let slides: SlideData[] = [];
  export let sectionIndex: number;
  export let globalInputsVisible = true;

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

  // Create a visual range display (0-7 notes)
  const noteRange = [0, 1, 2, 3, 4, 5, 6, 7];

  function isInRange(note: number): boolean {
    return note >= $stochasticMinNote && note <= $stochasticMaxNote;
  }

  function isCurrent(note: number): boolean {
    return note === $stochasticCurrentNote;
  }

  function barHeight(note: number): string {
    return `${((note + 1) / 8) * 100}%`;
  }
</script>

<div class="module" bind:this={moduleElement} on:scroll={handleScroll}>
  {#each slides as slide, index}
    <div class="slide" aria-label={slide.title ?? `Page ${index + 1}`}>
      <div class="range-wrapper">
        <div class="range">
          {#each noteRange as note}
            <div
              class="note"
              class:in-range={isInRange(note)}
              class:current={isCurrent(note)}
              aria-label={`Note ${note}`}
            >
              <span class="fill" style={`height: ${barHeight(note)};`}></span>
              <span class="label">{note}</span>
            </div>
          {/each}
        </div>
      </div>
      <div class="inputs-row">
        <Inputs
          kind="stochastic"
          {sectionIndex}
          slideIndex={index}
          inputs={slide.inputs}
          visible={globalInputsVisible}
        />
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
    padding-bottom: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .range-wrapper {
    flex: 1;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .range {
    display: flex;
    flex-direction: row;
    gap: 4px;
    align-items: flex-end;
    height: 120px;
  }

  .inputs-row {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .note {
    width: 24px;
    height: 100%;
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: var(--color-dark);
  }

  .note.in-range {
    background: var(--color-dark);
  }

  .note.current {
    box-shadow: 0 0 8px rgba(245, 245, 245, 0.6);
  }

  .fill {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: transparent;
    transition: background 0.2s ease, height 0.2s ease;
  }

  .note.in-range .fill {
    background: var(--color-middle);
  }

  .note.current .fill {
    background: var(--color-white);
  }

  .label {
    position: absolute;
    bottom: -20px;
    font-size: 10px;
    color: var(--color-middle);
  }

  .note.current .label {
    color: var(--color-white);
    font-weight: bold;
  }
</style>
