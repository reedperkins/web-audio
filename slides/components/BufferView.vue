<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { LoopRegion } from '../audio/useClipRegion'
import { fitCanvas } from '../lib/canvas'

// An AudioBuffer drawn from its own samples:
//   <BufferView :buffer="buffer" :version="version" :position="seconds" />
// Each pixel column shows the lowest and highest sample under it. `version`
// redraws after the samples change in place (reversing). `position` (in
// seconds) places the playhead; leave it out to hide it.
//
// Optional: `v-model:loop` ({ start, end } in seconds, or null) shades the
// loop and adds a drag handle at each end. With `selectable`, dragging across
// the waveform marks a new region (a click alone keeps the old one). With
// `seekable`, `@seek` gets the time clicked. The default slot is laid over the waveform (positioned against
// it) for pictures of what's playing. `loopActive: false` dims the loop to a
// preview of where it would go.

const props = withDefaults(defineProps<{
  buffer?: AudioBuffer
  version?: number
  position?: number | null
  seekable?: boolean
  selectable?: boolean
  loopActive?: boolean
}>(), { loopActive: true })
const loop = defineModel<LoopRegion | null>('loop', { default: null })
const emit = defineEmits<{ seek: [seconds: number] }>()

// The shortest loop a drag can make, in seconds.
const MIN_LOOP = 0.05

// PLACEHOLDER(refine): waveform look
const canvas = ref<HTMLCanvasElement>()

function draw() {
  const fit = fitCanvas(canvas.value)
  if (!fit) return
  const { g, w, h, scale, color } = fit

  g.fillStyle = color('--wire')
  g.fillRect(0, h / 2 - scale / 2, w, scale)

  const buffer = props.buffer
  if (!buffer) return
  // Mono pictures: the first channel stands in for the rest.
  const data = buffer.getChannelData(0)
  const per = data.length / w
  g.fillStyle = color('--signal')
  for (let x = 0; x < w; x++) {
    let min = 0
    let max = 0
    const end = Math.min(data.length, Math.floor((x + 1) * per))
    for (let i = Math.floor(x * per); i < end; i++) {
      const v = data[i]
      if (v < min) min = v
      else if (v > max) max = v
    }
    const top = h / 2 - max * (h / 2) * 0.95
    const bottom = h / 2 - min * (h / 2) * 0.95
    g.fillRect(x, top, 1, Math.max(scale, bottom - top))
  }
}

watch(() => [props.buffer, props.version], draw)
// Slidev keeps slides it isn't showing at zero size, so a buffer that arrives
// then draws nothing. Redraw when the slide is laid out.
const resize = new ResizeObserver(draw)
onMounted(() => resize.observe(canvas.value!))
onUnmounted(() => resize.disconnect())

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const percent = (seconds: number) =>
  `${clamp(seconds / (props.buffer?.duration || 1), 0, 1) * 100}%`

const playhead = computed(() => {
  const { buffer, position } = props
  if (!buffer || position == null) return null
  return percent(position)
})

const region = computed(() => {
  if (!props.buffer || !loop.value) return null
  return { left: percent(loop.value.start), right: `calc(100% - ${percent(loop.value.end)})` }
})

const root = ref<HTMLElement>()

// Seconds under the pointer. The bounding box includes the slide's scaling.
function timeAt(e: PointerEvent) {
  const box = root.value!.getBoundingClientRect()
  return clamp((e.clientX - box.left) / box.width, 0, 1) * (props.buffer?.duration ?? 0)
}

// A handle, or 'new' while marking a region from `anchor`.
let dragging: keyof LoopRegion | 'new' | null = null
let anchor = 0
let before: LoopRegion | null = null
// The region being marked. The model only catches up after the parent
// re-renders, so a quick click can't read it back.
let marked: LoopRegion | null = null

function grab(e: PointerEvent, end: keyof LoopRegion) {
  dragging = end
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function drag(e: PointerEvent) {
  if (!dragging || !loop.value) return
  const t = timeAt(e)
  const { start, end } = loop.value
  const duration = props.buffer?.duration ?? 0
  if (dragging === 'new') {
    loop.value = marked = { start: Math.min(anchor, t), end: Math.max(anchor, t) }
    return
  }
  loop.value =
    dragging === 'start'
      ? { start: clamp(t, 0, end - MIN_LOOP), end }
      : { start, end: clamp(t, start + MIN_LOOP, duration) }
}

function drop() {
  if (dragging === 'new' && marked && marked.end - marked.start < MIN_LOOP) loop.value = before
  dragging = null
}

function down(e: PointerEvent) {
  if (!props.buffer) return
  if (props.selectable && loop.value) {
    before = loop.value
    anchor = timeAt(e)
    loop.value = marked = { start: anchor, end: anchor }
    dragging = 'new'
    root.value!.setPointerCapture(e.pointerId)
  }
  if (props.seekable) emit('seek', timeAt(e))
}
</script>

<template>
  <div
    ref="root"
    class="buffer-view"
    :class="{ seekable, selectable }"
    @pointerdown="down"
    @pointermove="drag"
    @pointerup="drop"
    @pointercancel="drop"
  >
    <canvas ref="canvas" />
    <slot />
    <div v-if="region" class="buffer-loop" :class="{ idle: !loopActive }" :style="region">
      <div
        v-for="end in (['start', 'end'] as const)"
        :key="end"
        class="buffer-handle"
        :class="end"
        @pointerdown.stop="grab($event, end)"
      />
    </div>
    <div v-if="playhead" class="buffer-playhead" :style="{ left: playhead }" />
  </div>
</template>

<style scoped>
.buffer-view {
  position: relative;
  height: 6.5rem;
  border-radius: 0.4rem;
  background: var(--surface);
}

/* Layers: loop shading under the waveform, handles and playhead over it. */
canvas {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
}

.buffer-view.seekable {
  cursor: pointer;
}

.buffer-view.selectable {
  cursor: crosshair;
  touch-action: none;
}

.buffer-loop {
  position: absolute;
  top: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-inline: 2px solid var(--accent);
}

.buffer-loop.idle {
  opacity: 0.35;
}

/* A wide, invisible grab area centred on each edge, with a visible tab. */
.buffer-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1.25rem;
  z-index: 2;
  cursor: ew-resize;
  touch-action: none;
}

.buffer-handle.start {
  left: calc(-0.625rem - 1px);
}

.buffer-handle.end {
  right: calc(-0.625rem - 1px);
}

.buffer-handle::after {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  translate: -50%;
  width: 0.7rem;
  height: 1.1rem;
  border-radius: 0 0 0.25rem 0.25rem;
  background: var(--accent);
}

.buffer-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  z-index: 2;
  margin-left: -1px;
  background: var(--ink);
  pointer-events: none;
}
</style>
