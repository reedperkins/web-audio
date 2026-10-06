<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { WindowName } from '../audio/grains'
import { GRAIN, HOP, windows } from '../audio/grains'
import { vNoFocus } from '../audio/useDemo'

// The grain engine in slow motion, zoomed in on a few grains:
//   <GrainLens :buffer="buffer" :speed :semitones :window :granular :active />
// Top lane: the buffer, with each grain's fade drawn over the part it reads.
// Bottom lane: the output, with each grain's faded audio at the time it
// plays, and a dashed line for their summed level. Lines join each sounding
// grain to where it plays. Both lanes share one time scale, so speed shows as
// grains bunching up or spreading out on top, and pitch as each grain reading
// more or less of the buffer than it fills below.
// With `granular` off it shows one plain source instead: a stretch of buffer
// squeezed or stretched to fill the output.
// It runs on its own clock, SLOW times slower than real time, while `active`
// and not frozen. Dragging across it sideways stretches: it sets `speed`
// (v-model:speed), and the grains on screen re-space around "now" at once.
const props = defineProps<{
  buffer?: AudioBuffer
  version?: number
  speed: number
  semitones: number
  window: WindowName
  granular: boolean
  active: boolean
}>()
const emit = defineEmits<{ 'update:speed': [speed: number] }>()

// PLACEHOLDER(refine): lens pace, zoom and look
const SLOW = 20
// Seconds across the lens, in both lanes.
const VIEW = 6 * HOP
// Where "now" sits, as a share of the width.
const CURSOR = 0.4

interface LensGrain {
  k: number
  out: number
  read: number
  ratio: number
}

const canvas = ref<HTMLCanvasElement>()
const frozen = ref(false)
let clock = 0
// Grain k starts at output time k × HOP and reads from
// anchorRead + (k - anchorK) × speed × HOP. Re-anchoring at the grain playing
// now keeps it in place while the others spread out or bunch up around it.
let anchorK = 0
let anchorRead = 0
// Plain mode: where the source was reading at `clock`.
let plainRead = 0
let peak = 1
let frame = 0
let last = 0

const ratio = () => 2 ** (props.semitones / 12)

// Start where the clip gets loud, so there's something to see.
function loudStart(buffer: AudioBuffer) {
  const data = buffer.getChannelData(0)
  const step = Math.round(buffer.sampleRate / 100)
  const levels: number[] = []
  for (let i = 0; i + step <= data.length; i += step) {
    let s = 0
    for (let j = i; j < i + step; j++) s += data[j] * data[j]
    levels.push(Math.sqrt(s / step))
  }
  const loudest = Math.max(...levels)
  peak = data.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1
  const first = levels.findIndex((l) => l > loudest * 0.4)
  return Math.max(0, (first * step) / buffer.sampleRate - 0.02)
}

// Start a full view in, so the lens opens with grains on both sides of now.
function reset() {
  clock = VIEW
  anchorK = kNow()
  anchorRead = props.buffer ? loudStart(props.buffer) : 0
  plainRead = anchorRead
}

const wrap = (p: number) => {
  const d = props.buffer?.duration ?? 1
  return ((p % d) + d) % d
}

const readOf = (k: number, speed = props.speed) => anchorRead + (k - anchorK) * speed * HOP
const kNow = () => Math.floor(clock / HOP)

function reanchor(oldSpeed: number) {
  const k = kNow()
  anchorRead = wrap(readOf(k, oldSpeed))
  anchorK = k
}

// The grains that overlap the view right now.
function visible(): LensGrain[] {
  const first = Math.floor((clock - VIEW - GRAIN) / HOP)
  const last = Math.ceil((clock + VIEW) / HOP)
  const list: LensGrain[] = []
  for (let k = Math.max(0, first); k <= last; k++) list.push({ k, out: k * HOP, read: readOf(k), ratio: ratio() })
  return list
}

// The read position at output time `t`.
function readAt(t: number) {
  const k = Math.max(0, Math.floor(t / HOP))
  return readOf(k) + props.speed * (t - k * HOP)
}

