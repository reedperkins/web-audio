<script setup lang="ts">
import { computed, ref } from 'vue'
import { env } from '../audio/envelope'
import { noteName, onNote } from '../audio/input'
import { mtof } from '../audio/mtof'
import { useDemo } from '../audio/useDemo'

// One box per voice: it appears on key down and fades out over the release
// time on key up, the way the voice does. Draws only; the slide's demo makes
// the sound. It listens only while its slide is the current one.
interface Box {
  id: number
  note: number
  released: boolean
}

const boxes = ref<Box[]>([])
let nextId = 0
const timers = new Set<ReturnType<typeof setTimeout>>()

function release(note: number) {
  const box = boxes.value.find((b) => b.note === note && !b.released)
  if (!box) return
  box.released = true
  const timer = setTimeout(() => {
    timers.delete(timer)
    boxes.value = boxes.value.filter((b) => b.id !== box.id)
  }, env.release * 1000)
  timers.add(timer)
}

let stopListening: (() => void) | null = null

function clear() {
  timers.forEach(clearTimeout)
  timers.clear()
  boxes.value = []
}

useDemo({
  enter() {
    clear()
    stopListening = onNote({
      noteOn(note) {
        // Same restart as the synth: the old voice goes, a new one starts.
        release(note)
        boxes.value.push({ id: nextId++, note, released: false })
      },
      noteOff: release,
    })
  },
  leave() {
    stopListening?.()
    stopListening = null
    clear()
  },
})

const sounding = computed(() => boxes.value.filter((b) => !b.released).length)
</script>

<template>
  <div class="voice-list">
    <div class="count">{{ sounding }} {{ sounding === 1 ? 'voice' : 'voices' }}</div>
    <div class="boxes">
      <div
        v-for="box in boxes"
        :key="box.id"
        class="box"
        :class="{ released: box.released }"
        :style="{ '--release': `${env.release}s` }"
      >
        <span class="name">{{ noteName(box.note) }}</span>
        <span class="hz">{{ mtof(box.note).toFixed(1) }} Hz</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): voice boxes look */
.voice-list {
  margin-top: 1rem;
}

.count {
  margin-bottom: 0.4rem;
  color: var(--muted);
  font-size: 0.8rem;
}

.boxes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.3rem;
}

/* Pops in when added; fades over the release time once let go. */
.box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.1rem 0.2rem;
  border: 1.5px solid var(--accent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--accent) 12%, var(--bg));
  transition:
    opacity 0.08s,
    scale 0.08s;
}

/* After the .box rule, so it wins on the first style. */
@starting-style {
  .box {
    opacity: 0;
    scale: 0.8;
  }
}

.box.released {
  opacity: 0;
  transition: opacity var(--release) linear;
}

.name {
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
}

.hz {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.5rem;
}
</style>
