<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSlideContext } from '@slidev/client'
import { unlock } from '../audio/audio'
import { useDemo, vNoFocus } from '../audio/useDemo'

// Plays the "Turn it down" slide's code, and the slider runs the
// "AudioParams" slide's setVolume. With `hold`, the chord plays until the
// button is pressed again (time to move the slider) instead of for 2 s.
// With `jump`, the slider sets `gain.value` directly, as on the slide before
// it, so fast drags step instead of gliding. `maxGain` sets the slider's top.
// From step `lfoAt` on, an LFO swings the gain while the chord plays.
const props = withDefaults(defineProps<{ hold?: boolean; jump?: boolean; maxGain?: number; lfoAt?: number }>(), { maxGain: 1 })

const chord = [261.63, 329.63, 392, 523.25]
const level = ref(0.2)
const playing = ref(false)

let volume: GainNode | null = null
let oscs: OscillatorNode[] = []
let lfo: OscillatorNode | null = null
let lfoDepth: GainNode | null = null

// The checkbox on the LFO node turns it on and off.
const lfoEnabled = ref(true)

// The LFO's live value and the same value after `lfoDepth`. A param's input
// can't be read from JS, so two small analysers tap the LFO before and after
// `lfoDepth` and the readouts show their latest samples.
const lfoValue = ref(0)
const scaled = ref(0)
const DEPTH = 0.05
let rawTap: AnalyserNode | null = null
let tap: AnalyserNode | null = null
let raf = 0

const buf = new Float32Array(32)
function latest(analyser: AnalyserNode) {
  analyser.getFloatTimeDomainData(buf)
  return buf[buf.length - 1]
}

// −0.04 with a real minus sign, and no "−0.00".
function signed(v: number) {
  const r = Math.round(v * 100) / 100
  return (r < 0 ? '−' : '') + Math.abs(r).toFixed(2)
}

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
  if (!volume) return
  if (props.jump) {
    volume.gain.value = value
    return
  }
  const now = ctx.currentTime
  volume.gain.setTargetAtTime(value, now, 0.05)
}

watch(level, setVolume)

// The LFO slide code, run as is.
function startLfo() {
  lfo = new OscillatorNode(ctx)
  lfo.frequency.value = 2
  lfoDepth = new GainNode(ctx, { gain: DEPTH })
  level.value = 0.15
  setVolume(0.15)
  lfo.connect(lfoDepth).connect(volume!.gain)
  lfo.start()
  startMeter()
}

function startMeter() {
  rawTap = new AnalyserNode(ctx, { fftSize: buf.length })
  tap = new AnalyserNode(ctx, { fftSize: buf.length })
  lfo!.connect(rawTap)
  lfoDepth!.connect(tap)
  const tick = () => {
    if (!tap || !rawTap) return
    lfoValue.value = latest(rawTap)
    scaled.value = latest(tap)
    raf = requestAnimationFrame(tick)
  }
  tick()
}

function stopMeter() {
  cancelAnimationFrame(raf)
  tap?.disconnect()
  rawTap?.disconnect()
  tap = rawTap = null
  lfoValue.value = scaled.value = 0
}

// Fade the swing out before stopping, so going back a step doesn't click.
function stopLfo() {
  const t = ctx.currentTime
  lfoDepth?.gain.setTargetAtTime(0, t, 0.02)
  lfo?.stop(t + 0.2)
  lfo = lfoDepth = null
  stopMeter()
}


const lfoOn = computed(() => playing.value && lfoStep.value && lfoEnabled.value)

watch(lfoOn, (on) => {
  if (on && !lfo) startLfo()
  else if (!on && lfo) stopLfo()
})
</script>

<template>
  <SignalChain class="volume-demo" :class="{ 'has-lfo': lfoAt !== undefined }" :nodes="[
    { key: 'osc', label: 'osc ×4' },
    { key: 'gain', label: 'GainNode', sourceWire: '×' },
    { key: 'out', label: 'speakers' },
  ]">
    <template #osc>
      <PlayButton :playing="playing" @play="toggle" />
    </template>
    <template v-if="lfoStep" #gain-above-source>
      <label class="lfo-toggle">
        <input v-model="lfoEnabled" v-no-focus type="checkbox">
        <span class="lfo-label">LFO</span>
      </label>
      <Slider :model-value="lfoValue" class="lfo-value" readonly :min="-1" :max="1" :format="signed" />
    </template>
    <template v-if="lfoStep" #gain-above>
      <span class="lfo-label">lfoDepth</span>
      <output class="lfo-out">{{ DEPTH.toFixed(2) }}</output>
    </template>
    <template #gain>
      <!-- With the LFO, the gain is a sum: its value plus the LFO after lfoDepth. -->
      <output v-if="lfoStep" class="lfo-sum">
        <span class="lfo-sum-label">gain</span>
        {{ level.toFixed(2) }} {{ scaled < 0 ? '−' : '+' }} {{ signed(Math.abs(scaled)) }} = {{ signed(level + scaled) }}
      </output>
      <Slider v-else v-model="level" class="gain" label="gain" :max="maxGain" />
    </template>
  </SignalChain>
</template>

<style scoped>
.volume-demo .gain {
  gap: 0.4em;
  font-size: 0.8rem;
  --slider-width: 5rem;
}

.volume-demo .lfo-toggle {
  /* Slidev's default theme styles bare labels; undo it. */
  border: 0;
  background: none;
  display: flex;
  align-items: center;
  gap: 0.5em;
  cursor: pointer;
}

.volume-demo .lfo-toggle input {
  width: 1.1em;
  height: 1.1em;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.volume-demo .lfo-value {
  gap: 0.4em;
  font-size: 0.8rem;
  --slider-width: 3rem;
  --slider-value-width: 5ch;
}

.volume-demo .lfo-out,
.volume-demo .lfo-sum {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--ink);
  white-space: nowrap;
}

.volume-demo .lfo-out {
  min-width: 5ch;
}

/* Room for the sum so the chain doesn't jump as the digits change. */
.volume-demo .lfo-sum {
  min-width: 22ch;
}

.volume-demo .lfo-sum-label {
  color: var(--muted);
  margin-right: 0.4em;
}

/* Room for the LFO node above the chain, kept on every step so nothing jumps. */
.volume-demo.has-lfo {
  padding-top: 6rem;
}

.volume-demo .lfo-label {
  font-family: var(--font-mono);
  font-size: var(--size-small);
  font-weight: 600;
  color: var(--ink);
}
</style>
