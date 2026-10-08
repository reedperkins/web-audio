<script setup lang="ts">
import { computed, reactive, ref, toRaw, watch } from 'vue'
import { ctx, unlock } from '../audio/audio'
import type { Chaos, ChaosStats, FilterEnvelope, KnobName, KeysMode, PadMode } from '../audio/chaos'
import {
  CLEAR_PAD,
  createChaos,
  densityOf,
  knobsFor,
  PAD_CHANNEL,
  PADS,
  sizeOf,
  START,
  START_ENVELOPE,
  START_FILTER_ENVELOPE,
  MAX_FILTER_AMOUNT,
  TRACK_PADS,
} from '../audio/chaos'
import type { Envelope } from '../audio/envelope'
import { onControl, onNote, pressKey, releaseKey } from '../audio/input'
import { addRecording, load, sample, samples } from '../audio/samples'
import type { Tape } from '../audio/tape'
import { createTape, MAX_VOLUME, newTracks } from '../audio/tape'
import { useDemo } from '../audio/useDemo'

// The "Chaos" slide. Keys play the swarm, pads mangle a recording, knobs K1–K8
// and the joystick bend it all (see audio/chaos.ts for the mapping). An
// MpkMini drawing mirrors the controller, and every knob, pad and key on it
// also works with the mouse. Holding the record pad records a take, which
// becomes the mangler's source (and the deck's latest recording), drawn next
// to the scope. With no recording yet it mangles "One small step".
//
// Under it, a four-track looper (audio/tape.ts) prints what the slide plays
// and loops it back. Tracks answer to the pads' other bank, keys 1–4 and the
// mouse: a press prints, ends a take, mutes or unmutes; a hold clears.

const knobs = reactive({ ...START })
// The keys' envelope; every new note reads it.
const envelope = reactive<Envelope>({ ...START_ENVELOPE })
// Each key's filter envelope and how far it opens: mouse only, as K1–K8 are
// all taken.
const filterEnvelope = reactive<FilterEnvelope>({ ...START_FILTER_ENVELOPE })
const filterEnvModel = computed({
  get: () => ({ ...filterEnvelope }),
  set: (value: Envelope) => Object.assign(filterEnvelope, value),
})
const octaves = (cents: number) => `${(cents / 1200).toFixed(1)} oct`
const envModel = computed({
  get: () => ({ ...envelope }),
  set: (value: Envelope) => Object.assign(envelope, value),
})
// Copied from the engine's counters a few times a second.
const stats = reactive<ChaosStats>({ oscillators: 0, grains: 0 })
let poll: ReturnType<typeof setInterval> | undefined
// Pads and keys that are down, and where the joystick is.
const down = reactive(new Set<number>())
const keys = reactive(new Set<number>())
const joystick = reactive({ x: 0, y: 0 })
const recording = ref(false)
const active = ref(false)
// What the keys play: the oscillator swarm or grains of the take. The
// "keys" pad flips it; it stays as it was when the slide is left.
const keysMode = ref<KeysMode>('osc')

// What K1–K8 do right now: K6 and K7 are the swarm's filter in osc mode, and
// grain and scatter in voice mode (see audio/chaos.ts).
const layout = computed(() => knobsFor(keysMode.value))

// Pickup. The MPK's knobs are absolute, so after a mode switch K6 and K7 sit
// wherever they were left. Their new settings wait until the physical knob
// comes within PICKUP of the current value, or crosses it; then it takes over
// and nothing jumps.
const PICKUP = 0.03
const waiting = new Set<KnobName>()
const lastTurn = new Map<number, number>()
watch(keysMode, (mode, was) => {
  const before = knobsFor(was)
  for (const k of knobsFor(mode)) if (before.find((b) => b.cc === k.cc)?.name !== k.name) waiting.add(k.name)
})

function turn(name: KnobName, cc: number, value: number) {
  const last = lastTurn.get(cc)
  lastTurn.set(cc, value)
  if (waiting.has(name)) {
    const current = knobs[name]
    const crossed = last !== undefined && (last - current) * (value - current) <= 0
    if (!crossed && Math.abs(value - current) > PICKUP) return
    waiting.delete(name)
  }
  knobs[name] = value
}

