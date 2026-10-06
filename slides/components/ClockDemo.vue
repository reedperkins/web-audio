<script setup lang="ts">
import { ref } from 'vue'
import { unlock } from '../audio/audio'
import { useDemo } from '../audio/useDemo'

// Plays "The audio clock" slide's code, with a playhead on the audio clock.
// The slide shows 0.75 s notes; the length slider starts them short and clean
// (no overlap), and dragging it up overlaps them until the sum clips, which
// sets up the next slide.
const notes = [261.63, 329.63, 392, 523.25]
const STEP = 0.1
const MAX_LENGTH = 0.75 // the slide code's value

const length = ref(STEP)
const playhead = ref<number | null>(null)
let frame = 0

const { ctx, out } = useDemo({ leave: stopPlayhead })

async function play() {
  await unlock()
  const now = ctx.currentTime
  const LENGTH = length.value
  notes.forEach((frequency, i) => {
    const osc = new OscillatorNode(ctx, { frequency })
    osc.connect(out.value)
    osc.start(now + i * STEP)
    osc.stop(now + i * STEP + LENGTH)
  })
  followClock(now, LENGTH)
}

function followClock(start: number, noteLength: number) {
  cancelAnimationFrame(frame)
  const end = (notes.length - 1) * STEP + noteLength
  const tick = () => {
    const t = ctx.currentTime - start
    if (t > end) return stopPlayhead()
    playhead.value = t
    frame = requestAnimationFrame(tick)
  }
  tick()
}

function stopPlayhead() {
  cancelAnimationFrame(frame)
  playhead.value = null
}
</script>

<template>
  <div class="clock-demo">
    <div class="clock-controls">
      <PlayButton :playing="playhead !== null" @play="play" />
      <Slider v-model="length" class="length" label="length" :min="0.05" :max="MAX_LENGTH" />
    </div>
    <Timeline
      :starts="notes.map((_, i) => i * STEP)"
      :length="length"
      :span="(notes.length - 1) * STEP + MAX_LENGTH"
      :playhead="playhead"
    />
  </div>
</template>

<style scoped>
.clock-demo {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

/* PLACEHOLDER(refine): compact length control */
.clock-controls .length {
  gap: 0.4em;
  font-size: 0.8rem;
  --slider-width: 5rem;
}

.clock-controls {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
</style>
