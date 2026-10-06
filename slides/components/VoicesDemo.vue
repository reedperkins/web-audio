<script setup lang="ts">
import { ref } from 'vue'
import { held, pressKey, releaseKey } from '../audio/input'
import { progression } from '../audio/presets'
import { cut, playInto, releaseAll } from '../audio/synth'
import { useDemo } from '../audio/useDemo'

// The "Polyphony" demo. On this slide MIDI and the on-screen keys play the
// shared synth. Click a chord button and its notes go down, then let go after
// HOLD seconds. Click the next one before then and only the notes that change
// move, so common tones keep ringing; clicking the same one again replays it.
// Cycle steps through the progression on a loop, one chord every STEP
// seconds, each held until the next comes in; turning it off cuts the chord
// short instead of letting it release. The buttons press keys
// through the same input as a MIDI device, so the keys light up too.
const SOURCE = 'Chord buttons'
const VELOCITY = 90
const HOLD = 0.7
const STEP = 1

let holdTimer: ReturnType<typeof setTimeout> | undefined

const { out } = useDemo({
  enter: () => playInto(out.value),
  leave() {
    clearTimeout(holdTimer)
    stopCycle()
    play(null)
    releaseAll()
    playInto(null)
  },
})

const current = ref<number | null>(null)

function play(index: number | null) {
  const from = current.value === null ? [] : progression[current.value].notes
  const to = index === null ? [] : progression[index].notes
  from.filter((n) => !to.includes(n)).forEach((n) => releaseKey(n, SOURCE))
  to.filter((n) => !from.includes(n)).forEach((n) => pressKey(n, VELOCITY, SOURCE))
  current.value = index
}

const cycling = ref(false)
let cycleTimer: ReturnType<typeof setTimeout> | undefined

function step(index: number) {
  clearTimeout(holdTimer)
  play(index)
  cycleTimer = setTimeout(() => step((index + 1) % progression.length), STEP * 1000)
}

function stopCycle() {
  clearTimeout(cycleTimer)
  cycling.value = false
}

function toggleCycle() {
  if (!cycling.value) {
    cycling.value = true
    step(0)
    return
  }
  stopCycle()
  // Silence first, so the key ups below find no voices left to release.
  if (current.value !== null) progression[current.value].notes.forEach(cut)
  play(null)
}

// Picking a chord by hand takes over from Cycle.
function pick(index: number) {
  stopCycle()
  if (current.value === index) play(null)
  play(index)
  clearTimeout(holdTimer)
  holdTimer = setTimeout(() => play(null), HOLD * 1000)
}
</script>

<template>
  <div class="voices-demo">
    <div class="chords">
      <ToggleChip
        v-for="(chord, i) in progression"
        :key="chord.name"
        action
        class="chord"
        :on="current === i"
        @click="pick(i)"
      >
        {{ chord.name }}
      </ToggleChip>
      <ToggleChip action class="chord cycle" :on="cycling" @click="toggleCycle">
        {{ cycling ? '■' : '▶' }} Cycle
      </ToggleChip>
    </div>
    <Keyboard
      class="piano"
      :from="41"
      :count="36"
      :down="held"
      @press="pressKey"
      @release="releaseKey"
    />
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): chord buttons look */
.voices-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.chords {
  display: grid;
  grid-template-columns: repeat(8, 1fr) auto;
  gap: 0.3rem;
}

.chord {
  align-items: baseline;
  padding: 0.3em 0.15em;
  border-radius: 6px;
  font-size: 0.68rem;
}

.cycle {
  padding: 0.3em 0.5em;
  border-style: dashed;
}

.cycle.on {
  border-style: solid;
}

.voices-demo .piano {
  height: 4.5rem;
  --key-label-size: 0.45rem;
}
</style>
