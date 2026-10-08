<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { fitCanvas } from '../lib/canvas'

// A filter's frequency response over a note's harmonics:
//   <FilterResponse :curve="{ hz, db }" :harmonics="harmonics" :cutoff="cutoff" />
// `curve` is the response in dB at each frequency in `hz`. Each harmonic is a
// bar: its level going in (`db`, faint) and coming out (`out`, solid). The
// x axis is log frequency, 20 Hz to 20 kHz; `cutoff` gets a dot on the curve.
export interface Harmonic {
  hz: number
  db: number
  out: number
}
const props = defineProps<{
  curve: { hz: Float32Array; db: Float32Array }
  harmonics: Harmonic[]
  cutoff: number
}>()

// PLACEHOLDER(refine): response picture look and ranges
const LOW = 20
const HIGH = 20000
const TOP = 24
const BOTTOM = -48
const MARKS = [100, 1000, 10000]

const canvas = ref<HTMLCanvasElement>()

function draw() {
  const fit = fitCanvas(canvas.value)
  if (!fit) return
  const { g, w, h, scale, color } = fit
  const x = (hz: number) => (Math.log(hz / LOW) / Math.log(HIGH / LOW)) * w
  const y = (db: number) => ((TOP - Math.max(BOTTOM, Math.min(TOP, db))) / (TOP - BOTTOM)) * h

  // 0 dB and the decade marks.
  g.strokeStyle = color('--wire')
  g.lineWidth = scale
  g.setLineDash([4 * scale, 4 * scale])
  g.beginPath()
  g.moveTo(0, y(0))
  g.lineTo(w, y(0))
  for (const hz of MARKS) {
    g.moveTo(x(hz), 0)
    g.lineTo(x(hz), h)
  }
  g.stroke()
  g.setLineDash([])
  g.fillStyle = color('--muted')
  g.font = `${11 * scale}px ${color('--font-mono')}`
  g.textBaseline = 'top'
  // Right of each line, or left of it when that would run off the edge.
  for (const hz of MARKS) {
    const text = hz < 1000 ? `${hz}` : `${hz / 1000}k`
    const width = g.measureText(text).width
    const left = x(hz) + 3 * scale + width > w
    g.fillText(text, left ? x(hz) - 3 * scale - width : x(hz) + 3 * scale, 2 * scale)
  }

  // Harmonics: what goes in, faint; what comes out, solid.
  const bar = 1.5 * scale
  for (const { hz, db, out } of props.harmonics) {
    if (hz > HIGH) continue
    g.fillStyle = color('--wire')
    g.globalAlpha = 0.35
    g.fillRect(x(hz) - bar / 2, y(db), bar, h - y(db))
    g.globalAlpha = 1
    g.fillStyle = color('--signal')
    g.fillRect(x(hz) - bar / 2, y(out), bar, h - y(out))
  }

  // The response curve.
  const { hz, db } = props.curve
  g.strokeStyle = color('--accent')
  g.lineWidth = 2.5 * scale
  g.lineJoin = 'round'
  g.beginPath()
  for (let i = 0; i < hz.length; i++) {
    if (i) g.lineTo(x(hz[i]), y(db[i]))
    else g.moveTo(x(hz[i]), y(db[i]))
  }
  g.stroke()

  // The cutoff, on the curve.
  const c = Math.min(HIGH, Math.max(LOW, props.cutoff))
  let i = 0
  while (i < hz.length - 1 && hz[i] < c) i++
  g.fillStyle = color('--accent')
  g.beginPath()
  g.arc(x(c), y(db[i]), 5 * scale, 0, Math.PI * 2)
  g.fill()
}

watch(() => [props.curve, props.harmonics, props.cutoff], draw)

// Slides that aren't showing have zero size; draw once they're laid out.
const resize = new ResizeObserver(draw)
onMounted(() => resize.observe(canvas.value!))
onUnmounted(() => resize.disconnect())
</script>

<template>
  <canvas ref="canvas" class="filter-response" />
</template>

<style scoped>
.filter-response {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
