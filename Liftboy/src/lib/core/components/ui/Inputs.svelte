<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { currentSection, currentSlideIndex } from '../../stores/session/navigation';
    import type { SlideInput, InputKind } from '../../types/types';
    import type { StepState } from '../../../rhythm/stores/sequencer';
    import type { BarState } from '../../../melody/stores/melody';
    import type { SynthState } from '../../../instrument/stores/synth';
    import type { Lane, LaneMode } from '../../types/project';
    import {
        activeStep,
        selectedStep,
        patternLength,
        clockLabel,
        orderLabel,
        incrementSelectedStep,
        setStepActive,
        adjustStepDuration,
        adjustStepProbability,
        adjustPatternLength,
        cycleClock,
        cycleOrder,
    } from '../../../rhythm/stores/sequencer';
    import {
        activeBar as activeMelodyBar,
        selectedBar as melodySelectedBar,
        sequenceLength as melodySequenceLength,
        skipLabel as melodySkipLabel,
        orderLabel as melodyOrderLabel,
        incrementSelectedBar,
        adjustBarValue,
        setBarGlide,
        setBarRandomize,
        adjustMelodyLength,
        cycleSkip,
        cycleMelodyOrder,
    } from '../../../melody/stores/melody';
    import {
        synthSettings,
        cycleWave,
        adjustHarmonicity,
        cycleModulation,
        adjustPortamento,
        adjustAttack,
        adjustDecay,
        adjustSustain,
        adjustRelease,
    } from '../../../instrument/stores/synth';
    import {
        laneSelectorActive,
        laneSelectorSlide,
        laneCount,
        currentLane,
        selectedLaneIndex as laneSelectedIndex,
        incrementSelectedLane,
        cycleLaneMode,
        adjustLaneVolume,
        adjustLanePan,
        adjustLaneCount,
    } from '../../stores/session/lanes';
    import { onKeyboardEvent, type KeyboardEventDetail } from '../../utils/keyboard';

    export let kind: InputKind;
    export let inputs: SlideInput[] = [];
    export let sectionIndex: number;
    export let slideIndex: number;
    export let visible = true;

    let selectedInput: number | null = null;
    let unsubscribe: (() => void) | null = null;
    let wasActive = false;

    $: laneSlideActive =
        kind === 'lane' && $laneSelectorActive && $laneSelectorSlide === slideIndex;
    $: moduleActive =
        kind !== 'lane' && $currentSection === sectionIndex && $currentSlideIndex === slideIndex;
    $: isActive = visible && (laneSlideActive || moduleActive);

    $: xoxContext = {
        stepIndex: $selectedStep,
        stepData: $activeStep,
        lengthValue: $patternLength,
        clockValue: $clockLabel,
        orderValue: $orderLabel,
    };

    $: melodyContext = {
        barIndex: $melodySelectedBar,
        barData: $activeMelodyBar,
        lengthValue: $melodySequenceLength,
        skipValue: $melodySkipLabel,
        orderValue: $melodyOrderLabel,
    };

    $: synthContext = {
        wave: $synthSettings.wave,
        harmonicity: $synthSettings.harmonicity,
        modulation: $synthSettings.modulation,
        portamento: $synthSettings.portamento,
        attack: $synthSettings.attack,
        decay: $synthSettings.decay,
        sustain: $synthSettings.sustain,
        release: $synthSettings.release,
    } satisfies SynthState;

    $: laneContext = {
        total: $laneCount,
        laneIndex: $laneSelectedIndex,
        laneData: $currentLane,
    } satisfies {
        total: number;
        laneIndex: number;
        laneData: Lane | undefined;
    };

    $: entries = inputs.map((meta, index) => ({
        meta,
        display: formatDisplay(kind, slideIndex, index, {
            xox: xoxContext,
            melody: melodyContext,
            synth: synthContext,
            lane: laneContext,
        }),
    }));

    $: if (selectedInput !== null && selectedInput >= inputs.length) {
        selectedInput = inputs.length ? inputs.length - 1 : null;
    }

    $: if (!isActive && selectedInput !== null) {
        selectedInput = null;
    }

    $: if (isActive && !wasActive) {
        selectedInput = null;
    }

    $: wasActive = isActive;

    function formatDisplay(
        kind: InputKind,
        pageIndex: number,
        inputIndex: number,
        context: {
            xox: {
                stepIndex: number;
                stepData: StepState | undefined;
                lengthValue: number;
                clockValue: string;
                orderValue: string;
            };
            melody: {
                barIndex: number;
                barData: BarState | undefined;
                lengthValue: number;
                skipValue: string;
                orderValue: string;
            };
            synth: SynthState;
            lane: {
                total: number;
                laneIndex: number;
                laneData: Lane | undefined;
            };
        }
    ): string {
        const { xox, melody, synth, lane } = context;

        if (kind === 'lane') {
            if (pageIndex === 0) {
                switch (inputIndex) {
                    case 0:
                        return formatLaneLabel(lane.laneIndex);
                    case 1:
                        return formatLaneMode(lane.laneData?.mixer.mode);
                    case 2:
                        return formatLaneVolume(lane.laneData?.mixer.volume);
                    case 3:
                        return formatLanePan(lane.laneData?.mixer.pan);
                    default:
                        return '—';
                }
            }

            if (pageIndex === 1 && inputIndex === 0) {
                return `${lane.total} lanes`;
            }

            return '—';
        }

        if (kind === 'synth') {
            if (pageIndex === 0) {
                switch (inputIndex) {
                    case 0:
                        return synth.wave.toUpperCase();
                    case 1:
                        return synth.harmonicity.toFixed(2);
                    case 2:
                        return synth.modulation.toUpperCase();
                    case 3:
                        return formatSeconds(synth.portamento);
                    default:
                        return '—';
                }
            }

            switch (inputIndex) {
                case 0:
                    return formatSeconds(synth.attack);
                case 1:
                    return formatSeconds(synth.decay);
                case 2:
                    return formatPercent(synth.sustain);
                case 3:
                    return formatSeconds(synth.release);
                default:
                    return '—';
            }
        }

        if (kind === 'melody') {
            if (pageIndex === 0) {
                switch (inputIndex) {
                    case 0:
                        return String(melody.barIndex + 1).padStart(2, '0');
                    case 1:
                        return `${melody.barData?.value ?? 0}`;
                    case 2:
                        return melody.barData?.glide ? 'On' : 'Off';
                    case 3:
                        return melody.barData?.randomize ? 'On' : 'Off';
                    default:
                        return '—';
                }
            }

            switch (inputIndex) {
                case 0:
                    return `${melody.lengthValue} bars`;
                case 1:
                    return melody.skipValue;
                case 2:
                    return melody.orderValue;
                default:
                    return '—';
            }
        }

        if (pageIndex === 0) {
            switch (inputIndex) {
                case 0:
                    return String(xox.stepIndex + 1).padStart(2, '0');
                case 1:
                    return xox.stepData?.active ? 'On' : 'Off';
                case 2:
                    const duration = xox.stepData?.duration ?? 0;
                    return `${duration.toFixed(2).replace(/\.00$/, '')} steps`;
                case 3:
                    return `${xox.stepData?.probability ?? 0}%`;
                default:
                    return '—';
            }
        }

        switch (inputIndex) {
            case 0:
                return `${xox.lengthValue} steps`;
            case 1:
                return xox.clockValue;
            case 2:
                return xox.orderValue;
            default:
                return '—';
        }
    }

    function formatSeconds(value: number) {
        return `${value.toFixed(2).replace(/\.00$/, '')} s`;
    }

    function formatPercent(value: number) {
        return `${Math.round(value * 100)}%`;
    }

    function formatLaneLabel(index: number) {
        return `LN ${String(index + 1).padStart(2, '0')}`;
    }

    function formatLaneMode(mode: LaneMode | undefined) {
        switch (mode) {
            case 'mute':
                return 'Mute';
            case 'solo':
                return 'Solo';
            default:
                return 'On';
        }
    }

    function formatLaneVolume(value: number | undefined) {
        return `${Math.round((value ?? 0) * 100)}%`;
    }

    function formatLanePan(value: number | undefined) {
        const pan = value ?? 0;
        if (Math.abs(pan) < 0.01) return 'C';
        const label = pan < 0 ? 'L' : 'R';
        const amount = String(Math.round(Math.abs(pan) * 100)).padStart(2, '0');
        return `${label}${amount}`;
    }

    function handleKeyboard(detail: KeyboardEventDetail) {
        if (!isActive) return;

        switch (detail.type) {
            case 'select-input':
                if (typeof detail.inputIndex === 'number') {
                    selectedInput = detail.inputIndex < inputs.length ? detail.inputIndex : null;
                }
                break;
            case 'clear-input-selection':
                selectedInput = null;
                break;
            case 'adjust-input-up':
            case 'adjust-input-down':
                if (selectedInput === null) return;
                if (typeof detail.inputIndex === 'number') {
                    selectedInput = detail.inputIndex;
                }
                adjustSelected(detail.type === 'adjust-input-up' ? 1 : -1);
                break;
        }
    }

    function adjustSelected(direction: 1 | -1) {
        if (selectedInput === null) return;

        if (kind === 'lane') {
            if (slideIndex === 0) {
                switch (selectedInput) {
                    case 0:
                        incrementSelectedLane(direction);
                        break;
                    case 1:
                        cycleLaneMode(direction);
                        break;
                    case 2:
                        adjustLaneVolume(direction);
                        break;
                    case 3:
                        adjustLanePan(direction);
                        break;
                }
                return;
            }

            if (slideIndex === 1 && selectedInput === 0) {
                adjustLaneCount(direction);
            }
            return;
        }

        if (kind === 'synth') {
            if (slideIndex === 0) {
                switch (selectedInput) {
                    case 0:
                        cycleWave(direction);
                        break;
                    case 1:
                        adjustHarmonicity(direction);
                        break;
                    case 2:
                        cycleModulation(direction);
                        break;
                    case 3:
                        adjustPortamento(direction);
                        break;
                }
                return;
            }

            switch (selectedInput) {
                case 0:
                    adjustAttack(direction);
                    break;
                case 1:
                    adjustDecay(direction);
                    break;
                case 2:
                    adjustSustain(direction);
                    break;
                case 3:
                    adjustRelease(direction);
                    break;
            }
            return;
        }

        if (kind === 'melody') {
            if (slideIndex === 0) {
                switch (selectedInput) {
                    case 0:
                        incrementSelectedBar(direction);
                        break;
                    case 1:
                        adjustBarValue(direction);
                        break;
                    case 2:
                        setBarGlide(direction > 0);
                        break;
                    case 3:
                        setBarRandomize(direction > 0);
                        break;
                }
                return;
            }

            switch (selectedInput) {
                case 0:
                    adjustMelodyLength(direction);
                    break;
                case 1:
                    cycleSkip(direction);
                    break;
                case 2:
                    cycleMelodyOrder(direction);
                    break;
            }
            return;
        }

        if (slideIndex === 0) {
            switch (selectedInput) {
                case 0:
                    incrementSelectedStep(direction);
                    break;
                case 1:
                    setStepActive(direction > 0);
                    break;
                case 2:
                    adjustStepDuration(direction);
                    break;
                case 3:
                    adjustStepProbability(direction);
                    break;
            }
            return;
        }

        switch (selectedInput) {
            case 0:
                adjustPatternLength(direction);
                break;
            case 1:
                cycleClock(direction);
                break;
            case 2:
                cycleOrder(direction);
                break;
        }
    }

    function handleInputClick(index: number) {
        if (!isActive) return;
        selectedInput = index < inputs.length ? index : null;
    }

    onMount(() => {
        unsubscribe = onKeyboardEvent(handleKeyboard);
    });

    onDestroy(() => {
        unsubscribe?.();
    });
