<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { SlideData } from '../../core/types/types';
  import { setSlideIndex } from '../../core/stores/session/navigation';
  import Inputs from '../../core/components/ui/Inputs.svelte';
  import { playingStep } from '../../core/stores/session/playback';
  import {
    m185Entries,
    selectedEntry,
    m185Length,
    selectM185Entry,
  } from '../stores/m185';

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

  const maxColumns = 16;

  $: visibleEntries = $m185Entries.slice(0, $m185Length);
  $: gridColumns = Math.max(1, Math.min(maxColumns, visibleEntries.length || 0));

  function handleEntryClick(index: number) {
    selectM185Entry(index);
  }

  function getModeSymbol(mode: string): string {
    switch (mode) {
      case 'repeat': return '↻';
      case 'hold': return '━';
      case 'skip': return '→';
      default: return '?';
    }
  }
</script>

<div class="module" bind:this={moduleElement} on:scroll={handleScroll}>
  {#each slides as slide, index}
    <div class="slide" aria-label={slide.title ?? `Page ${index + 1}`}>
      <div class="grid-wrapper">
        <div class="grid" style={`grid-template-columns: repeat(${gridColumns}, 28px);`}>
          {#each visibleEntries as entry}
            <button
              class="entry"
              class:playing={entry.id === $playingStep}
              on:click={() => handleEntryClick(entry.id)}
              aria-label={`Entry ${entry.id + 1}`}
            >
              <span class="steps">{entry.steps}</span>
              <span class="mode">{getModeSymbol(entry.mode)}</span>
              {#if entry.id === $selectedEntry}
                <span class="cursor" aria-hidden="true"></span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
      <div class="inputs-row">
        <Inputs
          kind="m185"
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
    grid-auto-rows: 44px;
    gap: 2px;
    padding: 0;
  }

  .inputs-row {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .entry {
    width: 28px;
    height: 44px;
    border: none;
    background: var(--color-dark);
    color: var(--color-middle);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.2s ease;
    position: relative;
    font-size: 11px;
    padding: 0;
  }

  .entry.playing {
    background: var(--color-white);
    color: var(--color-black);
    box-shadow: 0 0 6px rgba(245, 245, 245, 0.8);
  }

  .entry.playing .cursor {
    background: var(--color-black);
  }

  .steps {
    font-weight: bold;
    font-size: 13px;
  }

  .mode {
    font-size: 10px;
    opacity: 0.8;
  }

  .cursor {
    width: 10px;
    height: 10px;
    background: var(--color-black);
    border-radius: 50%;
    display: block;
    position: absolute;
    bottom: -15px;
  }
</style>
