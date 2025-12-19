<script lang="ts">
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { get } from 'svelte/store';
  import XoxSequencer from './XoxSequencer.svelte';
  import MelodySequencer from './MelodySequencer.svelte';
  import SimpleSynth from './SimpleSynth.svelte';
  import { onKeyboardEvent, type KeyboardEventDetail } from './keyboard';
  import type { SectionData } from './types';
  import {
    initializeNavigation,
    setCurrentSection,
    setSlideIndex,
    currentSection,
    slideIndices,
  } from './stores/navigation';

  type SlideDirection = 'next' | 'prev';

  export let sections: SectionData[] = [];
  const componentByKind = {
    xox: XoxSequencer,
    melody: MelodySequencer,
    synth: SimpleSynth,
  } as const;

  let laneElement: HTMLDivElement | null = null;
  let currentSectionIndex = 0;
  let sectionScrolling = false;
  let slideScrolling = false;
  let unsubscribe: (() => void) | null = null;
  let navigationReady = false;
  let sectionObserver: IntersectionObserver | null = null;
  let inputsVisible = true;
  let laneVisibilityTimeout: ReturnType<typeof setTimeout> | null = null;

  $: totalSections = sections.length;
  $: syncedSection = $currentSection ?? 0;
  $: if (!sectionScrolling && syncedSection !== currentSectionIndex) {
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
    }, 220);
  }

  function scrollToSection(index: number) {
    if (!laneElement || sectionScrolling) return;
    const sectionNodes = laneElement.querySelectorAll('section');
    if (index < 0 || index >= sectionNodes.length) return;
    if (index === currentSectionIndex) return;

    sectionScrolling = true;
    sectionNodes[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
    currentSectionIndex = index;
    setCurrentSection(index);

    setTimeout(() => {
      sectionScrolling = false;
    }, 500);
  }

  function scrollModule(direction: SlideDirection) {
    if (!laneElement || slideScrolling) return;
    const sectionNodes = laneElement.querySelectorAll('section');
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

    slideScrolling = true;
    slides[targetIndex].scrollIntoView({ behavior: 'smooth', inline: 'start' });
    setSlideIndex(currentSectionIndex, targetIndex);

    setTimeout(() => {
      slideScrolling = false;
    }, 400);
  }

  function handleKeyboardEvent(detail: KeyboardEventDetail) {
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
    sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
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
        threshold: [0.6],
      }
    );
    attachSectionObserver();
  });

  afterUpdate(() => {
    attachSectionObserver();
  });

  onDestroy(() => {
    unsubscribe?.();
    sectionObserver?.disconnect();
    if (laneVisibilityTimeout) {
      clearTimeout(laneVisibilityTimeout);
    }
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
    flex: 1;
    overflow-y: scroll;
    scroll-snap-type: y mandatory;
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
