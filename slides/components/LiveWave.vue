<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

// A live signal scrolling right to left:
//   <LiveWave :analyser="analyser" :active="on" :recording="recording" />
// Each frame adds one column: the loudest sample since the last frame. The
// newest sound is at the right edge; nothing is kept past the left edge,
// because a stream has no past to go back to. Columns drawn while
// `recording` use the accent color.
const props = defineProps<{ analyser: AnalyserNode; active: boolean; recording?: boolean }>()

// PLACEHOLDER(refine): live wave look
// Seconds shown across the full width.
const WINDOW = 4

interface Column {
  at: number
  peak: number
  recording: boolean
}

const canvas = ref<HTMLCanvasElement>()
let columns: Column[] = []
let data = new Float32Array(0)
let last = 0
let frame = 0

function sample(now: number) {
  const { analyser } = props
  if (data.length !== analyser.fftSize) data = new Float32Array(analyser.fftSize)
  analyser.getFloatTimeDomainData(data)
  // The samples that arrived since the last frame are at the end.
  const fresh = Math.min(data.length, Math.max(1, Math.round(((now - last) / 1000) * analyser.context.sampleRate)))
  let peak = 0
  for (let i = data.length - fresh; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]))
  columns.push({ at: now, peak, recording: !!props.recording })
  columns = columns.filter((c) => now - c.at < WINDOW * 1000)
  last = now
}

function draw(now: number) {
  const el = canvas.value
  if (!el) return
  const scale = devicePixelRatio * 2
  const w = Math.round(el.clientWidth * scale)
  const h = Math.round(el.clientHeight * scale)
  if (!w || !h) return
  if (el.width !== w || el.height !== h) Object.assign(el, { width: w, height: h })
  const g = el.getContext('2d')!
  const style = getComputedStyle(el)
  g.clearRect(0, 0, w, h)

  g.fillStyle = style.getPropertyValue('--wire')
  g.fillRect(0, h / 2 - scale / 2, w, scale)

  const colors = { false: style.getPropertyValue('--signal'), true: style.getPropertyValue('--accent') }
  const x = (at: number) => w - ((now - at) / (WINDOW * 1000)) * w
  for (let i = 0; i < columns.length; i++) {
    const c = columns[i]
    const left = i ? x(columns[i - 1].at) : x(c.at) - scale
    const height = Math.max(scale, c.peak * h * 0.95)
    g.fillStyle = colors[`${c.recording}`]
    g.fillRect(left, (h - height) / 2, Math.max(scale, x(c.at) - left), height)
  }
}

function loop(now: number) {
  sample(now)
  draw(now)
  frame = requestAnimationFrame(loop)
}

watch(
  () => props.active,
  (on) => {
    cancelAnimationFrame(frame)
    columns = []
    if (on) {
      last = performance.now()
      frame = requestAnimationFrame(loop)
    } else draw(performance.now())
  },
)

// Slides that aren't showing have zero size; draw once they're laid out.
const resize = new ResizeObserver(() => draw(performance.now()))
onMounted(() => resize.observe(canvas.value!))
onUnmounted(() => {
  cancelAnimationFrame(frame)
  resize.disconnect()
})
</script>

<template>
  <canvas ref="canvas" class="live-wave" />
</template>

<style scoped>
.live-wave {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
