<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ctx, unlock } from '../audio/audio'
import type { Chaos, ChaosStats, KeysMode, PadMode } from '../audio/chaos'
import { createChaos, densityOf, KNOBS, PAD_CHANNEL, PADS, sizeOf, START, START_ENVELOPE } from '../audio/chaos'
import type { Envelope } from '../audio/envelope'
import { onControl, onNote, pressKey, releaseKey } from '../audio/input'
import { addRecording, load, sample, samples } from '../audio/samples'
import { useDemo, vNoFocus } from '../audio/useDemo'

// The "Chaos" slide. Keys play the swarm, pads mangle a recording, knobs K1–K8
// and the joystick bend it all (see audio/chaos.ts for the mapping). An
// MpkMini drawing mirrors the controller, and every knob, pad and key on it
// also works with the mouse. Holding the record pad records a take, which
// becomes the mangler's source (and the deck's latest recording), drawn next
// to the scope. With no recording yet it mangles "One small step".

const knobs = reactive({ ...START })
// The keys' envelope; every new note reads it.
const envelope = reactive<Envelope>({ ...START_ENVELOPE })
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
const live = ref(false)
// What the keys play: the oscillator swarm or grains of the take. The
// "keys" pad flips it; it stays as it was when the slide is left.
const keysMode = ref<KeysMode>('osc')

let chaos: Chaos | null = null
let stops: (() => void)[] = []

// The scope's tap, after the limiter.
const analyser = new AnalyserNode(ctx, { fftSize: 2048 })

const { out } = useDemo({
  enter() {
    live.value = true
    chaos = createChaos(out.value, knobs, envelope, analyser)
    chaos.setKeys(keysMode.value)
    const engine = chaos.stats
    poll = setInterval(() => Object.assign(stats, engine), 100)
    useSource()
    openMic()
    note.value = ''
    stops = [
      onNote({
        noteOn(note, velocity, channel) {
          if (channel === PAD_CHANNEL) return padOn(note, velocity)
          keys.add(note)
          chaos?.noteOn(note, velocity)
        },
        noteOff(note, channel) {
          if (channel === PAD_CHANNEL) return padOff(note)
          keys.delete(note)
          chaos?.noteOff(note)
        },
      }),
      onControl({
        control(cc, value) {
          const knob = KNOBS.find((k) => k.cc === cc)
          if (knob) knobs[knob.name] = value / 127
          // The joystick's up sends CC 1 too, the same as K1.
          if (cc === 1) joystick.y = value / 127
        },
        bend(amount) {
          joystick.x = amount
          chaos?.bend(amount)
        },
      }),
    ]
  },
  leave() {
    live.value = false
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
const setKnob = (i: number, value: number) => (knobs[KNOBS[i].name] = value)

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
  KNOBS.map((k) => ({ label: k.label, value: knobs[k.name], accent: k.name === 'resolve' })),
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
      if (!live.value) return s.getTracks().forEach((t) => t.stop()), null
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
  if (!mic || !recording.value || !live.value) return (recording.value = false)
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
    <div class="chaos-count">
      <span class="chaos-number">{{ count }}</span>
      <span class="chaos-unit">{{ voice ? 'grains' : 'oscillators' }}</span>
      <span class="chaos-sub">{{ perKey }} per key</span>
    </div>
    <div class="chaos-scope">
      <Scope :analyser="analyser" :active="live" />
    </div>
    <div class="chaos-adsr">
      <AdsrEditor v-model="envModel" />
    </div>
    <div class="chaos-take" :class="{ rec: recording }">
      <BufferView :buffer="source.buffer" :version="source.version" />
      <span class="chaos-source">pads mangle: {{ source.name.toLowerCase() }}</span>
      <span v-if="note" class="chaos-note">{{ note }}</span>
    </div>
    <MpkMini
      class="chaos-mpk"
      :knobs="knobList"
      :pads="padList"
      :pad-down="(n) => down.has(n)"
      :key-down="(n) => keys.has(n)"
      :joystick="joystick"
      @knob="setKnob"
      @pad-press="clickPad"
      @pad-release="padOff"
      @press="pressKey"
      @release="releaseKey"
    >
      <button v-no-focus class="chaos-latch" :class="{ on: latch }" @click="toggleLatch">
        pads: {{ latch ? 'latch' : 'hold' }}
      </button>
    </MpkMini>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): chaos slide look */
.chaos {
  display: grid;
  grid-template-columns: auto 1fr 15rem 12rem;
  grid-template-areas:
    'count scope adsr take'
    'mpk mpk mpk mpk';
  gap: 0.6rem 1rem;
}

.chaos-count {
  grid-area: count;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 10rem;
}

.chaos-number {
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: var(--size-title);
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.chaos-unit {
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--size-small);
}

.chaos-sub {
  margin-top: 0.3rem;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.6rem;
}

.chaos-scope {
  position: relative;
  grid-area: scope;
  height: 5rem;
  border-radius: 0.4rem;
  background: var(--surface);
}

.chaos-adsr {
  grid-area: adsr;
  display: flex;
  align-items: center;
  height: 5rem;
  border-radius: 0.4rem;
  background: var(--surface);
}

/* Only the letters fit at this size. */
.chaos-adsr :deep(.value),
.chaos-adsr :deep(.note) {
  display: none;
}

.chaos-adsr :deep(.letter) {
  font-size: 40px;
}

.chaos-take {
  position: relative;
  grid-area: take;
  height: 5rem;
  border: 2px solid transparent;
  border-radius: 0.4rem;
  background: var(--surface);
}

.chaos-take.rec {
  border-color: var(--accent);
}

.chaos-take :deep(.buffer-view) {
  height: 100%;
  background: none;
}

.chaos-note {
  position: absolute;
  bottom: 0.3rem;
  left: 0.5rem;
  z-index: 3;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 0.55rem;
}

.chaos-source {
  z-index: 3;
  position: absolute;
  top: 0.3rem;
  left: 0.5rem;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.55rem;
}

.chaos-mpk {
  grid-area: mpk;
}

.chaos-latch {
  padding: 0.15em 0.5em;
  border: 2px solid var(--wire);
  border-radius: 999px;
  background: var(--bg);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.5rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.chaos-latch.on {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--bg);
}
</style>
