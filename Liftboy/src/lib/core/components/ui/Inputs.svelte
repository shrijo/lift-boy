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
        kickSettings,
        adjustPitch as adjustKickPitch,
        adjustPitchDecay as adjustKickPitchDecay,
        adjustTone as adjustKickTone,
        adjustDecay as adjustKickDecay,
    } from '../../../instrument/stores/kick';
    import {
        hihatSettings,
        adjustTone as adjustHihatTone,
        adjustDecay as adjustHihatDecay,
        adjustResonance,
    } from '../../../instrument/stores/hihat';
    import {
        snareSettings,
        adjustTone as adjustSnareTone,
        adjustSnap,
        adjustDecay as adjustSnareDecay,
    } from '../../../instrument/stores/snare';
    import {
        congaSettings,
        adjustPitch as adjustCongaPitch,
        adjustPitchDecay as adjustCongaPitchDecay,
        adjustTone as adjustCongaTone,
        adjustDecay as adjustCongaDecay,
    } from '../../../instrument/stores/conga';
    import {
        clapSettings,
        adjustTone as adjustClapTone,
        adjustDecay as adjustClapDecay,
        adjustSpread,
    } from '../../../instrument/stores/clap';
    import {
        euclideanSteps,
        euclideanPulses,
        euclideanRotation,
        euclideanClockLabel,
        euclideanOrderLabel,
        adjustEuclideanSteps,
        adjustEuclideanPulses,
        adjustEuclideanRotation,
        cycleEuclideanClock,
        cycleEuclideanOrder,
    } from '../../../rhythm/stores/euclidean';
    import {
        m185Entries,
        activeEntry,
        selectedEntry,
        m185Length,
        m185ClockLabel,
        m185OrderLabel,
        modeLabel,
        incrementSelectedEntry,
        adjustEntrySteps,
        cycleEntryMode,
        adjustM185Length,
        cycleM185Clock,
        cycleM185Order,
    } from '../../../rhythm/stores/m185';
    import {
        stochasticMinNote,
        stochasticMaxNote,
        stochasticChangeProb,
        stochasticCurrentNote,
        adjustStochasticMin,
        adjustStochasticMax,
        adjustStochasticChangeProb,
    } from '../../../melody/stores/stochastic';
    import {
        delayTime,
        delayFeedback,
        delayMix,
        delayTimeLabel,
        delayFeedbackLabel,
        delayMixLabel,
        adjustDelayTime,
        adjustDelayFeedback,
        adjustDelayMix,
    } from '../../../effect/stores/delay';
    import {
        reverbRoomSize,
        reverbDecay,
        reverbMix,
        reverbPreDelay,
        reverbRoomLabel,
        reverbDecayLabel,
        reverbMixLabel,
        reverbPreDelayLabel,
        adjustReverbRoomSize,
        adjustReverbDecay,
        adjustReverbMix,
        adjustReverbPreDelay,
    } from '../../../effect/stores/reverb';
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

    $: kickContext = {
        pitch: $kickSettings.pitch,
        pitchDecay: $kickSettings.pitchDecay,
        tone: $kickSettings.tone,
        decay: $kickSettings.decay,
    };

    $: hihatContext = {
        tone: $hihatSettings.tone,
        decay: $hihatSettings.decay,
        resonance: $hihatSettings.resonance,
    };

    $: snareContext = {
        tone: $snareSettings.tone,
        snap: $snareSettings.snap,
        decay: $snareSettings.decay,
    };

    $: congaContext = {
        pitch: $congaSettings.pitch,
        pitchDecay: $congaSettings.pitchDecay,
        tone: $congaSettings.tone,
        decay: $congaSettings.decay,
    };

    $: clapContext = {
        tone: $clapSettings.tone,
        decay: $clapSettings.decay,
        spread: $clapSettings.spread,
    };

    $: laneContext = {
        total: $laneCount,
        laneIndex: $laneSelectedIndex,
        laneData: $currentLane,
    } satisfies {
        total: number;
        laneIndex: number;
        laneData: Lane | undefined;
    };

    $: euclideanContext = {
        steps: $euclideanSteps,
        pulses: $euclideanPulses,
        rotation: $euclideanRotation,
        clockValue: $euclideanClockLabel,
        orderValue: $euclideanOrderLabel,
    };

    $: m185Context = {
        entryIndex: $selectedEntry,
        entryData: $activeEntry,
        lengthValue: $m185Length,
        clockValue: $m185ClockLabel,
        orderValue: $m185OrderLabel,
        modeValue: $modeLabel,
    };

    $: stochasticContext = {
        minNote: $stochasticMinNote,
        maxNote: $stochasticMaxNote,
        changeProb: $stochasticChangeProb,
        currentNote: $stochasticCurrentNote,
    };

    $: delayContext = {
        time: $delayTime,
        feedback: $delayFeedback,
        mix: $delayMix,
        timeLabel: $delayTimeLabel,
        feedbackLabel: $delayFeedbackLabel,
        mixLabel: $delayMixLabel,
    };

    $: reverbContext = {
        roomSize: $reverbRoomSize,
        decay: $reverbDecay,
        mix: $reverbMix,
        preDelay: $reverbPreDelay,
        roomLabel: $reverbRoomLabel,
        decayLabel: $reverbDecayLabel,
        mixLabel: $reverbMixLabel,
        preDelayLabel: $reverbPreDelayLabel,
    };

    $: entries = inputs.map((meta, index) => ({
        meta,
        display: formatDisplay(kind, slideIndex, index, {
            xox: xoxContext,
            melody: melodyContext,
            synth: synthContext,
            lane: laneContext,
            euclidean: euclideanContext,
            m185: m185Context,
            stochastic: stochasticContext,
            delay: delayContext,
            reverb: reverbContext,
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
            euclidean: any;
            m185: any;
            stochastic: any;
            delay: any;
            reverb: any;
        }
    ): string {
        const { xox, melody, synth, lane, euclidean, m185, stochastic, delay, reverb } = context;

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

        if (kind === 'euclidean') {
            if (pageIndex === 0) {
                switch (inputIndex) {
                    case 0:
                        return `${euclidean.steps} steps`;
                    case 1:
                        return `${euclidean.pulses} pulses`;
                    case 2:
                        return `${euclidean.rotation} offset`;
                    default:
                        return '—';
                }
            }

            switch (inputIndex) {
                case 0:
                    return euclidean.clockValue;
                case 1:
                    return euclidean.orderValue;
                default:
                    return '—';
            }
        }

        if (kind === 'm185') {
            if (pageIndex === 0) {
                switch (inputIndex) {
                    case 0:
                        return String(m185.entryIndex + 1).padStart(2, '0');
                    case 1:
                        return `${m185.entryData?.steps ?? 1} steps`;
                    case 2:
                        return (m185.modeValue ?? 'repeat').charAt(0).toUpperCase() + (m185.modeValue ?? 'repeat').slice(1);
                    default:
                        return '—';
                }
            }

            switch (inputIndex) {
                case 0:
                    return `${m185.lengthValue} entries`;
                case 1:
                    return m185.clockValue;
                case 2:
                    return m185.orderValue;
                default:
                    return '—';
            }
        }

        if (kind === 'stochastic') {
            if (pageIndex === 0) {
                switch (inputIndex) {
                    case 0:
                        return `${stochastic.minNote}`;
                    case 1:
                        return `${stochastic.maxNote}`;
                    case 2:
                        return `${stochastic.changeProb}%`;
                    case 3:
                        return `${stochastic.currentNote}`;
                    default:
                        return '—';
                }
            }

            return '—';
        }

        if (kind === 'delay') {
            if (pageIndex === 0) {
                switch (inputIndex) {
                    case 0:
                        return delay.timeLabel;
                    case 1:
                        return delay.feedbackLabel;
                    case 2:
                        return delay.mixLabel;
                    default:
                        return '—';
                }
            }

            return '—';
        }

        if (kind === 'reverb') {
            if (pageIndex === 0) {
                switch (inputIndex) {
                    case 0:
                        return reverb.roomLabel;
                    case 1:
                        return reverb.decayLabel;
                    case 2:
                        return reverb.mixLabel;
                    case 3:
                        return reverb.preDelayLabel;
                    default:
                        return '—';
                }
            }

            return '—';
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

    type InputType = 'numeric' | 'selector' | 'toggle' | 'cyclic';

    function getInputType(kind: InputKind, slideIndex: number, inputIndex: number): InputType {
        // XOX slide 0
        if (kind === 'xox' && slideIndex === 0) {
            if (inputIndex === 0) return 'selector'; // Step index
            if (inputIndex === 1) return 'toggle';   // Active
            if (inputIndex === 2) return 'numeric';  // Duration
            if (inputIndex === 3) return 'numeric';  // Probability
        }

        // XOX slide 1
        if (kind === 'xox' && slideIndex === 1) {
            if (inputIndex === 0) return 'numeric';  // Length
            if (inputIndex === 1) return 'cyclic';   // Clock
            if (inputIndex === 2) return 'cyclic';   // Order
        }

        // Melody slide 0
        if (kind === 'melody' && slideIndex === 0) {
            if (inputIndex === 0) return 'selector'; // Bar index
            if (inputIndex === 1) return 'numeric';  // Value
            if (inputIndex === 2) return 'toggle';   // Glide
            if (inputIndex === 3) return 'toggle';   // Randomize
        }

        // Melody slide 1
        if (kind === 'melody' && slideIndex === 1) {
            if (inputIndex === 0) return 'numeric';  // Length
            if (inputIndex === 1) return 'cyclic';   // Skip
            if (inputIndex === 2) return 'cyclic';   // Order
        }

        // Synth slide 0
        if (kind === 'synth' && slideIndex === 0) {
            if (inputIndex === 0) return 'cyclic';   // Wave
            if (inputIndex === 1) return 'numeric';  // Harmonicity
            if (inputIndex === 2) return 'cyclic';   // Modulation
            if (inputIndex === 3) return 'numeric';  // Portamento
        }

        // Synth slide 1
        if (kind === 'synth' && slideIndex === 1) {
            return 'numeric'; // All ADSR values
        }

        // Euclidean slide 0
        if (kind === 'euclidean' && slideIndex === 0) {
            return 'numeric'; // Steps, Pulses, Rotation
        }

        // Euclidean slide 1
        if (kind === 'euclidean' && slideIndex === 1) {
            if (inputIndex === 0) return 'cyclic';   // Clock
            if (inputIndex === 1) return 'cyclic';   // Order
        }

        // M185 slide 0
        if (kind === 'm185' && slideIndex === 0) {
            if (inputIndex === 0) return 'selector'; // Entry index
            if (inputIndex === 1) return 'numeric';  // Steps
            if (inputIndex === 2) return 'cyclic';   // Mode
        }

        // M185 slide 1
        if (kind === 'm185' && slideIndex === 1) {
            if (inputIndex === 0) return 'numeric';  // Length
            if (inputIndex === 1) return 'cyclic';   // Clock
            if (inputIndex === 2) return 'cyclic';   // Order
        }

        // Stochastic slide 0
        if (kind === 'stochastic' && slideIndex === 0) {
            if (inputIndex === 0) return 'numeric';  // Min note
            if (inputIndex === 1) return 'numeric';  // Max note
            if (inputIndex === 2) return 'numeric';  // Change prob
            if (inputIndex === 3) return 'numeric';  // Current note (read-only but numeric)
        }

        // Delay slide 0
        if (kind === 'delay' && slideIndex === 0) {
            return 'numeric'; // Time, Feedback, Mix
        }

        // Reverb slide 0
        if (kind === 'reverb' && slideIndex === 0) {
            return 'numeric'; // Room, Decay, Mix, PreDelay
        }

        // Lane slide 0
        if (kind === 'lane' && slideIndex === 0) {
            if (inputIndex === 0) return 'selector'; // Lane index
            if (inputIndex === 1) return 'cyclic';   // Mode
            if (inputIndex === 2) return 'numeric';  // Volume
            if (inputIndex === 3) return 'numeric';  // Pan
        }

        // Lane slide 1
        if (kind === 'lane' && slideIndex === 1) {
            if (inputIndex === 0) return 'numeric';  // Lane count
        }

        // Drum instruments (kick, hihat, snare, conga, clap) - all numeric
        if (['kick', 'hihat', 'snare', 'conga', 'clap'].includes(kind)) {
            return 'numeric';
        }

        return 'numeric'; // Default
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
            case 'increment-input':
                if (typeof detail.inputIndex === 'number') {
                    selectedInput = detail.inputIndex < inputs.length ? detail.inputIndex : null;
                    if (selectedInput !== null) {
                        adjustSelected(1, 1); // direction=1 (increment), magnitude=1
                    }
                }
                break;
            case 'adjust-input-up':
            case 'adjust-input-down':
                if (selectedInput === null) return;
                if (typeof detail.inputIndex === 'number') {
                    selectedInput = detail.inputIndex;
                }
                const magnitude = detail.magnitude ?? 1;
                adjustSelected(detail.type === 'adjust-input-up' ? 1 : -1, magnitude);
                break;
        }
    }

    function adjustSelected(direction: 1 | -1, magnitude: number = 1) {
        if (selectedInput === null) return;

        // Determine input type and adjust magnitude accordingly
        const inputType = getInputType(kind, slideIndex, selectedInput);
        let finalMagnitude = magnitude;

        // Override magnitude for special cases
        if (inputType === 'toggle' || inputType === 'cyclic') {
            finalMagnitude = 1; // Toggles and cyclic options ignore magnitude
        }

        if (kind === 'lane') {
            if (slideIndex === 0) {
                switch (selectedInput) {
                    case 0:
                        incrementSelectedLane(direction * finalMagnitude);
                        break;
                    case 1:
                        cycleLaneMode(direction);
                        break;
                    case 2:
                        adjustLaneVolume(direction * finalMagnitude);
                        break;
                    case 3:
                        adjustLanePan(direction * finalMagnitude);
                        break;
                }
                return;
            }

            if (slideIndex === 1 && selectedInput === 0) {
                adjustLaneCount(direction * finalMagnitude);
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
                        adjustHarmonicity(direction * finalMagnitude);
                        break;
                    case 2:
                        cycleModulation(direction);
                        break;
                    case 3:
                        adjustPortamento(direction * finalMagnitude);
                        break;
                }
                return;
            }

            switch (selectedInput) {
                case 0:
                    adjustAttack(direction * finalMagnitude);
                    break;
                case 1:
                    adjustDecay(direction * finalMagnitude);
                    break;
                case 2:
                    adjustSustain(direction * finalMagnitude);
                    break;
                case 3:
                    adjustRelease(direction * finalMagnitude);
                    break;
            }
            return;
        }

        if (kind === 'melody') {
            if (slideIndex === 0) {
                switch (selectedInput) {
                    case 0:
                        incrementSelectedBar(direction * finalMagnitude);
                        break;
                    case 1:
                        adjustBarValue(direction * finalMagnitude);
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
                    adjustMelodyLength(direction * finalMagnitude);
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

        if (kind === 'euclidean') {
            if (slideIndex === 0) {
                switch (selectedInput) {
                    case 0:
                        adjustEuclideanSteps(direction * finalMagnitude);
                        break;
                    case 1:
                        adjustEuclideanPulses(direction * finalMagnitude);
                        break;
                    case 2:
                        adjustEuclideanRotation(direction * finalMagnitude);
                        break;
                }
                return;
            }

            switch (selectedInput) {
                case 0:
                    cycleEuclideanClock(direction);
                    break;
                case 1:
                    cycleEuclideanOrder(direction);
                    break;
            }
            return;
        }

        if (kind === 'm185') {
            if (slideIndex === 0) {
                switch (selectedInput) {
                    case 0:
                        incrementSelectedEntry(direction * finalMagnitude);
                        break;
                    case 1:
                        adjustEntrySteps(direction * finalMagnitude);
                        break;
                    case 2:
                        cycleEntryMode(direction);
                        break;
                }
                return;
            }

            switch (selectedInput) {
                case 0:
                    adjustM185Length(direction * finalMagnitude);
                    break;
                case 1:
                    cycleM185Clock(direction);
                    break;
                case 2:
                    cycleM185Order(direction);
                    break;
            }
            return;
        }

        if (kind === 'stochastic') {
            if (slideIndex === 0) {
                switch (selectedInput) {
                    case 0:
                        adjustStochasticMin(direction * finalMagnitude);
                        break;
                    case 1:
                        adjustStochasticMax(direction * finalMagnitude);
                        break;
                    case 2:
                        adjustStochasticChangeProb(direction * finalMagnitude);
                        break;
                }
                return;
            }

            return;
        }

        if (kind === 'delay') {
            if (slideIndex === 0) {
                switch (selectedInput) {
                    case 0:
                        adjustDelayTime(direction * finalMagnitude);
                        break;
                    case 1:
                        adjustDelayFeedback(direction * finalMagnitude);
                        break;
                    case 2:
                        adjustDelayMix(direction * finalMagnitude);
                        break;
                }
                return;
            }

            return;
        }

        if (kind === 'reverb') {
            if (slideIndex === 0) {
                switch (selectedInput) {
                    case 0:
                        adjustReverbRoomSize(direction * finalMagnitude);
                        break;
                    case 1:
                        adjustReverbDecay(direction * finalMagnitude);
                        break;
                    case 2:
                        adjustReverbMix(direction * finalMagnitude);
                        break;
                    case 3:
                        adjustReverbPreDelay(direction * finalMagnitude);
                        break;
                }
                return;
            }

            return;
        }

        if (slideIndex === 0) {
            switch (selectedInput) {
                case 0:
                    incrementSelectedStep(direction * finalMagnitude);
                    break;
                case 1:
                    setStepActive(direction > 0);
                    break;
                case 2:
                    adjustStepDuration(direction * finalMagnitude);
                    break;
                case 3:
                    adjustStepProbability(direction * finalMagnitude);
                    break;
            }
            return;
        }

        switch (selectedInput) {
            case 0:
                adjustPatternLength(direction * finalMagnitude);
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