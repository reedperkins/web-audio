<script setup lang="ts">
import { ref } from 'vue'
import { unlock } from '../audio/audio'
import { useDemo } from '../audio/useDemo'

// Plays the "Too loud" slide's code: four full-volume oscillators, no gain.
const chord = [261.63, 329.63, 392, 523.25]

const { ctx, out } = useDemo()
const playing = ref(false)

async function play() {
  if (playing.value) return
  await unlock()
  chord.forEach((frequency) => {
    const osc = new OscillatorNode(ctx, { frequency })
    osc.connect(out.value)
    osc.start()
    osc.stop(ctx.currentTime + 2)
    osc.onended = () => { playing.value = false }
  })
  playing.value = true
}
</script>

<template>
  <div class="clip-demo">
    <PlayButton :playing="playing" @play="play" />
    <WaveSum :frequencies="chord" />
  </div>
</template>

<style scoped>
.clip-demo {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
</style>
