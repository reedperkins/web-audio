<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef } from 'vue'
import { analyser, unlock } from '../audio/audio'
import type { Cell, Track, Variation } from '../audio/chiptune'
import { createSequencer, jazzChord, jazzMelody, muted, noteName, nudge, STEPS, TRACKS, variations } from '../audio/chiptune'
import { useDemo } from '../audio/useDemo'

// The cold open: a 16-step chiptune loop. Play starts it (and unlocks audio).
// Click or drag across cells to turn steps on and off; scroll on a bass,
// pad or melody cell to change its note or chord. A track's name mutes it.
// The tune buttons pick a variation (from the next loop, while playing);
// Random makes a new one each time, and shuffle switches every few loops.
// Jazz swings it, comps jazz voicings on an electric piano, and bends the
// melody toward them on a vibraphone; the grid shows the notes it plays.
// The tempo slider changes speed without a gap, since the scheduler reads it
// step by step.
// Trackpad scroll distance per note.
const WHEEL_STEP = 40

const bpm = ref(150)
const { out } = useDemo({ leave })
const seq = createSequencer(bpm)
const { selected, pending, shuffle, jazz } = seq

const playing = ref(false)
const now = shallowRef<{ step: number; variation: Variation } | null>(null)
let frame = 0
let wheel = 0
// While dragging, every cell the pointer crosses is set to this.
let paint: boolean | null = null

// The grid shows what you hear: the playing variation follows the audio
// clock, so it switches on the downbeat, not when it's scheduled.
const shown = computed(() => now.value?.variation ?? variations[selected.value])
const current = computed(() => now.value?.step ?? null)
// The button lit is the one picked, even before its loop starts.
const picked = computed(() => pending.value ?? selected.value)
// Picked or shuffled to, and not heard yet. The switch is scheduled a moment
// before the downbeat, so `pending` alone clears too early.
const upcoming = computed(() => {
  if (pending.value !== null) return pending.value
  return now.value && shown.value !== variations[selected.value] ? selected.value : null
})

function follow() {
  now.value = seq.current()
  frame = requestAnimationFrame(follow)
}

function stop() {
  seq.stop()
  cancelAnimationFrame(frame)
  playing.value = false
  now.value = null
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
    nudge(shown.value, track, cell, dir)
    wheel += dir * WHEEL_STEP
  }
}

function label(track: Track, i: number) {
  const v = shown.value
  const cell = v.cells[track.id][i]
  if (!cell.on || track.kind === 'drum') return ''
  if (track.id === 'melody' && jazz.value) return noteName(v, jazzMelody(v, i))
  if (track.kind === 'note') return noteName(v, cell.value)
  const chord = v.chords[cell.value]
  return jazz.value ? jazzChord(v, chord).name : chord.name
}

window.addEventListener('pointerup', release)
onUnmounted(() => {
  window.removeEventListener('pointerup', release)
  cancelAnimationFrame(frame)
})
</script>

<template>
  <div class="sequencer-demo">
    <!-- PLACEHOLDER(refine): tune picker look -->
    <div class="tunes">
      <span class="tunes-label">tune</span>
      <ToggleChip
        v-for="(v, i) in variations"
        :key="i"
        class="tune"
        :class="{ queued: upcoming === i }"
        :on="picked === i"
        @click="seq.select(i)"
      >
        {{ v.random ? '🎲 ' : '' }}{{ v.name }}
      </ToggleChip>
      <ToggleChip class="tune" :on="shuffle" @click="shuffle = !shuffle">
        ⇄ shuffle
      </ToggleChip>
      <ToggleChip class="tune" :on="jazz" @click="jazz = !jazz">
        ♪ jazz
      </ToggleChip>
      <span class="key">{{ shown.key }}<template v-if="upcoming !== null"> → {{ variations[upcoming].name }}</template></span>
    </div>

    <div class="grid">
      <template v-for="track in TRACKS" :key="track.id">
        <ToggleChip class="track-name" :class="track.group" :on="!muted[track.id]" @click="seq.setMuted(track.id, !muted[track.id])">
          {{ track.name }}
        </ToggleChip>
        <!-- One group per half bar, where the chord changes. -->
        <div class="cells" :class="track.group">
          <div v-for="g in STEPS / 4" :key="g" class="group">
            <div
              v-for="i in [0, 1, 2, 3].map(n => (g - 1) * 4 + n)"
              :key="i"
              class="cell"
              :class="{ on: shown.cells[track.id][i].on, now: current === i, long: label(track, i).length > 5 }"
              @pointerdown.prevent="press(shown.cells[track.id][i])"
              @pointerenter="cross(shown.cells[track.id][i])"
              @wheel.prevent="scroll(track, shown.cells[track.id][i], $event)"
            >
              {{ label(track, i) }}
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

.tunes {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tunes-label {
  margin-right: 0.25rem;
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.tune {
  font-size: 0.8rem;
}

/* Picked, waiting for the top of the loop. */
.tune.queued {
  animation: blink 0.5s steps(1) infinite;
}

@keyframes blink {
  50% { opacity: 0.45; }
}

.key {
  margin-left: auto;
  /* One line, so the demo's height (and the centered title above it)
     doesn't change when a tune is queued. */
  white-space: nowrap;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--size-small);
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

/* Jazz chord names like Fmaj9♯11. */
.cell.long {
  font-size: 0.5rem;
  letter-spacing: -0.02em;
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