let chaos: Chaos | null = null
let stops: (() => void)[] = []

// The chaos engine plays into `live`, which the tape prints. The loops come
// back in after it, and a last limiter keeps four loops plus the keys in
// bounds. The scope watches the lot.
// PLACEHOLDER(refine): the last limiter's settings
const live = new GainNode(ctx)
const bus = new DynamicsCompressorNode(ctx, { threshold: -6, knee: 0, ratio: 20, attack: 0.002, release: 0.15 })
const analyser = new AnalyserNode(ctx, { fftSize: 2048 })
live.connect(bus).connect(analyser)

const { out } = useDemo({
  enter() {
    active.value = true
    bus.connect(out.value)
    // The engine reads these on every note and grain, outside any effect, so
    // it gets the plain objects. The proxies above still write to them.
    chaos = createChaos(live, toRaw(knobs), toRaw(envelope), toRaw(filterEnvelope))
    chaos.setKeys(keysMode.value)
    const engine = chaos.stats
    poll = setInterval(() => Object.assign(stats, engine), 100)
    useSource()
    openMic()
    note.value = ''
    stops = [
      onNote({
        noteOn(note, velocity, channel) {
          if (channel === PAD_CHANNEL && trackPad(note, true)) return
          if (channel === PAD_CHANNEL) return padOn(note, velocity)
          keys.add(note)
          chaos?.noteOn(note, velocity)
        },
        noteOff(note, channel) {
          if (channel === PAD_CHANNEL && trackPad(note, false)) return
          if (channel === PAD_CHANNEL) return padOff(note)
          keys.delete(note)
          chaos?.noteOff(note)
        },
      }),
      onControl({
        control(cc, value) {
          const knob = layout.value.find((k) => k.cc === cc)
          if (knob) turn(knob.name, cc, value / 127)
          // The joystick's up sends CC 1 too, the same as K1.
          if (cc === 1) joystick.y = value / 127
        },
        bend(amount) {
          joystick.x = amount
          chaos?.bend(amount)
        },
      }),
    ]
    startTape()
  },
  leave() {
    active.value = false
    stopTape()
    const old = out.value
    setTimeout(() => bus.disconnect(old), 300)
    stops.forEach((stop) => stop())
    stops = []
    stopRecording(false)
    micOff()
    down.clear()
    keys.clear()
    Object.assign(joystick, { x: 0, y: 0 })
    chaos?.stop()
    chaos = null
    clearInterval(poll)
    Object.assign(stats, { oscillators: 0, grains: 0 })
  },
})
watch(knobs, () => chaos?.update())

// The newest recording, or the clip.
const source = computed(() => samples.find((s) => s.id.startsWith('recording-')) ?? sample('small-step'))
async function useSource() {
  const buffer = await load(source.value)
  chaos?.useBuffer(buffer)
}
watch(source, useSource)

const modeOf = (note: number) => PADS.find((p) => p.note === note)?.mode

// Hold: a pad sounds while it's down. Latch: a tap starts it, the next tap
// stops it, so pads can stack while both hands are on the keys. The keys
// toggle and record always work as hold.
const latch = ref(false)
const latches = (mode: PadMode) => latch.value && mode !== 'keys' && mode !== 'record'

function padOn(note: number, velocity: number) {
  const mode = modeOf(note)
  if (!mode || !chaos) return
  if (latches(mode) && down.has(note)) {
    down.delete(note)
    chaos.padOff(note)
    return
  }
  down.add(note)
  if (mode === 'record') record()
  else if (mode === 'keys') chaos.setKeys((keysMode.value = keysMode.value === 'osc' ? 'voice' : 'osc'))
  else chaos.padOn(note, velocity, mode)
}
function padOff(note: number) {
  const mode = modeOf(note)
  if (mode && latches(mode)) return
  if (!down.delete(note)) return
  if (mode === 'record') stopRecording(true)
  else if (mode !== 'keys') chaos?.padOff(note)
}

// Mouse fallbacks. A click is a user gesture, so it unlocks audio. Keys go
// through the input like any key, so they land in the listener above.
function clickPad(note: number) {
  unlock()
  padOn(note, 110)
}
// The mouse sets a knob outright; the physical knob still picks up later.
const setKnob = (i: number, value: number) => (knobs[layout.value[i].name] = value)

