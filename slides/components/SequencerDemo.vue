<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { analyser, unlock } from '../audio/audio'
import type { Cell, Track } from '../audio/chiptune'
import { CHORDS, createSequencer, noteName, nudge, STEPS, tracks } from '../audio/chiptune'
import { useDemo } from '../audio/useDemo'

// The cold open: a 16-step chiptune loop. Play starts it (and unlocks audio).
// Click or drag across cells to turn steps on and off; scroll on a bass,
// pad or melody cell to change its note or chord. A track's name mutes it.
// The tempo slider changes speed without a gap, since the scheduler reads it
// step by step.
// Trackpad scroll distance per note.
const WHEEL_STEP = 40

const bpm = ref(150)
const { out } = useDemo({ leave })
const seq = createSequencer(bpm)

const playing = ref(false)
const current = ref<number | null>(null)
let frame = 0
let wheel = 0
// While dragging, every cell the pointer crosses is set to this.
let paint: boolean | null = null

function follow() {
  current.value = seq.current()
  frame = requestAnimationFrame(follow)
}

function stop() {
  seq.stop()
  cancelAnimationFrame(frame)
  playing.value = false
  current.value = null
}

function leave() {
  stop()
}

async function toggle() {
  if (playing.value) return stop()
  await unlock()
  // useDemo swaps `out` on leave, so pass the current one each time.
  seq.start(out.value)
  playing.value = true
  follow()
}

function toggleMute(track: Track) {
  track.muted = !track.muted
  seq.setMuted(track.id, track.muted)
}

function press(cell: Cell) {
  paint = !cell.on
  cell.on = paint
}

function cross(cell: Cell) {
  if (paint !== null) cell.on = paint
}

function release() {
  paint = null
}

function scroll(track: Track, cell: Cell, e: WheelEvent) {
  if (track.kind === 'drum') return
  wheel += e.deltaY
  while (Math.abs(wheel) >= WHEEL_STEP) {
    const dir = wheel < 0 ? 1 : -1
    nudge(track, cell, dir)
    wheel += dir * WHEEL_STEP
  }
}

function label(track: Track, cell: Cell) {
  if (!cell.on || track.kind === 'drum') return ''
  return track.kind === 'chord' ? CHORDS[cell.value].name : noteName(cell.value)
}

window.addEventListener('pointerup', release)
onUnmounted(() => {
  window.removeEventListener('pointerup', release)
  cancelAnimationFrame(frame)
})
</script>

<template>
  <div class="sequencer-demo">
    <div class="grid">
      <template v-for="track in tracks" :key="track.id">
        <ToggleChip class="track-name" :class="track.group" :on="!track.muted" @click="toggleMute(track)">
          {{ track.name }}
        </ToggleChip>
        <!-- One group per half bar, where the chord changes. -->
        <div class="cells" :class="track.group">
          <div v-for="g in STEPS / 4" :key="g" class="group">
            <div
              v-for="i in [0, 1, 2, 3].map(n => (g - 1) * 4 + n)"
              :key="i"
              class="cell"
              :class="{ on: track.cells[i].on, now: current === i }"
              @pointerdown.prevent="press(track.cells[i])"
              @pointerenter="cross(track.cells[i])"
              @wheel.prevent="scroll(track, track.cells[i], $event)"
            >
              {{ label(track, track.cells[i]) }}
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="controls">
      <PlayButton :playing="playing" @play="toggle" />
      <Slider v-model="bpm" class="tempo" label="tempo" :min="80" :max="200" :step="1" :digits="0" :format="v => `${v} bpm`" />
      <Scope class="scope" :analyser="analyser" :active="playing" />
    </div>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): sequencer look */
.sequencer-demo {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  user-select: none;
}

.grid {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.4rem 0.8rem;
}

.track-name {
  justify-content: flex-start;
  min-width: 5.5rem;
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.drums { --track: var(--seq-drums); }
.bass { --track: var(--seq-bass); }
.pad { --track: var(--seq-pad); }
.melody { --track: var(--seq-melody); }

/* The chip takes its track's color when on. */
.track-name.on {
  border-color: var(--track);
  background: var(--track);
}

.track-name:not(.on) {
  text-decoration: line-through;
}

.cells {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.6rem;
}

.group {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.25rem;
}

.cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2rem;
  border-radius: 0.2rem;
  background: var(--surface);
  color: var(--bg);
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 60ms;
}

.cell.on {
  background: var(--track);
}

.cell.now {
  outline: 2px solid var(--ink);
  outline-offset: 1px;
}

.cell.on.now {
  transform: scale(1.12);
}

.controls {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.tempo {
  --slider-width: 12em;
  --slider-value-width: 7ch;
}

.scope {
  flex: 1;
  height: 3.5rem;
  border-radius: 0.4rem;
  background: var(--surface);
}
</style>
