<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { SlideData } from '../../core/types/types';
  import { setSlideIndex } from '../../core/stores/session/navigation';
  import { playingStep } from '../../core/stores/session/playback';
  import Inputs from '../../core/components/ui/Inputs.svelte';
  import {
    euclideanSteps,
    euclideanPulses,
    euclideanRotation,
  } from '../stores/euclidean';

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

  // Generate Euclidean pattern using Bjorklund algorithm
  function generateEuclideanPattern(steps: number, pulses: number): boolean[] {
    if (pulses >= steps) return Array(steps).fill(true);
    if (pulses === 0) return Array(steps).fill(false);

    const pattern: boolean[] = Array(steps).fill(false);
    const bucket = steps - pulses;

    for (let i = 0; i < steps; i++) {
      pattern[i] = ((i * bucket) % steps) < pulses;
    }

    return pattern;
  }

  function rotatePattern(pattern: boolean[], rotation: number): boolean[] {
    if (rotation === 0) return pattern;
    const len = pattern.length;
    const normalized = ((rotation % len) + len) % len;
    return [...pattern.slice(normalized), ...pattern.slice(0, normalized)];
  }

  $: rawPattern = generateEuclideanPattern($euclideanSteps, $euclideanPulses);
  $: pattern = rotatePattern(rawPattern, $euclideanRotation);
  $: gridColumns = Math.min(16, $euclideanSteps);
</script>

<div class="module" bind:this={moduleElement} on:scroll={handleScroll}>
  {#each slides as slide, index}
    <div class="slide" aria-label={slide.title ?? `Page ${index + 1}`}>
      <div class="grid-wrapper">
        <div class="grid" style={`grid-template-columns: repeat(${gridColumns}, 18px);`}>
          {#each pattern as active, idx}
            <div
              class="cell"
              class:active={active}
              class:playing={idx === $playingStep}
              aria-label={`Step ${idx + 1}`}
            ></div>
          {/each}
        </div>
      </div>
      <div class="inputs-row">
        <Inputs
          kind="euclidean"
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

  .grid-wrapper {
    flex: 1;
    width: 100%;
    height: 100%;
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

  .inputs-row {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .cell {
    width: 18px;
    height: 18px;
    background: var(--color-dark);
    transition: background 0.2s ease;
  }

  .cell.active {
    background: var(--color-middle);
  }

  .cell.playing {
    background: var(--color-white);
    box-shadow: 0 0 6px rgba(245, 245, 245, 0.8);
  }
</style>
