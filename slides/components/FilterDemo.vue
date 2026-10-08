<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useSlideContext } from '@slidev/client'
import { analyser, unlock } from '../audio/audio'
import type { Envelope } from '../audio/envelope'
import { env } from '../audio/envelope'
import {
  AMOUNT_MAX, CUTOFF_RANGE, RESONANCE_MAX, WAH_RATE, filter, filterEnv, responseDb, setWah, sweepAt, wah,
} from '../audio/filter'
import { pressKey, releaseKey } from '../audio/input'
import { mtof } from '../audio/mtof'
import { playInto, releaseAll, wave } from '../audio/synth'
import { useDemo, vNoFocus } from '../audio/useDemo'
import type { Harmonic } from './FilterResponse.vue'

// The "Carve it: filters" demo: the synth drawn as its graph, with a lowpass
// between the oscillator and the volume envelope. The filter node shows its
// response over the harmonics of the last note, and sliders for cutoff and
// resonance. From step `envAt`, the filter's own envelope appears inside it,
// in blue (its ADSR and how far it opens the cutoff); from step `wahAt`, an
// LFO node above it (on/off and a rate). Room for both is kept on every step,
// so nothing moves. Entering switches the synth to sawtooth so there's
// something to carve. MIDI, the on-screen keys and the hold button play it;
// letting go of an ADSR handle plays a note, or restarts the held one.
const props = withDefaults(defineProps<{ envAt?: number; wahAt?: number }>(), { envAt: 1, wahAt: 2 })

const SOURCE = 'Filter demo'
// A2: low, so plenty of harmonics sit under the cutoff.
const HOLD_NOTE = 45
const HOLD_VELOCITY = 90
const PREVIEW_HOLD = 0.6

const { ctx, out } = useDemo({ enter, leave })
const { $clicks } = useSlideContext()
const envStep = computed(() => $clicks.value >= props.envAt)
const wahStep = computed(() => $clicks.value >= props.wahAt)

const active = ref(false)
const holding = ref(false)
// The LFO starts off; its checkbox turns it on.
const wahEnabled = ref(false)

const nodes = [
  { key: 'osc', label: 'OscillatorNode', style: { width: '11rem' } },
  { key: 'filter', label: 'BiquadFilterNode', style: { flex: 1, minWidth: 0 } },
  { key: 'amp', label: 'GainNode', style: { width: '12rem' } },
  { key: 'out', label: 'destination', style: { width: '7.5rem' } },
]

const waveModel = computed({
  get: () => wave.value,
  set: (type: OscillatorType) => (wave.value = type),
})

const envModel = computed({
  get: () => ({ ...env }),
  set: (value: Envelope) => Object.assign(env, value),
})

const filterEnvModel = computed({
  get: () => ({ ...filterEnv }),
  set: (value: Envelope) => Object.assign(filterEnv, value),
})

// The cutoff slider moves in octaves, so each bit of travel sounds the same.
const octaves = Math.log2(CUTOFF_RANGE.max / CUTOFF_RANGE.min)
const cutoffPos = computed({
  get: () => Math.log2(filter.cutoff / CUTOFF_RANGE.min) / octaves,
  set: (pos: number) => (filter.cutoff = pos >= 1 ? CUTOFF_RANGE.max : CUTOFF_RANGE.min * 2 ** (pos * octaves)),
})
const hz = (pos: number) => {
  const f = CUTOFF_RANGE.min * 2 ** (pos * octaves)
  return f < 1000 ? `${Math.round(f)} Hz` : `${(f / 1000).toFixed(1)} kHz`
}
const dB = (v: number) => `${v.toFixed(0)} dB`
const cents = (v: number) => `${(v / 1200).toFixed(1)} oct`
const rate = (v: number) => `${v.toFixed(1)} Hz`