// Back to hold stops whatever is latched.
function toggleLatch() {
  if (latch.value)
    for (const note of [...down]) {
      const mode = modeOf(note)
      if (mode && latches(mode)) {
        down.delete(note)
        chaos?.padOff(note)
      }
    }
  latch.value = !latch.value
}

const knobList = computed(() =>
  layout.value.map((k) => ({ label: k.label, value: knobs[k.name], accent: k.name === 'resolve' })),
)
const padList = computed(() =>
  PADS.map((p) => ({
    note: p.note,
    label:
      recording.value && p.mode === 'record'
        ? `● rec ${held.value.toFixed(1)} s`
        : p.mode === 'keys'
          ? `keys: ${keysMode.value}`
          : LABELS[p.mode],
    dashed: p.mode === 'record' || p.mode === 'keys',
  })),
)

// ── Hold-to-record ──
// The mic opens on slide enter (Chrome asked for it back on "The mic"), so a
// take starts the moment the pad goes down. The pad counts the seconds; a
// take shorter than MIN_TAKE is thrown away, so a stray tap keeps the source.

const MIN_TAKE = 0.2
// PLACEHOLDER(refine): a take quieter than this is room tone, not a shout.
// Louder takes are scaled so their peak hits LOUDEST, so a quiet room still
// mangles at full level.
const MIN_PEAK = 0.03
const LOUDEST = 0.9

function normalize(buffer: AudioBuffer) {
  let peak = 0
  for (let ch = 0; ch < buffer.numberOfChannels; ch++)
    for (const v of buffer.getChannelData(ch)) peak = Math.max(peak, Math.abs(v))
  if (peak >= MIN_PEAK)
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < data.length; i++) data[i] *= LOUDEST / peak
    }
  return peak
}
let stream: MediaStream | null = null
let opening: Promise<MediaStream | null> | null = null
let recorder: MediaRecorder | null = null
let take = { keep: false }
let startedAt = 0
let clock: ReturnType<typeof setInterval> | undefined
const held = ref(0)
// What happened to the last take, shown by the source.
const note = ref('')

function openMic() {
  opening ??= navigator.mediaDevices.getUserMedia({ audio: true }).then(
    (s) => {
      // Left the slide while Chrome was opening it.
      if (!active.value) return s.getTracks().forEach((t) => t.stop()), null
      return (stream = s)
    },
    () => ((note.value = 'no mic'), null),
  )
  return opening
}

async function record() {
  unlock()
  recording.value = true
  held.value = 0
  const mic = stream ?? (await openMic())
  // No mic, let go before it opened, or left the slide.
  if (!mic || !recording.value || !active.value) return (recording.value = false)
  const current = (take = { keep: true })
  recorder = new MediaRecorder(mic)
  recorder.ondataavailable = async (e) => {
    if (!current.keep) return
    try {
      const buffer = await ctx.decodeAudioData(await e.data.arrayBuffer())
      if (buffer.duration < MIN_TAKE) note.value = 'too short, kept the old one'
      else if (normalize(buffer) < MIN_PEAK) note.value = 'too quiet, kept the old one'
      else {
        addRecording(buffer)
        note.value = `new take · ${buffer.duration.toFixed(1)} s`
      }
    } catch {
      note.value = 'too short, kept the old one'
    }
  }
  recorder.start()
  startedAt = performance.now()
  clock = setInterval(() => (held.value = (performance.now() - startedAt) / 1000), 100)
}

function stopRecording(save: boolean) {
  recording.value = false
  clearInterval(clock)
  if (recorder?.state === 'recording') {
    take.keep = save
    recorder.stop()
  }
  recorder = null
}

function micOff() {
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  opening = null
}

// ── The looper ──
// Made on the first visit and kept, loops and all, for the next.

const tracks = reactive(newTracks())
let tape: Tape | null = null
let making: Promise<Tape> | null = null
// Each track's playhead (0–1) and a take's seconds so far, for the tiles.
const phases = reactive(tracks.map(() => null as number | null))
const takes = reactive(tracks.map(() => 0))
const loopLength = ref<number | null>(null)
let frame = 0

