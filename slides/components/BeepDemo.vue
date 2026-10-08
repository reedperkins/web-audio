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
  <div class="beep-demo">
    <PlayButton :playing="playing" @play="play" />
    <SignalChain :nodes="[
      { key: 'osc', label: 'OscillatorNode' },
      { key: 'out', label: 'ctx.destination' },
    ]">
      <template #osc>
        <span class="detail">440 Hz</span>
      </template>
      <template #out>
        <svg class="speakers" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor" />
          <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </template>
    </SignalChain>
  </div>
</template>

<style scoped>
.beep-demo {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.5rem;
}

.detail {
  font-family: var(--font-mono);
  font-size: var(--size-small);
  color: var(--muted);
}

.speakers {
  width: 2rem;
  height: 2rem;
  color: var(--ink);
}
</style>