// What the picture draws, refreshed every frame while the slide is showing.
const POINTS = 160
const curveHz = Float32Array.from({ length: POINTS }, (_, i) => 20 * 1000 ** (i / (POINTS - 1)))
const curve = shallowRef({ hz: curveHz, db: new Float32Array(POINTS) })
const harmonics = shallowRef<Harmonic[]>([])
const cutoffNow = ref(filter.cutoff)

// Each wave's harmonics, as levels relative to the fundamental.
function levels(type: OscillatorType, count: number) {
  const out: [n: number, level: number][] = []
  for (let n = 1; n <= count; n++) {
    if (type === 'sine' && n > 1) break
    if ((type === 'square' || type === 'triangle') && n % 2 === 0) continue
    out.push([n, type === 'triangle' ? 1 / (n * n) : 1 / n])
  }
  return out
}

function update() {
  const { frequency, detune } = sweepAt(ctx.currentTime)
  const f0 = frequency ?? mtof(HOLD_NOTE)
  const parts = levels(wave.value, Math.floor(20000 / f0))
  const partHz = Float32Array.from(parts, ([n]) => n * f0)
  const partDb = responseDb(partHz, detune)
  harmonics.value = parts.map(([, level], i) => {
    const db = 20 * Math.log10(level)
    return { hz: partHz[i], db, out: db + partDb[i] }
  })
  curve.value = { hz: curveHz, db: responseDb(curveHz, detune) }
  cutoffNow.value = filter.cutoff * 2 ** (detune / 1200)
}

let raf = 0
function loop() {
  update()
  raf = requestAnimationFrame(loop)
}

// Drawn once at rest, and again on any change while the slide isn't playing.
onMounted(update)
watch([() => ({ ...filter }), wave], () => active.value || update())

function enter() {
  active.value = true
  wave.value = 'sawtooth'
  playInto(out.value)
  loop()
}

function leave() {
  active.value = false
  cancelAnimationFrame(raf)
  stopHold()
  releaseAll()
  playInto(null)
  update()
}

async function toggleHold() {
  if (holding.value) return stopHold()
  await unlock()
  if (!active.value) return
  holding.value = true
  pressKey(HOLD_NOTE, HOLD_VELOCITY, SOURCE)
}

// Picking a wave restarts a held note, so it plays the new wave and both
// envelopes run again.
function retrigger() {
  if (!holding.value) return
  releaseKey(HOLD_NOTE, SOURCE)
  pressKey(HOLD_NOTE, HOLD_VELOCITY, SOURCE)
}

// After an envelope edit: restart the held note, or play a short one.
let previewTimer: ReturnType<typeof setTimeout> | undefined
async function preview() {
  if (holding.value) return retrigger()
  await unlock()
  if (!active.value || holding.value) return
  clearTimeout(previewTimer)
  pressKey(HOLD_NOTE, HOLD_VELOCITY, SOURCE)
  previewTimer = setTimeout(() => holding.value || releaseKey(HOLD_NOTE, SOURCE), PREVIEW_HOLD * 1000)
}

function stopHold() {
  clearTimeout(previewTimer)
  if (!holding.value) return
  holding.value = false
  releaseKey(HOLD_NOTE, SOURCE)
}

const wahOn = computed(() => active.value && wahStep.value && wahEnabled.value)
watch(wahOn, setWah)
</script>

