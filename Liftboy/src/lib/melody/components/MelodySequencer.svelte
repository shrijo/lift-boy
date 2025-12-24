<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { SlideData } from '../../core/types/types';
  import { setSlideIndex } from '../../core/stores/session/navigation';
  import Inputs from '../../core/components/ui/Inputs.svelte';
  import { playingBar } from '../../core/stores/session/playback';
  import {
    bars,
    selectedBar,
    sequenceLength,
    selectBar,
    randomizeBar,
  } from '../stores/melody';

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

  $: visibleBars = $bars.slice(0, $sequenceLength);
  $: gridColumns = Math.max(1, Math.min(maxColumns, visibleBars.length || 0));

  function handleBarClick(index: number, event: MouseEvent) {
    selectBar(index);
    if (event.detail === 2) {
      randomizeBar(index);
    }
  }

  function barFillHeight(value: number) {
    return `${(value / 7) * 100}%`;
  }
</script>

<div class="module" bind:this={moduleElement} on:scroll={handleScroll}>
  {#each slides as slide, index}
    <div class="slide" aria-label={slide.title ?? `Page ${index + 1}`}>
      <div class="bars-wrapper">
        <div class="bars" role="list" style={`grid-template-columns: repeat(${gridColumns}, 18px);`}>
          {#each visibleBars as bar}
            <button
              class="bar"
              class:glide={bar.glide}
              class:playing={bar.id === $playingBar}
              on:click={(event) => handleBarClick(bar.id, event)}
              aria-label={`Bar ${bar.id + 1}`}
              aria-pressed={bar.randomize}
            >
              <span class="fill" style={`height: ${barFillHeight(bar.value)};`}></span>
              {#if bar.id === $selectedBar}
                <span class="cursor" aria-hidden="true"></span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
      <div class="inputs-row">
        <Inputs
          kind="melody"
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

  .bars-wrapper {
    flex: 1;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bars {
    display: grid;
    grid-auto-rows: 70px;
    column-gap: 2px;
    row-gap: 20px;
    justify-content: center;
    width: 100%;
  }

  .inputs-row {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .bar {
    width: 18px;
    height: 100%;
    max-height: 70px;
    border: none;
    background: var(--color-dark);
    position: relative;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .bar.glide {
    box-shadow: inset 0 0 0 1px var(--color-middle);
  }

  .bar.playing {
    background: var(--color-white);
    box-shadow: 0 0 6px rgba(245, 245, 245, 0.8);
  }

  .bar.playing .fill {
    background: var(--color-black);
  }

  .fill {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--color-middle);
    transition: height 0.2s ease;
  }

  .cursor {
    width: 10px;
    height: 10px;
    background: var(--color-dark);
    border-radius: 50%;
    position: absolute;
    bottom: -15px; /* 10px dot + 5px gap */
  }
</style>
