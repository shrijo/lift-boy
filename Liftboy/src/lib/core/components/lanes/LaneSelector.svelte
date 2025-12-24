<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Inputs from '../ui/Inputs.svelte';
  import type { SlideData } from '../../types/types';
  import { onKeyboardEvent, type KeyboardEventDetail } from '../../utils/keyboard';
  import {
    laneSelectorActive,
    laneSelectorSlide,
    deactivateLaneSelector,
    lanes,
    selectedLaneIndex,
    laneCount,
  } from '../../stores/session/lanes';
  import type { Lane as LaneState, LaneMode } from '../../types/project';

  const slides: SlideData[] = [
    {
      title: 'Lane Mixer',
      description: 'Select, mute, and balance lanes',
      inputs: [
        { key: 'Lane', value: 1 },
        { key: 'Mode', value: 'On' },
        { key: 'Level', value: 100, unit: '%' },
        { key: 'Pan', value: 0 },
      ],
    },
    {
      title: 'Setup',
      description: 'Global lane management',
      inputs: [
        { key: 'Count', value: 1 },
        { key: '', value: '' },
        { key: '', value: '' },
        { key: '', value: '' },
      ],
    },
  ];

  let unsubscribe: (() => void) | null = null;
  let moduleElement: HTMLDivElement | null = null;

  const SEGMENT_COUNT = 20;
  const LANE_WIDTH = 54; // 46px meters + 8px padding (4px each side)
  const LANE_GAP = 20;
  const SLIDE_WIDTH = 480; // Width of the viewport/slide
  const SLIDE_PADDING = 24; // Horizontal padding of the slide
  const LANE_CENTER = 27; // 4px padding + 23px to visual center of meters

  $: laneVisuals = buildLaneVisuals($lanes);
  $: hasSoloLane = $lanes.some((lane) => lane.mixer.mode === 'solo');
  $: laneOffset = calculateCenterOffset($selectedLaneIndex);

  function buildLaneVisuals(list: LaneState[]) {
    return list.map((lane) => {
      const { left, right } = computeStereoLevels(lane);
      const isMuted = lane.mixer.mode === 'mute';
      const isSolo = lane.mixer.mode === 'solo';
      const visuallyMuted = isMuted || (hasSoloLane && !isSolo);

      return {
        left,
        right,
        isMuted,
        isSolo,
        visuallyMuted,
      };
    });
  }

  function getPosition(laneIndex: number, selectedIndex: number): string {
    if (laneIndex === selectedIndex) return 'center';
    if (laneIndex < selectedIndex) return 'left';
    return 'right';
  }

  function calculateCenterOffset(selectedIndex: number): number {
    const unitWidth = LANE_WIDTH + LANE_GAP;
    // Center the selected lane in the viewport
    // Account for slide padding and lane-card padding
    const slideCenter = SLIDE_WIDTH / 2;
    return slideCenter - SLIDE_PADDING - LANE_CENTER - (selectedIndex * unitWidth);
  }

  function computeStereoLevels(lane: LaneState) {
    const pan = Math.max(-1, Math.min(1, lane.mixer.pan));
    const volume = Math.max(0, Math.min(1, lane.mixer.volume));
    const left = volume * (pan <= 0 ? 1 : 1 - pan);
    const right = volume * (pan >= 0 ? 1 : 1 + pan);
    return {
      left: Number(left.toFixed(2)),
      right: Number(right.toFixed(2)),
    };
  }

  function scrollToSlide(direction: 'next' | 'prev') {
    if (!moduleElement) return;

    const currentSlide = $laneSelectorSlide;
    const targetIndex =
      direction === 'next'
        ? Math.min(currentSlide + 1, slides.length - 1)
        : Math.max(currentSlide - 1, 0);

    if (targetIndex === currentSlide) return;

    const slideElements = moduleElement.querySelectorAll('.slide');
    const targetSlide = slideElements[targetIndex];
    if (targetSlide) {
      targetSlide.scrollIntoView({ behavior: 'smooth', inline: 'start' });
      laneSelectorSlide.set(targetIndex);
    }
  }

  function handleKeyboardEvent(detail: KeyboardEventDetail) {
    if (!$laneSelectorActive) return;

    switch (detail.type) {
      case 'scroll-next-slide':
        scrollToSlide('next');
        break;
      case 'scroll-prev-slide':
        scrollToSlide('prev');
        break;
      case 'scroll-next-section':
        deactivateLaneSelector();
        break;
    }
  }

  onMount(() => {
    unsubscribe = onKeyboardEvent(handleKeyboardEvent);
  });

  onDestroy(() => {
    unsubscribe?.();
  });
