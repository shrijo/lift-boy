<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { SlideData } from '../../core/types/types';
  import { setSlideIndex } from '../../core/stores/session/navigation';
  import Inputs from '../../core/components/ui/Inputs.svelte';
  import {
    reverbRoomSize,
    reverbDecay,
    reverbMix,
    reverbPreDelay,
  } from '../stores/reverb';

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

  // Create visual representation of reverb
  $: roomPercent = $reverbRoomSize * 100;
  $: decayPercent = ($reverbDecay / 10) * 100;
  $: mixPercent = $reverbMix * 100;
  $: preDelayPercent = ($reverbPreDelay / 0.1) * 100;
</script>

<div class="module" bind:this={moduleElement} on:scroll={handleScroll}>
  {#each slides as slide, index}
    <div class="slide" aria-label={slide.title ?? `Page ${index + 1}`}>
      <div class="visual-wrapper">
        <div class="visual">
          <div class="param-display">
            <div class="label">ROOM SIZE</div>
            <div class="bar">
              <div class="fill" style={`width: ${roomPercent}%;`}></div>
            </div>
          </div>
          <div class="param-display">
            <div class="label">DECAY</div>
            <div class="bar">
              <div class="fill" style={`width: ${decayPercent}%;`}></div>
            </div>
          </div>
          <div class="param-display">
            <div class="label">MIX</div>
            <div class="bar">
              <div class="fill wet" style={`width: ${mixPercent}%;`}></div>
            </div>
          </div>
          <div class="param-display">
            <div class="label">PRE-DELAY</div>
            <div class="bar">
              <div class="fill" style={`width: ${preDelayPercent}%;`}></div>
            </div>
          </div>
        </div>
      </div>
      <div class="inputs-row">
        <Inputs
          kind="reverb"
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

  .visual-wrapper {
    flex: 1;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .visual {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 280px;
  }

  .inputs-row {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .param-display {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .label {
    font-size: 10px;
    color: var(--color-middle);
    letter-spacing: 1px;
  }

  .bar {
    width: 100%;
    height: 12px;
    background: var(--color-dark);
    position: relative;
    overflow: hidden;
  }

  .fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: var(--color-middle);
    transition: width 0.2s ease;
  }

  .fill.wet {
    background: var(--color-white);
  }
</style>