async function startTape() {
  making ??= createTape(tracks, bus).then((t) => (live.connect(t.input), t))
  const t = await making
  // Left the slide while the worklet loaded, or came back and started it.
  if (!active.value || tape) return
  tape = t
  tape.start()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  const draw = () => {
    tracks.forEach((_, i) => {
      phases[i] = t.phase(i)
      takes[i] = t.elapsed(i)
    })
    loopLength.value = t.loopLength()
    frame = requestAnimationFrame(draw)
  }
  draw()
}

function stopTape() {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  cancelAnimationFrame(frame)
  holds.forEach((h, i) => (clearTimeout(h), (holds[i] = undefined)))
  tape?.stop()
  tape = null
}

// A press acts at once, so takes start and end on time. Held this long, it
// clears the track instead.
// PLACEHOLDER(refine): hold time
const HOLD = 0.6
const holds: (ReturnType<typeof setTimeout> | undefined)[] = tracks.map(() => undefined)

function trackOn(i: number) {
  if (!tape || holds[i]) return
  unlock()
  tape.tap(i)
  holds[i] = setTimeout(() => tape?.clear(i), HOLD * 1000)
}
function trackOff(i: number) {
  clearTimeout(holds[i])
  holds[i] = undefined
}
function clearAll() {
  tracks.forEach((_, i) => tape?.clear(i))
}

// The other pad bank. Returns whether the note was one of its pads.
function trackPad(note: number, on: boolean) {
  const i = TRACK_PADS.indexOf(note)
  if (i >= 0) on ? trackOn(i) : trackOff(i)
  else if (note === CLEAR_PAD) on && clearAll()
  else return false
  return true
}

function trackKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return -1
  const i = Number(e.key) - 1
  return Number.isInteger(i) && i >= 0 && i < tracks.length ? i : -1
}
function onKeyDown(e: KeyboardEvent) {
  const i = trackKey(e)
  if (i < 0 || e.repeat) return
  e.preventDefault()
  trackOn(i)
}
function onKeyUp(e: KeyboardEvent) {
  const i = trackKey(e)
  if (i >= 0) trackOff(i)
}

// Each loop's level, by mouse: 100% is as printed.
const percent = (v: number) => `${Math.round(v * 100)}%`
function setVolume(i: number, volume: number) {
  if (tape) tape.setVolume(i, volume)
  else tracks[i].volume = volume
}

function trackLabel(i: number) {
  const { state } = tracks[i]
  if (state === 'empty') return 'print'
  if (state === 'armed') return 'waits for the loop'
  if (state === 'muted') return 'muted'
  if (state === 'playing') return `${Math.round((tracks[i].buffer?.duration ?? 0) / (loopLength.value || 1))}× loop`
  const length = loopLength.value
  if (!length) return `● rec ${takes[i].toFixed(1)} s`
  return `● rec · loop ${Math.floor(takes[i] / length) + 1}`
}
// How far through the current loop a take is, for its fill.
function trackFill(i: number) {
  const length = loopLength.value
  if (tracks[i].state !== 'recording' || !length) return 0
  return (takes[i] % length) / length
}

const LABELS: Record<PadMode, string> = {
  stutter: 'stutter',
  scramble: 'scramble',
  reverse: 'reverse',
  freeze: 'freeze',
  up: '+1 oct',
  keys: 'keys',
  choir: 'choir',
  record: 'hold to rec',
}

// The big number: what the keys are making right now.
const voice = computed(() => keysMode.value === 'voice')
const count = computed(() => (voice.value ? stats.grains : stats.oscillators).toLocaleString())
const perKey = computed(() => (voice.value ? `${densityOf(knobs.size)}/s` : sizeOf(knobs.size)))
</script>

