<script lang="ts">
  import { onDestroy } from "svelte";
  import { onKeyboardEvent, type KeyboardEventDetail } from "../../utils/keyboard";
  import BpmDisplay from "../transport/BpmDisplay.svelte";
  import { isPlaying, togglePlay, stopTransport, audioError } from "../../audio/engine";
  import { storageError } from "../../stores/data/projects";

  let playing = false;
  const unsubscribe = isPlaying.subscribe((value) => {
    playing = value;
  });

  const unsubscribeKeyboard = onKeyboardEvent(handleKeyboardEvent);

  onDestroy(() => {
    unsubscribe();
    unsubscribeKeyboard();
  });

  async function handlePlayToggle() {
    await togglePlay();
  }

  function handleStop() {
    stopTransport();
  }

  function handleKeyboardEvent(detail: KeyboardEventDetail) {
    if (detail.type === "toggle-playback") {
      handlePlayToggle();
    }
  }

  $: errorMessage = $audioError || $storageError;
</script>

{#if errorMessage}
  <div class="error-banner">
    {errorMessage}
  </div>
{/if}

<div class="header" role="toolbar" aria-label="Transport controls">
  <button
    type="button"
    class="control"
    class:active={playing}
    on:click={handlePlayToggle}
    aria-pressed={playing}
  >
    {playing ? "Pause" : "Play"}
  </button>
  <button type="button" class="control" on:click={handleStop}>Stop</button>
  <BpmDisplay />
</div>

<style>
  .header {
    padding: 1px;
    gap: 2px;
    height: 20px;
    display: flex;
    align-items: center;
  }

  .control {
    flex: 0 0 80px;
    height: 18px;
    border: none;
    background-color: var(--color-dark);
    color: var(--color-middle);
    font: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .control.active {
    background-color: var(--color-middle);
    color: var(--color-black);
  }

  .error-banner {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background-color: #d32f2f;
    color: #ffffff;
    padding: 4px 8px;
    font-size: 11px;
    text-align: center;
    z-index: 1000;
    animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>