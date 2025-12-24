<script lang="ts">
  import { onDestroy } from "svelte";
  import { bpm, adjustBpm } from "../../stores/session/transport";
  import { onKeyboardEvent, type KeyboardEventDetail } from "../../utils/keyboard";

  let value = 120;
  let selected = false;

  const unsubscribeBpm = bpm.subscribe((val) => {
    value = val;
  });

  const unsubscribeKeyboard = onKeyboardEvent(handleKeyboard);

  onDestroy(() => {
    unsubscribeBpm();
    unsubscribeKeyboard();
  });

  function handleKeyboard(detail: KeyboardEventDetail) {
    switch (detail.type) {
      case "select-bpm":
        selected = true;
        break;
      case "clear-bpm-selection":
        selected = false;
        break;
      case "adjust-bpm-up":
        if (selected) adjustBpm(1);
        break;
      case "adjust-bpm-down":
        if (selected) adjustBpm(-1);
        break;
    }
  }

</script>

<button type="button" class="bpm" class:selected={selected}>
  <p class="key">BPM</p>
  <p class="value">{value}</p>
</button>

<style>
  .bpm {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    height: 18px;
    flex: 1;
    background-color: var(--color-dark);
    gap: 8px;
    padding: 0 8px;
    border: none;
    cursor: pointer;
    color: var(--color-middle);
    font: inherit;
  }

  .bpm.selected {
    background-color: var(--color-middle);
  }

  .bpm .key {
    color: var(--color-middle);
  }

  .bpm.selected .key {
    color: var(--color-dark);
  }

  .value {
    color: var(--color-white);
    font-variant-numeric: tabular-nums;
  }

  .bpm.selected .value {
    color: var(--color-black);
  }
</style>