<template>
  <div class="chaos">
    <div class="chaos-scope">
      <Scope :analyser="analyser" :active="active" />
      <span class="chaos-count">
        <b>{{ count }}</b> {{ voice ? 'grains' : 'oscillators' }} · {{ perKey }} per key
      </span>
    </div>
    <div class="chaos-env amp-env">
      <div class="chaos-env-head">
        <span class="chaos-env-name">volume envelope</span>
      </div>
      <AdsrEditor v-model="envModel" class="chaos-env-adsr" compact center />
    </div>
    <div class="chaos-env filter-env">
      <div class="chaos-env-head">
        <span class="chaos-env-name">filter envelope</span>
        <Slider
          v-model="filterEnvelope.amount"
          class="chaos-amount"
          :max="MAX_FILTER_AMOUNT"
          :step="100"
          :format="octaves"
        />
      </div>
      <AdsrEditor v-model="filterEnvModel" class="chaos-env-adsr" compact center />
    </div>
    <div class="chaos-take" :class="{ rec: recording }">
      <BufferView class="chaos-wave" :buffer="source.buffer" :version="source.version" />
      <span class="chaos-source">pads mangle: {{ source.name.toLowerCase() }}</span>
      <span v-if="note" class="chaos-note">{{ note }}</span>
    </div>
    <div class="chaos-tracks">
      <div class="chaos-loop">
        <span>looper</span>
        <span class="chaos-loop-length">{{ loopLength ? `${loopLength.toFixed(2)} s` : 'no loop' }}</span>
      </div>
      <div v-for="(track, i) in tracks" :key="i" class="chaos-lane">
        <div
          class="chaos-track"
          :class="track.state"
          @pointerdown="trackOn(i)"
          @pointerup="trackOff(i)"
          @pointerleave="trackOff(i)"
          @pointercancel="trackOff(i)"
        >
          <BufferView
            v-if="track.buffer"
            class="chaos-wave"
            :buffer="track.buffer"
            :position="phases[i] == null ? null : phases[i]! * track.buffer.duration"
          />
          <div v-else-if="track.state === 'recording'" class="chaos-fill" :style="{ width: `${trackFill(i) * 100}%` }" />
          <span class="chaos-track-number">{{ i + 1 }}</span>
          <span class="chaos-track-label">{{ trackLabel(i) }}</span>
        </div>
        <!-- The loop's volume, beside its tile; hidden but holding its space
             until there's a loop. -->
        <Fader
          class="chaos-volume"
          :class="{ hidden: !track.buffer }"
          :model-value="track.volume"
          :max="MAX_VOLUME"
          :mark="1"
          :format="percent"
          @update:model-value="(v: number) => setVolume(i, v)"
        />
      </div>
    </div>
    <MpkMini
      class="chaos-mpk"
      :knobs="knobList"
      :pads="padList"
      :pads-down="down"
      :keys-down="keys"
      :joystick="joystick"
      @knob="setKnob"
      @pad-press="clickPad"
      @pad-release="padOff"
      @press="pressKey"
      @release="releaseKey"
    >
      <ToggleChip class="chaos-latch" :on="latch" @click="toggleLatch">pads: {{ latch ? 'latch' : 'hold' }}</ToggleChip>
    </MpkMini>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): chaos slide look */
.chaos {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 13rem 13rem 12rem;
  grid-template-areas:
    'scope adsr fadsr take'
    'tracks tracks tracks tracks'
    'mpk mpk mpk mpk';
  gap: 0.6rem 1rem;
}

.chaos-scope {
  position: relative;
  grid-area: scope;
  height: 6rem;
  border-radius: 0.4rem;
  background: var(--surface);
}

/* The count, small, over the scope. */
.chaos-count {
  position: absolute;
  top: 0.3rem;
  left: 0.5rem;
  z-index: 1;
  padding: 0 0.3rem;
  border-radius: 0.3rem;
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.55rem;
  font-variant-numeric: tabular-nums;
}

.chaos-count b {
  color: var(--accent);
}

/* The two envelopes, each framed in its color, as on the filter slide. */
.chaos-env {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 6rem;
  padding: 0.25rem 0.4rem 0.15rem;
  border: 2px solid var(--env-color);
  border-radius: 0.4rem;
  background: var(--surface);
  --adsr-color: var(--env-color);
}

.amp-env {
  grid-area: adsr;
  --env-color: var(--accent);
}

.filter-env {
  grid-area: fadsr;
  --env-color: var(--filter);
}

/* The curve takes whatever height the label and slider leave; it keeps its
   shape and shrinks to fit. */
