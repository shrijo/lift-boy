<script lang="ts">
  import { onDestroy, onMount, afterUpdate } from 'svelte';
  import type { SlideData } from '../../core/types/types';
  import { setSlideIndex } from '../../core/stores/session/navigation';
  import { clapSettings } from '../stores/clap';
  import Inputs from '../../core/components/ui/Inputs.svelte';

  export let slides: SlideData[] = [];
  export let sectionIndex: number;
  export let globalInputsVisible = true;

  let moduleElement: HTMLDivElement | null = null;
  let frameId: number | null = null;
  let slideObserver: IntersectionObserver | null = null;

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

  function attachSlideObserver() {
    if (!moduleElement || !slideObserver) return;
    slideObserver.disconnect();
    const slideNodes = moduleElement.querySelectorAll('.slide');
    slideNodes.forEach((node) => slideObserver?.observe(node));
  }

  onMount(() => {
    slideObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) {
              setSlideIndex(sectionIndex, idx);
            }
          }
        });
      },
      { root: moduleElement, threshold: [0.6] }
    );
    attachSlideObserver();
  });

  afterUpdate(() => {
    attachSlideObserver();
  });

  onDestroy(() => {
    if (frameId) {
      cancelAnimationFrame(frameId);
    }
    slideObserver?.disconnect();
  });

  $: settings = $clapSettings;
</script>

<div class="module" bind:this={moduleElement} on:scroll={handleScroll}>
  {#each slides as slide, index}
    <div class="slide" aria-label={slide.title ?? `Page ${index + 1}`} data-index={index}>
      <div class="drum-label">
        <h2>Clap</h2>
        <div class="params-display">
          <div class="param">Tone: {settings.tone.toFixed(2)}</div>
          <div class="param">Decay: {settings.decay.toFixed(2)}s</div>
          <div class="param">Spread: {settings.spread.toFixed(2)}</div>
        </div>
      </div>
      <div class="inputs-row">
        <Inputs
          kind="clap"
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    position: relative;
  }

  .drum-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }

  .drum-label h2 {
    font-size: 32px;
    font-weight: 600;
    margin: 0;
    color: var(--color-white);
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .params-display {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-family: monospace;
    font-size: 14px;
    color: var(--color-white);
    opacity: 0.7;
  }

  .param {
    text-align: center;
  }

  .inputs-row {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
  }
</style>
