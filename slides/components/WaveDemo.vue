<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { analyser, unlock } from '../audio/audio'
import type { Envelope } from '../audio/envelope'
import { env } from '../audio/envelope'
import { filter } from '../audio/filter'
import { pressKey, releaseKey } from '../audio/input'
import { playSequence } from '../audio/sequencer'
import type { Song } from '../audio/songs'
import { songs } from '../audio/songs'
import { playInto, releaseAll, stopPlayingInto, wave } from '../audio/synth'
import { useDemo } from '../audio/useDemo'

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
  // Only four tiles: fit them instead of stretching to the envelope's height.
  { key: 'osc', label: 'OscillatorNode', style: { width: '11.75rem', alignSelf: 'center' } },
  { key: 'amp', label: 'GainNode', style: { flex: 1, minWidth: 0 } },
  { key: 'out', label: 'destination', style: { width: '9rem' } },
]

const waveModel = computed({
  get: () => wave.value,
  set: (type: OscillatorType) => (wave.value = type),
})

const envModel = computed({
  get: () => ({ ...env }),
  set: (value: Envelope) => Object.assign(env, value),
})

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
  stopPlayingInto(out.value)
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
  Object.assign(filter, song.filter)
  await unlock()
  // Left the slide, or another click got there first, while unlocking.
  if (!active.value || stopSong) return
  stopSong = playSequence(song.steps, song.bpm, songBus)
  playing.value = song
}
</script>

<template>
  <div class="wave-demo">
    <SignalChain class="chain" stretch :nodes="nodes">
      <template #osc>
        <WaveShapes v-model="waveModel" class="waves" @pick="preview" />
      </template>
      <template #amp>
        <div class="sub">envelope on <code>gain</code></div>
        <AdsrEditor v-model="envModel" class="adsr" compact @commit="preview" />
      </template>
      <template #out>
        <div class="sub">speakers</div>
        <Scope class="scope" :analyser="analyser" :active="active" />
      </template>
    </SignalChain>

    <!-- PLACEHOLDER(refine): song panel look -->
    <div class="songs">
      <span class="songs-label">Songs</span>
      <ToggleChip
        v-for="song in songs"
        :key="song.name"
        action
        class="song"
        :on="playing === song"
        @click="toggle(song)"
      >
        <span class="icon">{{ playing === song ? '■' : '▶' }}</span>
        <span class="song-name">{{ song.name }}</span>
        <span class="song-wave">'{{ song.wave }}'</span>
      </ToggleChip>
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
  --node-padding: 0.5rem 0.7rem;
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

/* Compact: the A D S R letters only, as on every other slide. */
.adsr {
  margin-top: -0.4rem;
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
  align-items: baseline;
  padding: 0.35em 0.8em;
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