</script>

<section
  class="lane-selector"
  data-active={$laneSelectorActive}
  aria-hidden={!$laneSelectorActive}
>
  <div class="module" bind:this={moduleElement}>
    {#each slides as slide, index}
      <div class="slide" aria-label={slide.title ?? `Slide ${index + 1}`}>
        <div
          class="visual"
          style="transform: translateX({laneOffset}px); transition: transform 300ms ease;"
          role="group"
          aria-label="Lane mixer meters"
        >
          {#each laneVisuals as lane, laneIndex}
            <div
              class="lane-card"
              data-selected={laneIndex === $selectedLaneIndex}
              data-position={getPosition(laneIndex, $selectedLaneIndex)}
            >
              <div class="lane-meters" aria-hidden="true">
                <div class="meter" data-selected={laneIndex === $selectedLaneIndex}>
                  {#each Array(SEGMENT_COUNT) as _, segmentIndex}
                    <span
                      class="meter-segment"
                      data-active={!lane.visuallyMuted &&
                        segmentIndex < Math.floor(lane.left * SEGMENT_COUNT)}
                    ></span>
                  {/each}
                </div>
                <div class="meter" data-selected={laneIndex === $selectedLaneIndex}>
                  {#each Array(SEGMENT_COUNT) as _, segmentIndex}
                    <span
                      class="meter-segment"
                      data-active={!lane.visuallyMuted &&
                        segmentIndex < Math.floor(lane.right * SEGMENT_COUNT)}
                    ></span>
                  {/each}
                </div>
              </div>
              <div class="lane-controls" data-selected={laneIndex === $selectedLaneIndex}>
                <span class="mode-indicator" data-active={lane.isMuted}>M</span>
                <span class="mode-indicator" data-active={lane.isSolo}>S</span>
              </div>
              {#if laneIndex === $selectedLaneIndex}
                <span class="cursor" aria-hidden="true"></span>
              {/if}
            </div>
          {/each}
        </div>
        <div class="inputs-row">
          <Inputs
            kind="lane"
            inputs={slide.inputs}
            sectionIndex={-1}
            slideIndex={index}
            visible={true}
          />
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .lane-selector {
    background: var(--color-black);
    display: flex;
    align-items: stretch;
    justify-content: center;
    height: 100%;
    flex-shrink: 0;
    scroll-snap-align: start;
  }

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
    gap: 12px;
    position: relative;
    overflow: hidden;
  }

  .visual {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 20px;
  }

  .lane-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    padding: 4px;
    position: relative;
    transition: opacity 300ms ease;
  }

  .lane-card[data-position="center"] {
    opacity: 1.0;
  }

  .lane-card[data-position="left"],
  .lane-card[data-position="right"] {
    opacity: 0.4;
  }

  .lane-meters {
    display: flex;
    gap: 6px;
    height: 118px;
  }

  .meter {
    width: 20px;
    padding: 0 1px;
    display: flex;
    flex-direction: column-reverse;
    gap: 2px;
    justify-content: flex-start;
  }

  .meter-segment {
    height: 4px;
    width: 100%;
    background: var(--color-dark);
    transition: background 80ms ease;
  }

  .meter-segment[data-active="true"] {
    background: var(--color-middle);
  }

  .meter[data-selected="true"] .meter-segment {
    background: var(--color-middle);
  }

  .meter[data-selected="true"] .meter-segment[data-active="true"] {
    background: var(--color-white);
  }

  .lane-controls {
    display: flex;
    gap: 12px;
    justify-content: center;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .mode-indicator {
    color: var(--color-dark);
    transition: color 80ms ease;
  }

  .mode-indicator[data-active="true"] {
    color: var(--color-middle);
  }

  .lane-controls[data-selected="true"] .mode-indicator {
    color: var(--color-middle);
  }

  .lane-controls[data-selected="true"] .mode-indicator[data-active="true"] {
    color: var(--color-white);
  }

  .cursor {
    width: 10px;
    height: 10px;
    background: var(--color-white);
    border-radius: 50%;
    position: absolute;
    bottom: -18px;
  }

  .inputs-row {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
  }
</style>
