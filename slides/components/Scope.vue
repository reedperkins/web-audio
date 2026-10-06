<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { fitCanvas } from '../lib/canvas'

// A live oscilloscope: <Scope :analyser="analyser" :active="playing" />
// Draws only while `active`. Each frame starts at a rising zero crossing and
// shows about PERIODS cycles, scaled to the recent peak, so the shape holds
// still and stays readable at any pitch or level.
const props = defineProps<{ analyser: AnalyserNode; active: boolean }>()

// PLACEHOLDER(refine): scope look
const PERIODS = 3
const MIN_PEAK = 0.02

const canvas = ref<HTMLCanvasElement>()
let frame = 0
let peak = MIN_PEAK
let data = new Float32Array(0)

function risingCrossings(from: number, threshold: number) {
  const found: number[] = []
  let armed = false
  for (let i = from; i < data.length && found.length < 2; i++) {
    if (data[i] < -threshold) armed = true
    else if (armed && data[i] >= 0) {
      found.push(i)
      armed = false
    }
  }
  return found
}

function draw(live: boolean) {
  const fit = fitCanvas(canvas.value)
  if (!fit) return
  const { g, w, h, scale, color } = fit

  g.strokeStyle = color('--wire')
  g.lineWidth = scale
  g.setLineDash([4 * scale, 4 * scale])
  g.beginPath()
  g.moveTo(0, h / 2)
  g.lineTo(w, h / 2)
  g.stroke()
  g.setLineDash([])
  if (!live) return

  if (data.length !== props.analyser.fftSize) data = new Float32Array(props.analyser.fftSize)
  props.analyser.getFloatTimeDomainData(data)
  const max = data.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  peak = Math.max(MIN_PEAK, max, peak * 0.95)
  if (max < MIN_PEAK) return

  // Two rising crossings give the start and one period.
  const [start = 0, second] = risingCrossings(0, peak * 0.1)
  const period = second === undefined ? data.length / 4 : second - start
  const length = Math.min(data.length - start, Math.max(64, period * PERIODS))

  g.strokeStyle = color('--signal')
  g.lineWidth = 2.5 * scale
  g.lineJoin = 'round'
  g.beginPath()
  for (let i = 0; i < length; i++) {
    const x = (i / (length - 1)) * w
    const y = h / 2 - (data[start + i] / peak) * (h / 2) * 0.85
    if (i) g.lineTo(x, y)
    else g.moveTo(x, y)
  }
  g.stroke()
}

function loop() {
  draw(true)
  frame = requestAnimationFrame(loop)
}

watch(
  () => props.active,
  (on) => {
    cancelAnimationFrame(frame)
    if (on) loop()
    else {
      peak = MIN_PEAK
      draw(false)
    }
  },
)

// Slides that aren't showing have zero size; draw the idle line once they're
// laid out. While active, the loop redraws every frame anyway.
const resize = new ResizeObserver(() => props.active || draw(false))
onMounted(() => resize.observe(canvas.value!))
onUnmounted(() => {
  cancelAnimationFrame(frame)
  resize.disconnect()
})
</script>

<template>
  <canvas ref="canvas" class="scope" />
</template>

<style scoped>
.scope {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