.chaos-env-adsr {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.chaos-env-name {
  color: var(--env-color);
  font-family: var(--font-body);
  font-size: 0.55rem;
  font-weight: 600;
  text-align: center;
}

/* Each envelope's header line: its name, and for the filter how far it
   opens. Both the same height, so the two curves match. */
.chaos-env-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  width: 100%;
  min-height: 1.4rem;
}

.chaos-amount {
  gap: 0.3em;
  font-size: 0.5rem;
  --slider-color: var(--filter);
  --slider-width: 3.5rem;
  --slider-value-width: 6ch;
}

/* The picture fills the tile; labels sit on top of it, all in one grid cell,
   sized by the tile (not by the canvas inside). */
.chaos-take,
.chaos-track {
  display: grid;
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
}

.chaos-take > *,
.chaos-track > * {
  grid-area: 1 / 1;
  z-index: 3;
}

.chaos-wave {
  z-index: auto;
  min-width: 0;
  height: 100%;
  background: none;
}

.chaos-take {
  grid-area: take;
  height: 6rem;
  border: 2px solid transparent;
  border-radius: 0.4rem;
  background: var(--surface);
}

.chaos-take.rec {
  border-color: var(--accent);
}

.chaos-note {
  place-self: end start;
  margin: 0.3rem 0.5rem;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 0.55rem;
}

.chaos-source {
  place-self: start;
  margin: 0.3rem 0.5rem;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.55rem;
}

.chaos-mpk {
  grid-area: mpk;
}

/* PLACEHOLDER(refine): looper look */
.chaos-tracks {
  grid-area: tracks;
  display: grid;
  /* minmax: a waveform's canvas mustn't size its column. */
  grid-template-columns: 4rem repeat(4, minmax(0, 1fr));
  min-width: 0;
  gap: 0.6rem;
  height: 2.6rem;
}

.chaos-loop {
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.6rem;
  line-height: 1.3;
}

.chaos-loop-length {
  color: var(--muted);
  font-size: 0.5rem;
}

/* A track: its tile, then its volume fader. */
.chaos-lane {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  min-width: 0;
  /* Pinned, or a waveform's canvas would grow the row. */
  height: 2.6rem;
}

.chaos-lane .chaos-track {
  flex: 1;
  min-width: 0;
  align-self: stretch;
}

.chaos-volume {
  align-self: stretch;
  width: 0.9rem;
}

.chaos-volume.hidden {
  visibility: hidden;
}

.chaos-track {
  overflow: hidden;
  border: 2px dashed var(--wire);
  border-radius: 0.4rem;
  background: var(--surface);
  cursor: pointer;
  user-select: none;
  touch-action: none;
}

.chaos-track.playing,
.chaos-track.muted {
  border-style: solid;
}

.chaos-track.armed {
  border-color: var(--accent);
  animation: chaos-blink 0.5s steps(1) infinite;
}

.chaos-track.recording {
  border-style: solid;
  border-color: var(--accent);
}

.chaos-track.muted .chaos-wave {
  opacity: 0.3;
}

@keyframes chaos-blink {
  50% {
    border-color: var(--wire);
  }
}

.chaos-track .chaos-wave {
  pointer-events: none;
}

.chaos-fill {
  z-index: auto;
  justify-self: start;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}

.chaos-track-number,
.chaos-track-label {
  padding: 0 0.2rem;
  border-radius: 0.2rem;
  background: var(--surface);
  font-family: var(--font-mono);
  pointer-events: none;
}

.chaos-track-number {
  place-self: start;
  margin: 0.2rem 0.4rem;
  color: var(--ink);
  font-size: 0.6rem;
  font-weight: 700;
}

.chaos-track-label {
  place-self: end;
  margin: 0.2rem 0.4rem;
  color: var(--muted);
  font-size: 0.5rem;
}

.chaos-track.recording .chaos-track-label,
.chaos-track.armed .chaos-track-label {
  color: var(--accent);
}

.chaos-latch {
  padding: 0.15em 0.5em;
  font-family: var(--font-mono);
  font-size: 0.5rem;
}

.chaos-latch:not(.on) {
  background: var(--bg);
}
</style>