<template>
  <SignalChain class="filter-demo" :nodes="nodes">
    <template #osc>
      <WaveShapes v-model="waveModel" class="waves" @pick="retrigger" />
      <PlayButton class="hold" :playing="holding" @play="toggleHold">Hold A2</PlayButton>
    </template>
    <template v-if="wahStep" #filter-above>
      <div class="side">
        <label class="side-name">
          <input v-model="wahEnabled" v-no-focus type="checkbox">
          LFO
        </label>
        <Slider
          v-model="wah.rate"
          class="knob"
          label="frequency"
          :min="WAH_RATE.min"
          :max="WAH_RATE.max"
          :step="0.1"
          :format="rate"
        />
      </div>
    </template>
    <template #filter>
      <div class="response">
        <FilterResponse :curve="curve" :harmonics="harmonics" :cutoff="cutoffNow" />
        <code class="type">'lowpass'</code>
      </div>
      <div class="knobs">
        <Slider v-model="cutoffPos" class="knob" label="frequency" :step="0.001" :format="hz" />
        <Slider v-model="filter.resonance" class="knob" label="resonance" :max="RESONANCE_MAX" :step="0.5" :format="dB" />
      </div>
      <div class="env filter-env" :class="{ hidden: !envStep }">
        <div class="sub">filter envelope</div>
        <AdsrEditor v-model="filterEnvModel" class="adsr" compact @commit="preview" />
        <Slider
          v-model="filter.amount"
          class="knob"
          label="amount"
          :max="AMOUNT_MAX"
          :step="100"
          :format="cents"
        />
      </div>
    </template>
    <template #amp>
      <div class="env amp-env">
        <div class="sub">volume envelope</div>
        <AdsrEditor v-model="envModel" class="adsr" compact @commit="preview" />
      </div>
    </template>
    <template #out>
      <div class="sub">speakers</div>
      <Scope class="scope" :analyser="analyser" :active="active" />
    </template>
  </SignalChain>
</template>

<style scoped>
/* PLACEHOLDER(refine): filter demo layout */
.filter-demo {
  --node-padding: 0.45rem 0.7rem;
  /* Room for the LFO node above the filter, on every step. */
  margin-top: 4.4rem;
}

.waves {
  width: 100%;
  /* Narrower tiles, so 'sawtooth' fits two to a row inside the padding. */
  --shape-padding: 0.3rem 0.15rem 0.2rem;
}

.hold {
  font-size: 0.7rem;
}

.sub {
  margin-top: -0.3rem;
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 0.6rem;
}

.sub code {
  font-size: 1em;
}

.response {
  position: relative;
  width: 100%;
  height: 4.2rem;
  border-radius: 0.4rem;
  background: var(--bg);
  overflow: hidden;
}

.type {
  position: absolute;
  left: 0.4rem;
  bottom: 0.3rem;
  padding: 0 0.3em;
  border-radius: 0.2rem;
  background: var(--bg);
  color: var(--muted);
  font-size: 0.55rem;
}

.knobs {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin: -0.15rem 0 -0.2rem;
}

.knob {
  font-size: 0.62rem;
  --slider-width: 5rem;
  --slider-value-width: 8ch;
}

/* The LFO node: name and rate, stacked into a small box. */
.side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  white-space: nowrap;
}

.side .knob {
  --slider-width: 3.5rem;
  --slider-value-width: 6ch;
}

.side-name {
  /* Slidev's default theme styles bare labels; undo it. */
  border: 0;
  background: none;
  display: flex;
  align-items: center;
  gap: 0.4em;
  font-family: var(--font-mono);
  font-size: var(--size-small);
  font-weight: 600;
  color: var(--ink);
  cursor: pointer;
}

.side-name input {
  width: 1em;
  height: 1em;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

/* Each envelope framed in its own color: the volume's in the accent, the
   filter's in blue. The filter's is hidden (but holds its space) until its
   step. */
.env {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  width: 100%;
  padding: 0.4rem 0.5rem 0.3rem;
  border: 2px solid var(--env-color);
  border-radius: 0.5rem;
  --adsr-color: var(--env-color);
}

.env .sub {
  margin: 0;
  color: var(--env-color);
  font-weight: 600;
}

.amp-env {
  --env-color: var(--accent);
}

.filter-env {
  --env-color: var(--filter);
  margin-top: 0.2rem;
}

.filter-env.hidden {
  visibility: hidden;
}

.filter-env .knob {
  --slider-color: var(--filter);
}

.adsr {
  width: 100%;
}

.scope {
  width: 100%;
  height: 7rem;
  border-radius: 0.4rem;
  background: var(--bg);
}
</style>
