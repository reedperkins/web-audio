<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSlideContext } from '@slidev/client'
import { unlock } from '../audio/audio'
import { useDemo } from '../audio/useDemo'

// Plays the "One beep" slide's code. From the oscillator's step on, a sine
// diagram beside the chain shows what the oscillator makes.
const { ctx, out } = useDemo()
const playing = ref(false)
const { $clicks } = useSlideContext()
const showWave = computed(() => $clicks.value >= 1)

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
    <div class="beep-row">
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
      <SineDiagram class="sine" :class="{ hidden: !showWave }" />
    </div>
  </div>
</template>

<style scoped>
.beep-demo {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.5rem;
}

.beep-row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.beep-row > .sine {
  flex: none;
  width: 12.5rem;
  transition: opacity 0.3s;
}

/* Hidden, not removed, so the chain doesn't shift when it appears. */
.beep-row > .sine.hidden {
  opacity: 0;
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
