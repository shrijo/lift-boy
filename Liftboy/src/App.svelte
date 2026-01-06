<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Header from './lib/core/components/ui/Header.svelte';
  import LaneSelector from './lib/core/components/lanes/LaneSelector.svelte';
  import ModuleSelector from './lib/core/components/ui/ModuleSelector.svelte';
  import XoxSequencer from './lib/rhythm/components/XoxSequencer.svelte';
  import EuclideanSequencer from './lib/rhythm/components/EuclideanSequencer.svelte';
  import M185Sequencer from './lib/rhythm/components/M185Sequencer.svelte';
  import MelodySequencer from './lib/melody/components/MelodySequencer.svelte';
  import StochasticSequencer from './lib/melody/components/StochasticSequencer.svelte';
  import SimpleSynth from './lib/instrument/components/SimpleSynth.svelte';
  import KickDrum from './lib/instrument/components/KickDrum.svelte';
  import HihatDrum from './lib/instrument/components/HihatDrum.svelte';
  import SnareDrum from './lib/instrument/components/SnareDrum.svelte';
  import CongaDrum from './lib/instrument/components/CongaDrum.svelte';
  import ClapDrum from './lib/instrument/components/ClapDrum.svelte';
  import DelayEffect from './lib/effect/components/DelayEffect.svelte';
  import ReverbEffect from './lib/effect/components/ReverbEffect.svelte';
  import NoneEffect from './lib/effect/components/NoneEffect.svelte';
  import { initKeyboardControls, destroyKeyboardControls, onKeyboardEvent, type KeyboardEventDetail } from './lib/core/utils/keyboard';
  import { initLaneModuleSync } from './lib/core/stores/sync/laneModuleSync';
  import {
    activateLaneSelector,
    deactivateLaneSelector,
    selectedLaneIndex,
    lanes,
  } from './lib/core/stores/session/lanes';
  import { assignModule } from './lib/core/stores/data/projects';
  import {
    currentSection,
    setCurrentSection,
    initializeNavigation,
    slideIndices,
    setSlideIndex
  } from './lib/core/stores/session/navigation';
  import {
    openModuleSelector,
    closeModuleSelector,
    isModuleSelectorOpen,
  } from './lib/core/stores/session/moduleSelection';
  import type { SectionData, SectionKind } from './lib/core/types/types';
  import type { ModuleCategory, Lane } from './lib/core/types/project';
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
    // Block all navigation when module selector is open
    if ($isModuleSelectorOpen) {
      // ModuleSelector handles its own keyboard events
      return;
    }

    switch (detail.type) {
      case 'open-module-selector':
        // Don't allow opening module selector when on LaneSelector
        if (laneSelectorVisible) {
          return;
        }
        handleOpenModuleSelector();
        break;
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

  function handleOpenModuleSelector() {
    // Determine which category based on current section
    const sectionIndex = $currentSection ?? 0;
    const section = sections[sectionIndex];
    if (!section) return;

    let category: ModuleCategory;
    if (section.kind === 'xox' || section.kind === 'euclidean' || section.kind === 'm185') {
      category = 'rhythm';
    } else if (section.kind === 'melody' || section.kind === 'stochastic') {
      category = 'melody';
    } else if (section.kind === 'synth') {
      category = 'instrument';
    } else if (section.kind === 'delay' || section.kind === 'reverb' || section.kind === 'none') {
      category = 'effect';
    } else {
      return;
    }

    openModuleSelector(category);
  }

  function handleModuleConfirm(definitionId: string) {
    const sectionIndex = $currentSection ?? 0;
    const section = sections[sectionIndex];
    if (!section) {
      closeModuleSelector();
      return;
    }

    // Determine category from section kind
    let category: ModuleCategory;
    if (section.kind === 'xox' || section.kind === 'euclidean' || section.kind === 'm185') {
      category = 'rhythm';
    } else if (section.kind === 'melody' || section.kind === 'stochastic') {
      category = 'melody';
    } else if (section.kind === 'synth') {
      category = 'instrument';
    } else if (section.kind === 'delay' || section.kind === 'reverb' || section.kind === 'none') {
      category = 'effect';
    } else {
      closeModuleSelector();
      return;
    }

    // Update the actual lane's module definition
    const laneIndex = $selectedLaneIndex ?? 0;
    assignModule(laneIndex, category, definitionId);

    closeModuleSelector();
  }

  // Build sections from the currently selected lane's modules
  $: currentLane = $lanes[$selectedLaneIndex ?? 0];

  $: sections = buildSections(currentLane);

  function buildSections(lane: Lane | undefined): SectionData[] {
    if (!lane) return [];

    const result: SectionData[] = [];

    // Rhythm module section
    if (lane.modules.rhythm) {
      const rhythmId = lane.modules.rhythm.definitionId;
      if (rhythmId === 'rhythm.xox-basic') {
        result.push({
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
        });
      } else if (rhythmId === 'rhythm.euclidean') {
        result.push({
          name: 'Euclidean Sequencer',
          kind: 'euclidean',
          slides: [
            {
              title: 'Pattern',
              description: 'Euclidean rhythm generator',
              inputs: [
                { key: 'Steps', value: 16, unit: '', min: 1, max: 32, step: 1 },
                { key: 'Pulses', value: 4, unit: '', min: 0, max: 32, step: 1 },
                { key: 'Rotation', value: 0, unit: '', min: 0, max: 31, step: 1 },
                { key: 'Clock', value: '1/16', options: ['1/4', '1/8', '1/16', '1/32'] },
              ],
            },
          ],
        });
      } else if (rhythmId === 'rhythm.m185') {
        result.push({
          name: 'M185 Sequencer',
          kind: 'm185',
          slides: [
            {
              title: 'Entries',
              description: 'Trigger pattern entries',
              inputs: [
                { key: 'Entry', value: 1, unit: '', min: 1, max: 16, step: 1 },
                { key: 'Mode', value: 'repeat', options: ['repeat', 'hold', 'skip'] },
                { key: 'Steps', value: 1, unit: '', min: 1, max: 16, step: 1 },
                { key: '', value: '' },
              ],
            },
            {
              title: 'Pattern',
              description: 'Global settings',
              inputs: [
                { key: 'Clock', value: '1/16', options: ['1/4', '1/8', '1/16', '1/32'] },
                { key: '', value: '' },
                { key: '', value: '' },
                { key: '', value: '' },
              ],
            },
          ],
        });
      }
    }

    // Melody module section
    if (lane.modules.melody) {
      const melodyId = lane.modules.melody.definitionId;
      if (melodyId === 'melody.melody-basic') {
        result.push({
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
        });
      } else if (melodyId === 'melody.stochastic') {
        result.push({
          name: 'Stochastic Sequencer',
          kind: 'stochastic',
          slides: [
            {
              title: 'Random',
              description: 'Probability-based melody',
              inputs: [
                { key: 'Min Note', value: 0, unit: '', min: 0, max: 7, step: 1 },
                { key: 'Max Note', value: 7, unit: '', min: 0, max: 7, step: 1 },
                { key: 'Change', value: 50, unit: '%', min: 0, max: 100, step: 5 },
                { key: 'Clock', value: '1/16', options: ['1/4', '1/8', '1/16', '1/32'] },
              ],
            },
          ],
        });
      }
    }

    // Instrument module section
    if (lane.modules.instrument) {
      const instrumentId = lane.modules.instrument.definitionId;
      if (instrumentId === 'instrument.synth-simple') {
        result.push({
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
        });
      } else if (instrumentId === 'instrument.kick') {
        result.push({
          name: 'Kick Drum',
          kind: 'kick',
          slides: [
            {
              title: 'Kick',
              description: 'Bass drum parameters',
              inputs: [
                { key: 'Pitch', value: 60, unit: ' Hz', min: 20, max: 100, step: 1 },
                { key: 'Pitch Decay', value: 0.05, unit: ' s', min: 0, max: 1, step: 0.01 },
                { key: 'Tone', value: 0.5, unit: '', min: 0, max: 1, step: 0.05 },
                { key: 'Decay', value: 0.3, unit: ' s', min: 0, max: 2, step: 0.05 },
              ],
            },
          ],
        });
      } else if (instrumentId === 'instrument.hihat') {
        result.push({
          name: 'Hi-Hat',
          kind: 'hihat',
          slides: [
            {
              title: 'Hi-Hat',
              description: 'Metallic hi-hat parameters',
              inputs: [
                { key: 'Tone', value: 0.7, unit: '', min: 0, max: 1, step: 0.05 },
                { key: 'Decay', value: 0.05, unit: ' s', min: 0, max: 1, step: 0.01 },
                { key: 'Resonance', value: 0.5, unit: '', min: 0, max: 1, step: 0.05 },
                { key: '', value: '' },
              ],
            },
          ],
        });
      } else if (instrumentId === 'instrument.snare') {
        result.push({
          name: 'Snare Drum',
          kind: 'snare',
          slides: [
            {
              title: 'Snare',
              description: 'Snare drum parameters',
              inputs: [
                { key: 'Tone', value: 0.5, unit: '', min: 0, max: 1, step: 0.05 },
                { key: 'Snap', value: 0.8, unit: '', min: 0, max: 1, step: 0.05 },
                { key: 'Decay', value: 0.15, unit: ' s', min: 0, max: 1, step: 0.01 },
                { key: '', value: '' },
              ],
            },
          ],
        });
      } else if (instrumentId === 'instrument.conga') {
        result.push({
          name: 'Conga Drum',
          kind: 'conga',
          slides: [
            {
              title: 'Conga',
              description: 'Tuned conga parameters',
              inputs: [
                { key: 'Pitch', value: 150, unit: ' Hz', min: 80, max: 300, step: 5 },
                { key: 'Pitch Decay', value: 0.08, unit: ' s', min: 0, max: 0.5, step: 0.01 },
                { key: 'Tone', value: 0.6, unit: '', min: 0, max: 1, step: 0.05 },
                { key: 'Decay', value: 0.2, unit: ' s', min: 0, max: 1, step: 0.01 },
              ],
            },
          ],
        });
      } else if (instrumentId === 'instrument.clap') {
        result.push({
          name: 'Clap',
          kind: 'clap',
          slides: [
            {
              title: 'Clap',
              description: 'Hand clap parameters',
              inputs: [
                { key: 'Tone', value: 0.6, unit: '', min: 0, max: 1, step: 0.05 },
                { key: 'Decay', value: 0.08, unit: ' s', min: 0, max: 1, step: 0.01 },
                { key: 'Spread', value: 0.5, unit: '', min: 0, max: 1, step: 0.05 },
                { key: '', value: '' },
              ],
            },
          ],
        });
      }
    }

    // Effect module section
    if (lane.modules.effect) {
      const effectId = lane.modules.effect.definitionId;
      if (effectId === 'effect.delay') {
        result.push({
          name: 'Delay Effect',
          kind: 'delay',
          slides: [
            {
              title: 'Delay',
              description: 'Feedback delay effect',
              inputs: [
                { key: 'Time', value: 0.25, unit: ' s', min: 0, max: 2, step: 0.01 },
                { key: 'Feedback', value: 0.3, unit: '', min: 0, max: 0.95, step: 0.01 },
                { key: 'Mix', value: 0.3, unit: '', min: 0, max: 1, step: 0.01 },
                { key: '', value: '' },
              ],
            },
          ],
        });
      } else if (effectId === 'effect.reverb') {
        result.push({
          name: 'Reverb Effect',
          kind: 'reverb',
          slides: [
            {
              title: 'Reverb',
              description: 'Space simulation effect',
              inputs: [
                { key: 'Room Size', value: 0.5, unit: '', min: 0, max: 1, step: 0.05 },
                { key: 'Decay', value: 1.5, unit: ' s', min: 0, max: 10, step: 0.1 },
                { key: 'Mix', value: 0.3, unit: '', min: 0, max: 1, step: 0.05 },
                { key: 'Pre-Delay', value: 0.01, unit: ' s', min: 0, max: 0.1, step: 0.001 },
              ],
            },
          ],
        });
      } else if (effectId === 'effect.none') {
        result.push({
          name: 'No Effect',
          kind: 'none',
          slides: [
            {
              title: 'None',
              description: 'No effect processing (bypass)',
              inputs: [
                { key: '', value: '' },
                { key: '', value: '' },
                { key: '', value: '' },
                { key: '', value: '' },
              ],
            },
          ],
        });
      }
    }

    return result;
  }

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
        {:else if section.kind === 'euclidean'}
          <svelte:component
            this={EuclideanSequencer}
            slides={section.slides}
            sectionIndex={index}
            globalInputsVisible={true}
          />
        {:else if section.kind === 'm185'}
          <svelte:component
            this={M185Sequencer}
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
        {:else if section.kind === 'stochastic'}
          <svelte:component
            this={StochasticSequencer}
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
        {:else if section.kind === 'kick'}
          <svelte:component
            this={KickDrum}
            slides={section.slides}
            sectionIndex={index}
            globalInputsVisible={true}
          />
        {:else if section.kind === 'hihat'}
          <svelte:component
            this={HihatDrum}
            slides={section.slides}
            sectionIndex={index}
            globalInputsVisible={true}
          />
        {:else if section.kind === 'snare'}
          <svelte:component
            this={SnareDrum}
            slides={section.slides}
            sectionIndex={index}
            globalInputsVisible={true}
          />
        {:else if section.kind === 'conga'}
          <svelte:component
            this={CongaDrum}
            slides={section.slides}
            sectionIndex={index}
            globalInputsVisible={true}
          />
        {:else if section.kind === 'clap'}
          <svelte:component
            this={ClapDrum}
            slides={section.slides}
            sectionIndex={index}
            globalInputsVisible={true}
          />
        {:else if section.kind === 'delay'}
          <svelte:component
            this={DelayEffect}
            slides={section.slides}
            sectionIndex={index}
            globalInputsVisible={true}
          />
        {:else if section.kind === 'reverb'}
          <svelte:component
            this={ReverbEffect}
            slides={section.slides}
            sectionIndex={index}
            globalInputsVisible={true}
          />
        {:else if section.kind === 'none'}
          <svelte:component
            this={NoneEffect}
            slides={section.slides}
            sectionIndex={index}
            globalInputsVisible={true}
          />
        {/if}
      </section>
    {/each}
  </div>
  <ModuleSelector onConfirm={handleModuleConfirm} />
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