</script>

<div
    class="inputs"
    aria-hidden={!isActive || !visible}
    data-active={isActive}
    data-visible={visible}
>
    {#if entries.length}
        {#each entries as entry, index}
            <button
                type="button"
                class="input"
                class:selected={isActive && index === selectedInput}
                aria-pressed={isActive && index === selectedInput}
                on:click={() => handleInputClick(index)}
            >
                <p class="key">{entry.meta.key || '—'}</p>
                <p class="value">{entry.display}</p>
            </button>
        {/each}
    {:else}
        <div class="input placeholder">
            <p class="key">—</p>
            <p class="value">—</p>
        </div>
    {/if}
</div>

<style>
    .inputs {
        display: flex;
        flex-direction: row;
        gap: 2px;
        width: calc(100% - 2px);
        height: 18px;
        min-height: 18px;
        align-items: stretch;
        margin: 1px;
        overflow: hidden;
        transition: opacity 0.2s ease;
    }

    .inputs[data-active="false"] {
        opacity: 0.5;
    }

    .inputs[data-visible="false"] {
        opacity: 0;
        pointer-events: none;
    }

    .input {
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

    .input.selected {
        background-color: var(--color-middle);
        color: var(--color-black);
    }

    .input .key {
        flex: 1;
        text-align: left;
        color: var(--color-middle);
    }

    .input .value {
        font-variant-numeric: tabular-nums;
        color: var(--color-white);
    }

    .input.selected .key {
        color: var(--color-dark);
    }

    .input.selected .value {
        color: var(--color-black);
    }

    .input.placeholder {
        justify-content: center;
        cursor: default;
    }
</style>