function draw() {
  const el = canvas.value
  const buffer = props.buffer
  if (!el) return
  const scale = devicePixelRatio * 2
  const W = Math.round(el.clientWidth * scale)
  const H = Math.round(el.clientHeight * scale)
  if (!W || !H) return
  if (el.width !== W || el.height !== H) Object.assign(el, { width: W, height: H })
  const g = el.getContext('2d')!
  const style = getComputedStyle(el)
  const color = (name: string) => style.getPropertyValue(name).trim()
  const colors = [color('--accent'), color('--signal')]
  g.clearRect(0, 0, W, H)
  if (!buffer) return

  const data = buffer.getChannelData(0)
  const sr = buffer.sampleRate
  const sampleAt = (p: number) => data[((Math.round(p * sr) % data.length) + data.length) % data.length]
  const lane = H * 0.34
  const inMid = H * 0.08 + lane / 2
  const outMid = H * 0.58 + lane / 2
  const half = (lane / 2) * 0.92
  const perPx = VIEW / W
  const cursorX = CURSOR * W

  const readNow = props.granular ? readAt(clock) : plainRead
  const pView0 = readNow - CURSOR * VIEW
  const tView0 = clock - CURSOR * VIEW
  const xIn = (p: number) => {
    // Unwrap across the end of the buffer, so positions stay near the view.
    const d = buffer.duration
    const near = p + Math.round((readNow - p) / d) * d
    return ((near - pView0) / VIEW) * W
  }
  const xOut = (t: number) => ((t - tView0) / VIEW) * W

  // Lane guides.
  g.fillStyle = color('--wire')
  g.fillRect(0, inMid - scale / 2, W, scale)
  g.fillRect(0, outMid - scale / 2, W, scale)

  // The buffer's own samples in the top lane.
  g.fillStyle = color('--muted')
  for (let x = 0; x < W; x++) {
    const p = pView0 + x * perPx
    let lo = 0
    let hi = 0
    const n = Math.max(1, Math.round(perPx * sr))
    for (let j = 0; j < n; j++) {
      const v = sampleAt(p + j / sr)
      if (v < lo) lo = v
      else if (v > hi) hi = v
    }
    g.fillRect(x, inMid - (hi / peak) * half, 1, Math.max(scale / 2, ((hi - lo) / peak) * half))
  }

  g.lineWidth = scale
  if (props.granular) {
    const fade = windows[props.window]
    const fadeMax = Math.max(...fade)
    const fadeAt = (u: number) => {
      const i = Math.min(fade.length - 1, Math.max(0, u * (fade.length - 1)))
      const i0 = Math.floor(i)
      const i1 = Math.min(fade.length - 1, i0 + 1)
      return fade[i0] + (fade[i1] - fade[i0]) * (i - i0)
    }
    const level = new Float32Array(W)

    for (const gr of visible()) {
      const c = colors[gr.k % 2]
      const sounding = gr.out <= clock && clock < gr.out + GRAIN
      const span = GRAIN * gr.ratio
      const x0 = xIn(gr.read)
      const x1 = xIn(gr.read) + (span / VIEW) * W

      // Top: the fade over the part of the buffer this grain reads.
      g.globalAlpha = sounding ? 0.3 : 0.1
      g.fillStyle = c
      g.beginPath()
      g.moveTo(x0, inMid + half)
      for (let x = x0; x <= x1; x += scale) g.lineTo(x, inMid + half - (fadeAt((x - x0) / (x1 - x0)) / fadeMax) * half * 2)
      g.lineTo(x1, inMid + half)
      g.fill()
      g.globalAlpha = sounding ? 1 : 0.35
      g.strokeStyle = c
      g.stroke()

      // Bottom: the grain's audio, faded, where it plays.
      const o0 = xOut(gr.out)
      const o1 = xOut(gr.out + GRAIN)
      g.beginPath()
      for (let x = Math.max(0, Math.floor(o0)); x <= Math.min(W - 1, o1); x++) {
        const u = (x - o0) / (o1 - o0)
        const f = fadeAt(u)
        level[x] += f
        const v = sampleAt(gr.read + u * span) * f
        const y = outMid - (v / peak) * half
        if (x === Math.max(0, Math.floor(o0))) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.globalAlpha = sounding ? 1 : 0.4
      g.stroke()

      // Join a sounding grain's read spot to where it plays.
      if (sounding) {
        g.globalAlpha = 0.6
        g.setLineDash([3 * scale, 3 * scale])
        g.beginPath()
        g.moveTo((x0 + x1) / 2, inMid + half)
        g.lineTo((o0 + o1) / 2, outMid - half)
        g.stroke()
        g.setLineDash([])
      }
    }

    // The grains' fades added up: flat means a steady level.
    g.globalAlpha = 1
    g.strokeStyle = color('--ink')
    g.setLineDash([4 * scale, 3 * scale])
    g.beginPath()
    for (let x = 0; x < W; x++) {
      const y = outMid - level[x] * half
      if (x) g.lineTo(x, y)
      else g.moveTo(x, y)
    }
    g.stroke()
    g.setLineDash([])
  } else {
    // One source: the stretch of buffer under the output view, resampled.
    const rate = props.speed * ratio()
    const r0 = xIn(readNow - CURSOR * VIEW * rate)
    const r1 = xIn(readNow + (1 - CURSOR) * VIEW * rate)
    g.globalAlpha = 0.15
    g.fillStyle = colors[0]
    g.fillRect(r0, inMid - half, r1 - r0, half * 2)
    g.globalAlpha = 0.6
    g.strokeStyle = colors[0]
    g.setLineDash([3 * scale, 3 * scale])
    g.beginPath()
    g.moveTo(r0, inMid + half)
    g.lineTo(0, outMid - half)
    g.moveTo(r1, inMid + half)
    g.lineTo(W, outMid - half)
    g.stroke()
    g.setLineDash([])
    g.globalAlpha = 1
    g.beginPath()
    for (let x = 0; x < W; x++) {
      const v = sampleAt(readNow + (x * perPx - CURSOR * VIEW) * rate)
      const y = outMid - (v / peak) * half
      if (x) g.lineTo(x, y)
      else g.moveTo(x, y)
    }
    g.stroke()
  }

  // Now.
  g.globalAlpha = 1
  g.fillStyle = color('--ink')
  g.fillRect(cursorX - scale / 2, 0, scale, H)
}

function loop(now: number) {
  const dt = frozen.value ? 0 : Math.min(0.1, (now - last) / 1000)
  last = now
  clock += dt / SLOW
  plainRead = wrap(plainRead + (dt / SLOW) * props.speed * ratio())
  draw()
  frame = requestAnimationFrame(loop)
}

watch(
  () => props.speed,
  (_, old) => reanchor(old),
)
// Settings change while frozen: show it anyway.
watch(() => [props.speed, props.semitones, props.window], draw)

// Drag sideways to stretch: right spreads the grains out in the buffer
// (faster), left bunches them up (slower). Doubles every STRETCH_PX.
const STRETCH_PX = 160
const MIN_SPEED = 0.25
const MAX_SPEED = 2
let dragX: number | null = null
let dragSpeed = 1

function grab(e: PointerEvent) {
  if (!props.granular) return
  dragX = e.clientX
  dragSpeed = props.speed
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function drag(e: PointerEvent) {
  if (dragX === null) return
  const box = canvas.value!.getBoundingClientRect()
  // In slide pixels, so the slide's scaling doesn't change the feel.
  const dx = ((e.clientX - dragX) / box.width) * canvas.value!.clientWidth
  const speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, dragSpeed * 2 ** (dx / STRETCH_PX)))
  emit('update:speed', Math.round(speed * 20) / 20)
}

