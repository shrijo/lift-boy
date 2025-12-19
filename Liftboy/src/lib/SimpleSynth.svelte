<script lang="ts">
  import { onDestroy, onMount, afterUpdate } from 'svelte';
  import type { SlideData } from './types';
  import { setSlideIndex } from './stores/navigation';
  import { synthSettings, type SynthState, type WaveType, type ModulationType } from './stores/synth';
  import Inputs from './Inputs.svelte';

  const WIDTH = 520;
  const HEIGHT = 320;
  const sustainHold = 0.4;

  export let slides: SlideData[] = [];
  export let sectionIndex: number;
  export let globalInputsVisible = true;

  let moduleElement: HTMLDivElement | null = null;
  let frameId: number | null = null;
  let slideObserver: IntersectionObserver | null = null;
  let localInputsVisible = true;
  let visibilityTimeout: ReturnType<typeof setTimeout> | null = null;

  function updateSlideFromScroll() {
    if (!moduleElement || !slides.length) return;
    const width = moduleElement.clientWidth || 1;
    const rawIndex = Math.round(moduleElement.scrollLeft / width);
    const clamped = Math.min(Math.max(rawIndex, 0), slides.length - 1);
    setSlideIndex(sectionIndex, clamped);
  }

  function handleScroll() {
    hideInputsDuringScroll();
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

  function hideInputsDuringScroll() {
    if (localInputsVisible) {
      localInputsVisible = false;
    }

    visibilityTimeout && clearTimeout(visibilityTimeout);
    visibilityTimeout = setTimeout(() => {
      localInputsVisible = true;
      visibilityTimeout = null;
    }, 220);
  }

  onDestroy(() => {
    if (frameId) {
      cancelAnimationFrame(frameId);
    }
    slideObserver?.disconnect();
    if (visibilityTimeout) {
      clearTimeout(visibilityTimeout);
    }
  });

  $: settings = $synthSettings;
  $: wavePath = buildWavePath(settings);
  $: envelopeShape = buildEnvelopeShape(settings);

  function buildWavePath(state: SynthState) {
    const points = 120;
    const amplitude = HEIGHT * 0.35;
    const freq = 1 + state.harmonicity * 0.6;
    const modDepth = 0.25;
    let d = '';

    for (let i = 0; i <= points; i++) {
      const progress = i / points;
      const basePhase = progress * freq;
      const sample = getWaveSample(state.wave, basePhase);
      const mod = getWaveSample(state.modulation, basePhase * 0.6);
      const value = sample * (1 - modDepth) + mod * modDepth;
      const x = progress * WIDTH;
      const y = HEIGHT / 2 - value * amplitude;
      d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
    }

    return d.trim();
  }

  function frac(value: number) {
    return value - Math.floor(value);
  }

  function getWaveSample(type: WaveType | ModulationType, phase: number) {
    const t = frac(phase);
    const angle = t * Math.PI * 2;
    switch (type) {
      case 'sine':
        return Math.sin(angle);
      case 'square':
        return Math.sign(Math.sin(angle)) || 1;
      case 'triangle':
        return 1 - 4 * Math.abs(Math.round(t - 0.25) - (t - 0.25));
      case 'sawtooth':
        return 2 * (t - 0.5);
      case 'amtriangle':
        return (1 - 4 * Math.abs(Math.round(t - 0.25) - (t - 0.25))) * Math.sin(angle * 0.5);
      default:
        return Math.sin(angle);
    }
  }

  function buildEnvelopeShape(state: SynthState) {
    const attack = Math.max(state.attack, 0.01);
    const decay = Math.max(state.decay, 0.01);
    const release = Math.max(state.release, 0.01);
    const segments = [attack, decay, sustainHold, release];
    const total = segments.reduce((acc, seg) => acc + seg, 0);
    const widths = segments.map((seg) => (seg / total) * WIDTH);
    const baseY = HEIGHT - 20;
    const topY = 20;
    const sustainY = baseY - state.sustain * (baseY - topY);

    const points = [
      { x: 0, y: baseY },
      { x: widths[0], y: topY },
      { x: widths[0] + widths[1], y: sustainY },
      { x: widths[0] + widths[1] + widths[2], y: sustainY },
      { x: WIDTH, y: baseY },
    ];

    const path = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');

    return { path };
  }
</script>

<div class="module" bind:this={moduleElement} on:scroll={handleScroll}>
  {#each slides as slide, index}
    <div class="slide" aria-label={slide.title ?? `Page ${index + 1}`} data-index={index}>
      {#if index === 0}
        <div class="visual visual--wave">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="presentation">
            <path d={wavePath} class="wave-path" />
          </svg>
        </div>
      {:else}
        <div class="visual visual--env">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="presentation">
            <path d={envelopeShape.path} class="envelope-line" />
          </svg>
        </div>
      {/if}
      <div class="inputs-row">
        <Inputs
          kind="synth"
          {sectionIndex}
          slideIndex={index}
          inputs={slide.inputs}
          visible={localInputsVisible && globalInputsVisible}
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

  .visual {
    width: 100%;
    max-width: 100%;
    height: 100%;
    max-height: 220px;
    background: transparent;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
  }

  svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .wave-path,
  .envelope-line {
    stroke: var(--color-white);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
    vector-effect: non-scaling-stroke;
    filter: drop-shadow(0 0 6px rgba(245, 245, 245, 0.25));
  }

  .inputs-row {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
  }
</style>
