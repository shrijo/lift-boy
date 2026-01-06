<script lang="ts">
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { get } from 'svelte/store';
  import XoxSequencer from '../../../rhythm/components/XoxSequencer.svelte';
  import EuclideanSequencer from '../../../rhythm/components/EuclideanSequencer.svelte';
  import M185Sequencer from '../../../rhythm/components/M185Sequencer.svelte';
  import MelodySequencer from '../../../melody/components/MelodySequencer.svelte';
  import StochasticSequencer from '../../../melody/components/StochasticSequencer.svelte';
  import SimpleSynth from '../../../instrument/components/SimpleSynth.svelte';
  import KickDrum from '../../../instrument/components/KickDrum.svelte';
  import HihatDrum from '../../../instrument/components/HihatDrum.svelte';
  import SnareDrum from '../../../instrument/components/SnareDrum.svelte';
  import CongaDrum from '../../../instrument/components/CongaDrum.svelte';
  import ClapDrum from '../../../instrument/components/ClapDrum.svelte';
  import DelayEffect from '../../../effect/components/DelayEffect.svelte';
  import ReverbEffect from '../../../effect/components/ReverbEffect.svelte';
  import NoneEffect from '../../../effect/components/NoneEffect.svelte';
  import { onKeyboardEvent, type KeyboardEventDetail } from '../../utils/keyboard';
  import type { SectionData } from '../../types/types';
  import { scrollToIndex, createScrollDebouncer } from '../../utils/scrolling';
  import { INTERSECTION_THRESHOLD, SECTION_SCROLL_DELAY, SCROLL_DEBOUNCE_DELAY, LANE_INPUT_HIDE_DELAY } from '../../utils/constants';
  import {
    initializeNavigation,
    setCurrentSection,
    setSlideIndex,
    currentSection,
    slideIndices,
  } from '../../stores/session/navigation';
  import {
    laneSelectorActive,
    activateLaneSelector,
    deactivateLaneSelector,
  } from '../../stores/session/lanes';

  type SlideDirection = 'next' | 'prev';

  export let sections: SectionData[] = [];
  const componentByKind = {
    xox: XoxSequencer,
    euclidean: EuclideanSequencer,
    m185: M185Sequencer,
    melody: MelodySequencer,
    stochastic: StochasticSequencer,
    synth: SimpleSynth,
    kick: KickDrum,
    hihat: HihatDrum,
    snare: SnareDrum,
    conga: CongaDrum,
    clap: ClapDrum,
    delay: DelayEffect,
    reverb: ReverbEffect,
    none: NoneEffect,
  } as const;

  let laneElement: HTMLDivElement | null = null;
  let currentSectionIndex = 0;
  let unsubscribe: (() => void) | null = null;
  let navigationReady = false;
  let sectionObserver: IntersectionObserver | null = null;
  let inputsVisible = true;
  let laneVisibilityTimeout: ReturnType<typeof setTimeout> | null = null;
  let laneSelectorVisible = false;
  let laneSelectorUnsubscribe: (() => void) | null = null;
  let justDeactivatedLaneSelector = false;
  const sectionScrollDebouncer = createScrollDebouncer(SECTION_SCROLL_DELAY);
  const slideScrollDebouncer = createScrollDebouncer(SCROLL_DEBOUNCE_DELAY);

  $: totalSections = sections.length;
  $: syncedSection = $currentSection ?? 0;
  $: if (syncedSection !== currentSectionIndex) {
    currentSectionIndex = syncedSection;
  }

  $: if (!navigationReady && totalSections > 0) {
    initializeNavigation(totalSections);
    sections.forEach((_, index) => setSlideIndex(index, 0));
    setCurrentSection(0);
    navigationReady = true;
  }

  function attachSectionObserver() {
    if (!laneElement || !sectionObserver) return;
    sectionObserver.disconnect();
    const sectionNodes = laneElement.querySelectorAll('section');
    sectionNodes.forEach((node) => sectionObserver?.observe(node));
  }

  function handleLaneScroll() {
    hideInputsDuringLaneScroll();
  }

  function hideInputsDuringLaneScroll() {
    if (inputsVisible) {
      inputsVisible = false;
    }

    laneVisibilityTimeout && clearTimeout(laneVisibilityTimeout);
    laneVisibilityTimeout = setTimeout(() => {
      inputsVisible = true;
      laneVisibilityTimeout = null;
    }, LANE_INPUT_HIDE_DELAY);
  }

  function scrollToSection(index: number) {
    if (!laneElement) return;
    const sectionNodes = laneElement.querySelectorAll('section');
    if (index < 0 || index >= sectionNodes.length) return;
    if (index === currentSectionIndex) return;

    sectionScrollDebouncer.execute(() => {
      scrollToIndex(laneElement!, 'section', index);
      currentSectionIndex = index;
      setCurrentSection(index);
    });
  }

  function scrollModule(direction: SlideDirection) {
    if (!laneElement) return;

    slideScrollDebouncer.execute(() => {
      const sectionNodes = laneElement!.querySelectorAll('section');
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
    if (laneSelectorVisible) {
      if (detail.type === 'scroll-next-section') {
        deactivateLaneSelector();
        justDeactivatedLaneSelector = true;
        setTimeout(() => {
          justDeactivatedLaneSelector = false;
        }, 100);
      }
      return;
    }

    // Only allow scrolling to LaneSelector if we're at the top of the Lane's internal scroll
    if (
      !laneSelectorVisible &&
      detail.type === 'scroll-prev-section' &&
      currentSectionIndex === 0 &&
      laneElement &&
      laneElement.scrollTop === 0
    ) {
      activateLaneSelector();
      return;
    }

    // Prevent immediate scroll after deactivating LaneSelector
    if (justDeactivatedLaneSelector) {
      return;
    }

    switch (detail.type) {
      case 'scroll-next-section':
        scrollToSection(Math.min(currentSectionIndex + 1, totalSections - 1));
        break;
      case 'scroll-prev-section':
        scrollToSection(Math.max(currentSectionIndex - 1, 0));
        break;
      case 'scroll-next-slide':
        scrollModule('next');
        break;
      case 'scroll-prev-slide':
        scrollModule('prev');
        break;
    }
  }

  onMount(() => {
    unsubscribe = onKeyboardEvent(handleKeyboardEvent);

    // Initially scroll to Lane (skip LaneSelector)
    const laneStage = laneElement?.parentElement;
    if (laneStage && laneElement) {
      laneElement.scrollIntoView({ behavior: 'auto', block: 'start' });
    }

    laneSelectorUnsubscribe = laneSelectorActive.subscribe((value) => {
      laneSelectorVisible = value;
      // Scroll parent container to show LaneSelector or Lane
      if (laneStage) {
        if (value) {
          // Scroll to top (LaneSelector)
          laneStage.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          // Scroll to Lane
          laneElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });

    sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= INTERSECTION_THRESHOLD) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(index)) {
              currentSectionIndex = index;
              setCurrentSection(index);
            }
          }
        }
      },
      {
        root: laneElement,
        threshold: [INTERSECTION_THRESHOLD],
      }
    );
    attachSectionObserver();
  });

  afterUpdate(() => {
    attachSectionObserver();
  });

  onDestroy(() => {
    unsubscribe?.();
    laneSelectorUnsubscribe?.();
    sectionObserver?.disconnect();
    if (laneVisibilityTimeout) {
      clearTimeout(laneVisibilityTimeout);
    }
    sectionScrollDebouncer.cleanup();
    slideScrollDebouncer.cleanup();
  });
</script>

<div class="lane" bind:this={laneElement} on:scroll={handleLaneScroll}>
  {#each sections as section, index}
    <section data-index={index}>
      {#if componentByKind[section.kind]}
        <svelte:component
          this={componentByKind[section.kind]}
          slides={section.slides}
          sectionIndex={index}
          globalInputsVisible={inputsVisible}
        />
      {/if}
    </section>
  {/each}
</div>

<style>
  .lane {
    display: flex;
    flex-direction: column;
    height: 100%;
    flex-shrink: 0;
    overflow-y: scroll;
    scroll-snap-type: y mandatory;
    scroll-snap-align: start;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
  }

  /* Hide scrollbar for Chrome, Safari and Opera */
  .lane::-webkit-scrollbar {
    display: none;
  }
  
  .lane section {
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
