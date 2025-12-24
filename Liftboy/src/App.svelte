<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Header from './lib/core/components/ui/Header.svelte';
  import LaneSelector from './lib/core/components/lanes/LaneSelector.svelte';
  import XoxSequencer from './lib/rhythm/components/XoxSequencer.svelte';
  import MelodySequencer from './lib/melody/components/MelodySequencer.svelte';
  import SimpleSynth from './lib/instrument/components/SimpleSynth.svelte';
  import { initKeyboardControls, destroyKeyboardControls, onKeyboardEvent, type KeyboardEventDetail } from './lib/core/utils/keyboard';
  import { initLaneModuleSync } from './lib/core/stores/sync/laneModuleSync';
  import {
    activateLaneSelector,
    deactivateLaneSelector
  } from './lib/core/stores/session/lanes';
  import {
    currentSection,
    setCurrentSection,
    initializeNavigation,
    slideIndices,
    setSlideIndex
  } from './lib/core/stores/session/navigation';
  import type { SectionData } from './lib/core/types/types';
  import { get } from 'svelte/store';
  import { scrollToElement, scrollToIndex, createScrollDebouncer } from './lib/core/utils/scrolling';
  import { INTERSECTION_THRESHOLD, SCROLL_DEBOUNCE_DELAY } from './lib/core/utils/constants';

  let laneStageElement: HTMLDivElement | null = null;
  let navigationReady = false;
  let unsubscribe: (() => void) | null = null;
  let viewportObserver: IntersectionObserver | null = null;
  let laneSelectorVisible = false;
  const slideScrollDebouncer = createScrollDebouncer(SCROLL_DEBOUNCE_DELAY);

  $: if (!navigationReady && sections.length > 0) {
    initializeNavigation(sections.length);
    navigationReady = true;
  }

  function attachViewportObserver() {
    if (!laneStageElement) return;

    viewportObserver?.disconnect();

    viewportObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= INTERSECTION_THRESHOLD) {
            const target = entry.target as HTMLElement;

            // Check if it's the LaneSelector
            if (target.classList.contains('lane-selector')) {
              activateLaneSelector();
              laneSelectorVisible = true;
            }
            // Check if it's a module section
            else if (target.tagName === 'SECTION' && target.dataset.index !== undefined) {
              const index = Number(target.dataset.index);
              if (!Number.isNaN(index)) {
                deactivateLaneSelector();
                laneSelectorVisible = false;
                setCurrentSection(index);
              }
            }
          }
        }
      },
      {
        root: laneStageElement,
        threshold: [INTERSECTION_THRESHOLD],
      }
    );

    // Observe LaneSelector
    const laneSelectorEl = laneStageElement.querySelector('.lane-selector');
    if (laneSelectorEl) {
      viewportObserver.observe(laneSelectorEl);
    }

    // Observe all module sections
    const sectionNodes = laneStageElement.querySelectorAll('section[data-index]');
    sectionNodes.forEach((node) => viewportObserver?.observe(node));
  }

  function scrollToSection(index: number) {
    if (!laneStageElement) return;
    scrollToIndex(laneStageElement, 'section[data-index]', index);
  }

  function scrollToLaneSelector() {
    if (!laneStageElement) return;
    scrollToElement(laneStageElement, '.lane-selector');
  }

  function scrollModule(direction: 'next' | 'prev') {
    if (!laneStageElement) return;

    // LaneSelector handles its own slide navigation internally
    if (laneSelectorVisible) return;

    slideScrollDebouncer.execute(() => {
      const currentSectionIndex = $currentSection ?? 0;
      const sectionNodes = laneStageElement!.querySelectorAll('section[data-index]');
      const sectionNode = sectionNodes[currentSectionIndex];
      if (!sectionNode) return;

      const module = sectionNode.querySelector('.module');
      if (!module) return;

      const slides = module.querySelectorAll('.slide');
      if (!slides.length) return;

      const totalSlides = slides.length;
      const indices = get(slideIndices);
      const currentSlide = indices[currentSectionIndex] ?? 0;
      const targetIndex =
        direction === 'next'
          ? Math.min(currentSlide + 1, totalSlides - 1)
          : Math.max(currentSlide - 1, 0);

      if (targetIndex === currentSlide) return;

      slides[targetIndex].scrollIntoView({ behavior: 'smooth', inline: 'start' });
      setSlideIndex(currentSectionIndex, targetIndex);
    });
  }

  function handleKeyboardEvent(detail: KeyboardEventDetail) {
    switch (detail.type) {
      case 'scroll-next-section':
        if (laneSelectorVisible) {
          // Scroll from LaneSelector to first module
          scrollToSection(0);
        } else {
          // Scroll to next module
          scrollToSection(Math.min(($currentSection ?? 0) + 1, sections.length - 1));
        }
        break;
      case 'scroll-prev-section':
        if (!laneSelectorVisible && $currentSection === 0) {
          // Scroll from first module to LaneSelector
          scrollToLaneSelector();
        } else if (!laneSelectorVisible) {
          // Scroll to previous module
          scrollToSection(Math.max(($currentSection ?? 0) - 1, 0));
        }
        break;
      case 'scroll-next-slide':
        scrollModule('next');
        break;
      case 'scroll-prev-slide':
        scrollModule('prev');
        break;
    }
  }

  const sections: SectionData[] = [
    {
      name: 'Step Sequencer',
      kind: 'xox',
      slides: [
        {
          title: 'Steps',
          description: 'Per-step controls',
          inputs: [
            { key: 'Step', value: 1, unit: '', min: 1, max: 64, step: 1 },
            { key: 'Value', value: 1, options: ['Off', 'On'] },
            { key: 'Duration', value: 1, unit: ' steps', min: 0.25, max: 4, step: 0.25 },
            { key: 'Probability', value: 100, unit: '%', min: 0, max: 100, step: 5 },
          ],
        },
        {
          title: 'Pattern',
          description: 'Global playback settings',
          inputs: [
            { key: 'Length', value: 64, unit: ' steps', min: 1, max: 64, step: 1 },
            { key: 'Clock', value: '1/16', options: ['1/4', '1/8', '1/16', '1/32'] },
            { key: 'Order', value: 'forward', options: ['forward', 'backwards', 'random'] },
            { key: '', value: '' },
          ],
        },
      ],
    },
    {
      name: 'Melody Sequencer',
      kind: 'melody',
      slides: [
        {
          title: 'Bars',
          description: 'Per-bar controls',
          inputs: [
            { key: 'Step', value: 1, unit: '', min: 1, max: 32, step: 1 },
            { key: 'Note', value: 0, min: 0, max: 7, step: 1 },
            { key: 'Glide', value: 0, options: ['Off', 'On'] },
            { key: 'Randomize', value: 0, options: ['Off', 'On'] },
          ],
        },
        {
          title: 'Playback',
          description: 'Sequence behavior',
          inputs: [
            { key: 'Length', value: 8, unit: ' bars', min: 1, max: 32, step: 1 },
            { key: 'Skip', value: 'none', options: ['none', 'second', 'third', 'fourth'] },
            { key: 'Order', value: 'forward', options: ['forward', 'backwards', 'random'] },
            { key: '', value: '' },
          ],
        },
      ],
    },
    {
      name: 'Simple Synth',
      kind: 'synth',
      slides: [
        {
          title: 'Oscillator',
          description: 'Tone.Synth voice',
          inputs: [
            { key: 'Wave', value: 'amtriangle', options: ['sine', 'square', 'triangle', 'sawtooth', 'amtriangle'] },
            { key: 'Harmonicity', value: 0.5, min: 0, max: 2, step: 0.1 },
            { key: 'Mod', value: 'sine', options: ['sine', 'triangle', 'square', 'sawtooth'] },
            { key: 'Portamento', value: 0.05, unit: ' s', min: 0, max: 1, step: 0.01 },
          ],
        },
        {
          title: 'Envelope',
          description: 'Amplitude contour',
          inputs: [
            { key: 'Attack', value: 0.05, unit: ' s', min: 0, max: 1, step: 0.01 },
            { key: 'Decay', value: 0.2, unit: ' s', min: 0, max: 1, step: 0.01 },
            { key: 'Sustain', value: 0.2, unit: '', min: 0, max: 1, step: 0.05 },
            { key: 'Release', value: 1.5, unit: ' s', min: 0, max: 3, step: 0.1 },
          ],
        },
      ],
    },
  ];

  onMount(() => {
    initKeyboardControls();
    initLaneModuleSync();
    unsubscribe = onKeyboardEvent(handleKeyboardEvent);

    // Attach IntersectionObserver to track visible scroll area
    attachViewportObserver();

    // Initially scroll to first module section
    if (laneStageElement) {
      const firstSection = laneStageElement.querySelector('section[data-index="0"]');
      if (firstSection) {
        firstSection.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    }
  });

  onDestroy(() => {
    destroyKeyboardControls();
    unsubscribe?.();
    viewportObserver?.disconnect();
    slideScrollDebouncer.cleanup();
  });
</script>

<main>
  <Header />
  <div class="lane-stage" bind:this={laneStageElement}>
    <LaneSelector />
    {#each sections as section, index}
      <section data-index={index}>
        {#if section.kind === 'xox'}
          <svelte:component
            this={XoxSequencer}
            slides={section.slides}
            sectionIndex={index}
            globalInputsVisible={true}
          />
        {:else if section.kind === 'melody'}
          <svelte:component
            this={MelodySequencer}
            slides={section.slides}
            sectionIndex={index}
            globalInputsVisible={true}
          />
        {:else if section.kind === 'synth'}
          <svelte:component
            this={SimpleSynth}
            slides={section.slides}
            sectionIndex={index}
            globalInputsVisible={true}
          />
        {/if}
      </section>
    {/each}
  </div>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    width: 480px;
    height: 320px;
    max-width: 480px;
    max-height: 320px;
    background: var(--color-black);
    border: 1px solid var(--color-dark);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
    overflow: hidden;
  }

  .lane-stage {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: scroll;
    scroll-snap-type: y mandatory;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .lane-stage::-webkit-scrollbar {
    display: none;
  }

  section {
    height: 100%;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    width: 100%;
    scroll-snap-align: start;
  }
</style>
