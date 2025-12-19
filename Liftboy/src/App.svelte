<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Header from './lib/Header.svelte';
  import Lane from './lib/Lane.svelte';
  import { initKeyboardControls, destroyKeyboardControls } from './lib/keyboard';
  import type { SectionData } from './lib/types';

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
  });

  onDestroy(() => {
    destroyKeyboardControls();
  });
</script>

<main>
  <Header />
  <Lane {sections} />  
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
</style>
