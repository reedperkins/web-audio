<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSlideContext } from '@slidev/client'
import { unlock } from '../audio/audio'
import { useDemo, vNoFocus } from '../audio/useDemo'

// Plays the "Turn it down" slide's code, and the slider runs the
// "AudioParams" slide's setVolume. With `hold`, the chord plays until the
// button is pressed again (time to move the slider) instead of for 2 s.
// From step `lfoAt` on, an LFO swings the gain while the chord plays.
const props = defineProps<{ hold?: boolean; lfoAt?: number }>()

const chord = [261.63, 329.63, 392, 523.25]
const level = ref(0.2)
const playing = ref(false)

let volume: GainNode | null = null
let oscs: OscillatorNode[] = []
let lfo: OscillatorNode | null = null
let depth: GainNode | null = null

// The checkbox on the LFO node turns it on and off.
const lfoEnabled = ref(true)

// The live gain while the LFO runs. A param's input can't be read from JS, so
// a small analyser taps the LFO's output after `depth`; the gain is the
// param's scheduled value plus that sample.
const gainNow = ref<number | null>(null)
let tap: AnalyserNode | null = null
let raf = 0

const { ctx, out } = useDemo({ leave: stop })
const { $clicks } = useSlideContext()
const lfoStep = computed(() => props.lfoAt !== undefined && $clicks.value >= props.lfoAt)

async function toggle() {
  if (playing.value) return stop()
  await unlock()
  volume = new GainNode(ctx, { gain: level.value })
  volume.connect(out.value)
  oscs = chord.map((frequency) => {
    const osc = new OscillatorNode(ctx, { frequency })
    osc.connect(volume!)
    osc.start()
    if (!props.hold) osc.stop(ctx.currentTime + 2)
    return osc
  })
  const mine = oscs
  oscs[0].onended = () => { if (oscs === mine) playing.value = false }
  playing.value = true
}

// Fade instead of cutting off, so stopping doesn't click.
function stop() {
  if (!playing.value) return
  const t = ctx.currentTime
  volume?.gain.setTargetAtTime(0, t, 0.01)
  oscs.forEach(osc => osc.stop(t + 0.1))
  if (lfo) stopLfo()
  playing.value = false
}

function setVolume(value: number) {
  const now = ctx.currentTime
  volume?.gain.setTargetAtTime(value, now, 0.05)
}

watch(level, setVolume)

// The LFO slide code, run as is.
function startLfo() {
  lfo = new OscillatorNode(ctx)
  lfo.frequency.value = 2
  depth = new GainNode(ctx, { gain: 0.05 })
  level.value = 0.15
  setVolume(0.15)
  lfo.connect(depth).connect(volume!.gain)
  lfo.start()
  startMeter()
}

function startMeter() {
  tap = new AnalyserNode(ctx, { fftSize: 32 })
  depth!.connect(tap)
  const buf = new Float32Array(tap.fftSize)
  const tick = () => {
    if (!tap || !volume) return
    tap.getFloatTimeDomainData(buf)
    gainNow.value = volume.gain.value + buf[buf.length - 1]
    raf = requestAnimationFrame(tick)
  }
  tick()
}

function stopMeter() {
  cancelAnimationFrame(raf)
  tap?.disconnect()
  tap = null
  gainNow.value = null
}

// Fade the swing out before stopping, so going back a step doesn't click.
function stopLfo() {
  const t = ctx.currentTime
  depth?.gain.setTargetAtTime(0, t, 0.02)
  lfo?.stop(t + 0.2)
  lfo = depth = null
  stopMeter()
}

// While the LFO runs, the slider shows the gain it's producing. Dragging still
// sets the value the LFO swings around.
const knob = computed({
  get: () => gainNow.value ?? level.value,
  set: (v: number) => { level.value = v },
})

const lfoOn = computed(() => playing.value && lfoStep.value && lfoEnabled.value)

watch(lfoOn, (on) => {
  if (on && !lfo) startLfo()
  else if (!on && lfo) stopLfo()
})
</script>

<template>
  <SignalChain class="volume-demo" :class="{ 'has-lfo': lfoAt !== undefined }" :nodes="[
    { key: 'osc', label: 'osc ×4' },
    { key: 'gain', label: 'GainNode' },
    { key: 'out', label: 'speakers' },
  ]">
    <template #osc>
      <PlayButton :playing="playing" @play="toggle" />
    </template>
    <template v-if="lfoStep" #gain-above>
      <label class="lfo-node">
        <input v-model="lfoEnabled" v-no-focus type="checkbox">
        <span class="lfo-label">LFO</span>
      </label>
    </template>
    <template #gain>
      <Slider v-model="knob" class="gain" label="gain" />
    </template>
  </SignalChain>
</template>

<style scoped>
.volume-demo .gain {
  gap: 0.4em;
  font-size: 0.8rem;
}

.volume-demo .lfo-node {
  /* Slidev's default theme styles bare labels; undo it. */
  border: 0;
  background: none;
  display: flex;
  align-items: center;
  gap: 0.5em;
  white-space: nowrap;
  cursor: pointer;
}

.volume-demo .lfo-node input {
  width: 1.1em;
  height: 1.1em;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

/* Room for the LFO node above the chain, kept on every step so nothing jumps. */
.volume-demo.has-lfo {
  padding-top: 4.5rem;
}

.volume-demo .lfo-label {
  font-family: var(--font-mono);
  font-size: var(--size-small);
  font-weight: 600;
  color: var(--ink);
}

.volume-demo .gain :deep(input) {
  width: 5rem;
}
</style>
