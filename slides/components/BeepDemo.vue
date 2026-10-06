<script setup lang="ts">
import { ref } from 'vue'
import { unlock } from '../audio/audio'
import { useDemo } from '../audio/useDemo'

// Plays the "One beep" slide's code.
const { ctx, out } = useDemo()
const playing = ref(false)

async function play() {
  if (playing.value) return
  await unlock()
  const osc = new OscillatorNode(ctx, { frequency: 440 })
  osc.connect(out.value)
  osc.start()
  osc.stop(ctx.currentTime + 1)
  playing.value = true
  osc.onended = () => { playing.value = false }
}
</script>

<template>
  <PlayButton :playing="playing" @play="play" />
</template>