function drop() {
  dragX = null
}

const ms = (s: number) => `${Math.round(s * 1000)} ms`
const readLabel = computed(() => `grains start ${ms(props.speed * HOP)} apart, each reads ${ms(GRAIN * ratio())}`)
const outLabel = computed(() => {
  const longer = 1 / props.speed
  return `grains start ${ms(HOP)} apart, each lasts ${ms(GRAIN)}: ${longer.toFixed(2)}× as long`
})

watch(
  () => props.active,
  (on) => {
    cancelAnimationFrame(frame)
    if (on) {
      last = performance.now()
      frame = requestAnimationFrame(loop)
    }
  },
)

// A new clip, or its samples flipped: start again at its loud part.
watch(
  () => [props.buffer, props.version],
  () => {
    reset()
    draw()
  },
)

// Switching modes: carry on from the same spot.
watch(
  () => props.granular,
  (granular) => {
    if (granular) {
      anchorK = kNow()
      anchorRead = plainRead
    } else plainRead = wrap(readAt(clock))
    draw()
  },
)

// Slides that aren't showing have zero size; draw once they're laid out.
const resize = new ResizeObserver(draw)
onMounted(() => {
  reset()
  resize.observe(canvas.value!)
})
onUnmounted(() => {
  cancelAnimationFrame(frame)
  resize.disconnect()
})
</script>

<template>
  <div class="grain-lens" :class="{ stretchable: granular }">
    <canvas ref="canvas" @pointerdown="grab" @pointermove="drag" @pointerup="drop" @pointercancel="drop" />
    <span class="lens-tag top">buffer · <template v-if="granular">{{ readLabel }}</template><template v-else>one source reads it all</template></span>
    <span class="lens-tag bottom">output · <template v-if="granular">{{ outLabel }}</template><template v-else>squeezed or stretched: pitch moves with speed</template></span>
    <button v-no-focus class="lens-freeze" :class="{ on: frozen }" @click="frozen = !frozen">
      {{ frozen ? '▶ slowed ' + SLOW + '×' : '❚❚ slowed ' + SLOW + '×' }}
    </button>
    <span v-if="granular" class="lens-hint">↔ drag to stretch</span>
  </div>
</template>

<style scoped>
.grain-lens {
  position: relative;
  border-radius: 0.4rem;
  background: var(--surface);
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.lens-tag {
  position: absolute;
  left: 0.5rem;
  padding: 0 0.3em;
  border-radius: 0.2rem;
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.6rem;
}

.lens-tag.top {
  top: 0.15rem;
}

.lens-tag.bottom {
  top: 50%;
}

.grain-lens.stretchable canvas {
  cursor: ew-resize;
  touch-action: none;
}

.lens-freeze {
  position: absolute;
  top: 0.15rem;
  right: 0.5rem;
  padding: 0 0.5em;
  border: 1px solid var(--wire);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.6rem;
  cursor: pointer;
}

.lens-freeze.on {
  border-color: var(--accent);
  color: var(--accent);
}

.lens-hint {
  position: absolute;
  right: 0.5rem;
  bottom: 0.15rem;
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 0.6rem;
  pointer-events: none;
}
</style>
