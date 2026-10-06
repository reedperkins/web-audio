<script setup lang="ts">
import { computed, onUnmounted } from 'vue'
import { isBlack } from '../audio/input'

// `count` piano keys starting at MIDI note `from`, each labeled with its
// number. Emits `press` with a velocity (harder lower on the key) and
// `release`; dragging across keys plays each one in turn. The parent says
// which notes are down, and can outline some keys (`marked`). The optional
// `below` slot puts something under each white key (`{ note }`).
// Fills its box: size it from the parent.
const props = withDefaults(defineProps<{
  from?: number
  count?: number
  marked?: number[]
  isDown?: (note: number) => boolean
}>(), {
  from: 48,
  count: 25,
  marked: () => [],
  isDown: () => false,
})
const emit = defineEmits<{ press: [note: number, velocity: number], release: [note: number] }>()

const notes = computed(() => Array.from({ length: props.count }, (_, i) => props.from + i))
const whites = computed(() => notes.value.filter((n) => !isBlack(n)))
// Each black key sits on the line after the white key before it.
const blacks = computed(() =>
  notes.value.filter(isBlack).map((note) => ({ note, after: whites.value.filter((w) => w < note).length })),
)

const MIN_VELOCITY = 40
// The key each pointer is holding.
const pressed = new Map<number, number>()

function keyAt(e: PointerEvent) {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-note]')
  if (!el) return null
  const { top, height } = el.getBoundingClientRect()
  const depth = Math.min(1, Math.max(0, (e.clientY - top) / height))
  return { note: Number(el.dataset.note), velocity: Math.round(MIN_VELOCITY + (127 - MIN_VELOCITY) * depth) }
}

function down(e: PointerEvent) {
  e.preventDefault()
  // Let the pointer move on to other keys (a capture would pin it to this one).
  ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
  const key = keyAt(e)
  if (key) hold(e.pointerId, key)
}

function move(e: PointerEvent) {
  if (!pressed.has(e.pointerId)) return
  const key = keyAt(e)
  if (key && key.note !== pressed.get(e.pointerId)) hold(e.pointerId, key)
}

function hold(pointer: number, { note, velocity }: { note: number, velocity: number }) {
  up(pointer)
  pressed.set(pointer, note)
  emit('press', note, velocity)
}

function up(pointer: number) {
  const note = pressed.get(pointer)
  if (note === undefined) return
  pressed.delete(pointer)
  emit('release', note)
}

function upAll() {
  for (const pointer of [...pressed.keys()]) up(pointer)
}
onUnmounted(upAll)
defineExpose({ upAll })
</script>

<template>
  <!-- PLACEHOLDER(refine): on-screen keyboard look -->
  <div class="keyboard" :style="{ '--whites': whites.length }">
    <div
      class="keys"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up($event.pointerId)"
      @pointercancel="up($event.pointerId)"
      @pointerleave="up($event.pointerId)"
    >
      <div
        v-for="note in whites"
        :key="note"
        class="key white"
        :class="{ down: isDown(note), marked: marked.includes(note) }"
        :data-note="note"
      >
        <span class="num">{{ note }}</span>
      </div>
      <div
        v-for="key in blacks"
        :key="key.note"
        class="key black"
        :class="{ down: isDown(key.note), marked: marked.includes(key.note) }"
        :data-note="key.note"
        :style="{ '--after': key.after }"
      />
    </div>
    <div v-if="$slots.below" class="below">
      <div v-for="note in whites" :key="note">
        <slot name="below" :note="note" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.keyboard {
  display: flex;
  flex-direction: column;
  height: 100%;
  user-select: none;
}

.keys {
  position: relative;
  flex: 1;
  display: flex;
  touch-action: none;
  cursor: pointer;
}

.key.white {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  border: 2px solid var(--ink);
  border-radius: 0 0 4px 4px;
  background: var(--bg);
}

.key.white + .key.white {
  border-left: none;
}

.key.black {
  position: absolute;
  top: 0;
  left: calc(100% / var(--whites) * var(--after));
  width: calc(100% / var(--whites) * 0.6);
  height: 60%;
  transform: translateX(-50%);
  border-radius: 0 0 3px 3px;
  background: var(--ink);
}

.key.white.marked {
  background: var(--surface);
  box-shadow: inset 0 0 0 3px var(--accent);
}

.key.black.marked {
  box-shadow: 0 0 0 3px var(--accent);
}

.key.down {
  background: var(--accent);
}

.num {
  margin-bottom: 0.3em;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--key-label-size, 0.6rem);
  pointer-events: none;
}

.key.down .num {
  color: var(--bg);
}

.below {
  display: flex;
}

.below > div {
  flex: 1;
  display: flex;
  justify-content: center;
}
</style>
