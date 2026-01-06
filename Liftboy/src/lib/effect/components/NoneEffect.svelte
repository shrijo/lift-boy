<script lang="ts">
  import Inputs from '../../core/components/ui/Inputs.svelte';
  import type { SlideData } from '../../core/types/types';

  export let slides: SlideData[] = [];
  export let sectionIndex = 0;
  export let globalInputsVisible = true;
</script>

<section class="none-effect" aria-label="No Effect">
  <div class="module">
    {#each slides as slide, index}
      <div class="slide" aria-label={slide.title ?? `Slide ${index + 1}`}>
        <div class="visual">
          <div class="message">
            <p class="title">No Effect</p>
            <p class="description">Audio passes through without processing</p>
          </div>
        </div>
        <div class="inputs-row">
          <Inputs
            kind="none"
            inputs={slide.inputs}
            sectionIndex={sectionIndex}
            slideIndex={index}
            visible={globalInputsVisible}
          />
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .none-effect {
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
  }

  .visual {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .message {
    text-align: center;
    opacity: 0.5;
  }

  .title {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-white);
    margin: 0 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .description {
    font-size: 11px;
    color: var(--color-middle);
    margin: 0;
  }

  .inputs-row {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
  }
</style>
