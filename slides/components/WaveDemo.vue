<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { analyser, unlock } from '../audio/audio'
import type { Envelope } from '../audio/envelope'
import { env } from '../audio/envelope'
import { pressKey, releaseKey } from '../audio/input'
import { playSequence } from '../audio/sequencer'
import type { Song } from '../audio/songs'
import { songs } from '../audio/songs'
import { playInto, releaseAll, wave } from '../audio/synth'
import { useDemo, vNoFocus } from '../audio/useDemo'

// The "Wave types" demo: the synth's settings drawn as its audio graph.
// OscillatorNode picks the wave, GainNode holds the envelope, and the
// destination shows a live scope. Picking a wave or letting go of an envelope
// handle plays a short note. A song sets the wave and envelope, then loops
// its melody until clicked again; changes while it plays reach the next notes.
// MIDI and the on-screen keys play the same settings.
const SOURCE = 'Wave settings'
// A3: 220 Hz, the frequency in the code.
const PREVIEW_NOTE = 57
const PREVIEW_HOLD = 0.4
// PLACEHOLDER(refine): song level, tune by ear
const SONG_LEVEL = 0.25

const { ctx, out } = useDemo({ enter, leave })
const songBus = new GainNode(ctx, { gain: SONG_LEVEL })

const active = ref(false)
const playing = shallowRef<Song | null>(null)
let stopSong: (() => void) | null = null
let previewTimer: ReturnType<typeof setTimeout> | undefined
let previewing = false

const nodes = [
  { key: 'osc', label: 'OscillatorNode' },
  { key: 'amp', label: 'GainNode' },
  { key: 'out', label: 'destination' },
]

const waveModel = computed({
  get: () => wave.value,
  set: (type: OscillatorType) => (wave.value = type),
})

const envModel = computed({
  get: () => ({ ...env }),
  set: (value: Envelope) => Object.assign(env, value),
})

const ms = (t: number) => (t < 1 ? `${Math.round(t * 1000)} ms` : `${t.toFixed(2)} s`)
const envValues = computed(() => [
  { key: 'A', value: ms(env.attack) },
  { key: 'D', value: ms(env.decay) },
  { key: 'S', value: env.sustain.toFixed(2) },
  { key: 'R', value: ms(env.release) },
])

function enter() {
  active.value = true
  playInto(out.value)
  songBus.connect(out.value)
}

function leave() {
  active.value = false
  stopPlaying()
  endPreview()
  releaseAll()
  playInto(null)
  songBus.disconnect()
}

// While a song plays, you already hear every change.
function preview() {
  if (playing.value) return
  clearTimeout(previewTimer)
  previewing = true
  pressKey(PREVIEW_NOTE, 90, SOURCE)
  previewTimer = setTimeout(endPreview, PREVIEW_HOLD * 1000)
}

function endPreview() {
  clearTimeout(previewTimer)
  if (previewing) releaseKey(PREVIEW_NOTE, SOURCE)
  previewing = false
}

function stopPlaying() {
  stopSong?.()
  stopSong = null
  playing.value = null
}

async function toggle(song: Song) {
  const was = playing.value
  stopPlaying()
  if (was === song) return
  endPreview()
  wave.value = song.wave
  Object.assign(env, song.env)
  await unlock()
  // Left the slide, or another click got there first, while unlocking.
  if (!active.value || stopSong) return
  stopSong = playSequence(song.steps, song.bpm, songBus)
  playing.value = song
}
</script>

<template>
  <div class="wave-demo">
    <SignalChain class="chain" :nodes="nodes">
      <template #osc>
        <WaveShapes v-model="waveModel" class="waves" @pick="preview" />
      </template>
      <template #amp>
        <div class="sub">envelope on <code>gain</code></div>
        <AdsrEditor v-model="envModel" class="adsr" @commit="preview" />
        <div class="env-values">
          <span v-for="v in envValues" :key="v.key"><b>{{ v.key }}</b> {{ v.value }}</span>
        </div>
      </template>
      <template #out>
        <div class="sub">speakers</div>
        <Scope class="scope" :analyser="analyser" :active="active" />
      </template>
    </SignalChain>

    <!-- PLACEHOLDER(refine): song panel look -->
    <div class="songs">
      <span class="songs-label">Songs</span>
      <button
        v-for="song in songs"
        :key="song.name"
        v-no-focus
        class="song"
        :class="{ on: playing === song }"
        @click="toggle(song)"
      >
        <span class="icon">{{ playing === song ? '■' : '▶' }}</span>
        <span class="song-name">{{ song.name }}</span>
        <span class="song-wave">'{{ song.wave }}'</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): settings panel layout */
.wave-demo {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.chain {
  align-items: stretch;
}

.chain :deep(.wire) {
  align-self: center;
}

.chain :deep(.node) {
  justify-content: flex-start;
  padding: 0.5rem 0.7rem;
}

.chain :deep(.node:nth-of-type(1)) {
  width: 11rem;
}

.chain :deep(.node:nth-of-type(2)) {
  flex: 1;
  min-width: 0;
}

.chain :deep(.node:nth-of-type(3)) {
  width: 9rem;
}

.waves {
  width: 100%;
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

/* Small here, so only the letters stay; the values go in a line below. */
.adsr {
  margin-top: -0.4rem;
}

.adsr :deep(.value),
.adsr :deep(.note) {
  display: none;
}

.adsr :deep(.letter) {
  font-size: 34px;
}

.env-values {
  display: flex;
  gap: 0.9rem;
  margin-top: -0.4rem;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.6rem;
}

.env-values b {
  color: var(--ink);
}

.scope {
  flex: 1;
  min-height: 5rem;
  border-radius: 0.4rem;
  background: var(--bg);
}

.songs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.songs-label {
  margin-right: 0.25rem;
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.song {
  display: inline-flex;
  align-items: baseline;
  gap: 0.45em;
  padding: 0.35em 0.8em;
  border: 2px solid var(--accent);
  border-radius: 999px;
  background: none;
  color: var(--accent);
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.song:hover,
.song.on {
  background: var(--accent);
  color: var(--bg);
}

.icon {
  font-size: 0.8em;
}

.song-wave {
  font-family: var(--font-mono);
  font-size: 0.85em;
  font-weight: 400;
  opacity: 0.75;
}
</style>
