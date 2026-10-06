<script setup lang="ts">
import { computed, ref } from 'vue'
import { unlock } from '../audio/audio'
import { load, sample } from '../audio/samples'
import { useBufferPlayer } from '../audio/useBufferPlayer'
import { useDemo } from '../audio/useDemo'

// Plays the "A file is a buffer" slide's code: one decoded clip through a
// buffer source. The picture is the buffer itself, with a playhead.
const clip = sample('small-step')
const failed = ref(false)

const { out } = useDemo({
  enter() {
    load(clip).then(
      () => (failed.value = false),
      () => (failed.value = true),
    )
  },
  leave: () => stop(),
})
const { playing, position, play, stop } = useBufferPlayer(out)

const buffer = computed(() => clip.buffer)

async function toggle() {
  if (playing.value) return stop()
  await unlock()
  play(await load(clip))
}

const format = (n: number) => n.toLocaleString('en-US')
const facts = computed(() => {
  const b = buffer.value
  if (!b) return null
  return [
    `${b.numberOfChannels} channel${b.numberOfChannels > 1 ? 's' : ''}`,
    `${format(b.sampleRate)} samples/s`,
    `${b.duration.toFixed(1)} s`,
    `${format(b.length * b.numberOfChannels)} numbers`,
  ]
})
</script>

<template>
  <div class="buffer-demo">
    <div class="buffer-demo-bar">
      <PlayButton :playing="playing" @play="toggle" />
      <span v-if="failed" class="buffer-demo-facts">Couldn't load the clip.</span>
      <span v-else-if="facts" class="buffer-demo-facts">
        <span v-for="fact in facts" :key="fact">{{ fact }}</span>
      </span>
    </div>
    <BufferView :buffer="buffer" :version="clip.version" :position="position" />
  </div>
</template>

<style scoped>
.buffer-demo {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.buffer-demo-bar {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.buffer-demo-facts {
  display: flex;
  gap: 1.25rem;
  font-family: var(--font-mono);
  font-size: var(--size-small);
  color: var(--muted);
}
</style>
