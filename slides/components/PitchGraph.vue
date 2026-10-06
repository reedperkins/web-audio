<script setup lang="ts">
import { computed, ref } from 'vue'
import { held } from '../audio/input'
import { mtof } from '../audio/mtof'

// 5b: the `mtof` curve, MIDI note across, Hz up (linear, so the curve bends).
// A dot on every A (keyed off A 440 = note 69) shows the doubling with
// whole numbers: 55, 110, 220, 440, 880, 1760. Held notes, and the note under the
// pointer, get a dot on the curve with their frequency.
// The Linear / Log toggle switches the Hz axis. On a log axis every octave is
// the same height, so the curve straightens into a line: equal steps in note
// number are equal ratios in frequency. The switch animates between the two
// in CSS: the curve and guides by their `d` path, the dots by `cy`, the labels
// by `translate`, and each axis's ticks fade. Every path keeps the same
// commands on both axes, which is what lets `d` transition.
// PLACEHOLDER(refine): graph look
const FROM = 33
const TO = 93
const MAX_HZ = 1900
// The log axis spans 50–2600 Hz so its top tick (1760) clears the unit label.
const LOG_HZ = { min: 50, max: 2600 }
const W = 460
const H = 228
const M = { left: 52, right: 14, top: 12, bottom: 34 }
const plotW = W - M.left - M.right
const plotH = H - M.top - M.bottom

const x = (note: number) => M.left + ((note - FROM) / (TO - FROM)) * plotW
const yLinear = (hz: number) => M.top + plotH * (1 - hz / MAX_HZ)
const yLog = (hz: number) =>
  M.top + plotH * (1 - Math.log2(hz / LOG_HZ.min) / Math.log2(LOG_HZ.max / LOG_HZ.min))

const scale = ref<'linear' | 'log'>('linear')
const SCALES = [
  { value: 'linear' as const, label: 'Linear' },
  { value: 'log' as const, label: 'Log' },
]
const y = (hz: number) => (scale.value === 'log' ? yLog(hz) : yLinear(hz))

// Inline styles for the animated geometry.
const d = (path: string) => ({ d: `path('${path}')` })
const cy = (py: number) => ({ cy: `${py}px` })
const at = (py: number) => ({ translate: `0 ${py}px` })

const curve = computed(() =>
  Array.from({ length: (TO - FROM) * 4 + 1 }, (_, i) => FROM + i / 4)
    .map((n, i) => `${i ? 'L' : 'M'}${x(n).toFixed(1)},${y(mtof(n)).toFixed(1)}`)
    .join(''),
)
const as = Array.from({ length: (TO - FROM) / 12 + 1 }, (_, i) => FROM + i * 12)
// Each axis has its own ticks; they cross-fade during the switch.
const linearTicks = [0, 500, 1000, 1500]
const logTicks = as.map(mtof)

const hovered = ref<number | null>(null)
const svg = ref<SVGSVGElement>()
function hover(e: PointerEvent) {
  const box = svg.value!.getBoundingClientRect()
  const note = Math.round(FROM + (((e.clientX - box.left) / box.width) * W - M.left) / plotW * (TO - FROM))
  hovered.value = note >= FROM && note <= TO ? note : null
}

// Held notes win over the hovered one; the newest held note gets the label,
// in the empty space under the curve (or above it, near the right edge).
const marks = computed(() => {
  const notes = [...held.keys()].filter((n) => n >= FROM && n <= TO)
  if (!notes.length && hovered.value !== null) notes.push(hovered.value)
  return notes.map((note, i) => {
    const hz = mtof(note)
    const px = x(note)
    const py = y(hz)
    // Down from the dot to the note axis, and across to the Hz axis.
    const guide = `M${px.toFixed(1)},${py.toFixed(1)}L${px.toFixed(1)},${H - M.bottom}M${M.left},${py.toFixed(1)}L${px.toFixed(1)},${py.toFixed(1)}`
    return { note, hz, px, py, guide, labelled: i === notes.length - 1, flip: px > W - 140 }
  })
})
</script>

<template>
  <div class="pitch-graph-wrap">
    <Segmented v-model="scale" class="scale-toggle" :options="SCALES" aria-label="Hz axis" />
    <svg
      ref="svg"
      class="pitch-graph"
      :class="scale"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      aria-label="Frequency doubles every 12 MIDI notes"
      @pointermove="hover"
      @pointerleave="hovered = null"
    >
      <g class="grid on-linear">
        <line v-for="hz in linearTicks" :key="hz" :x1="M.left" :x2="W - M.right" :y1="yLinear(hz)" :y2="yLinear(hz)" />
      </g>
      <g class="grid on-log">
        <line v-for="hz in logTicks" :key="hz" :x1="M.left" :x2="W - M.right" :y1="yLog(hz)" :y2="yLog(hz)" />
      </g>
      <g class="axis">
        <g class="on-linear">
          <text v-for="hz in linearTicks" :key="hz" :x="M.left - 8" :y="yLinear(hz) + 4" text-anchor="end">{{ hz }}</text>
        </g>
        <g class="on-log">
          <text v-for="hz in logTicks" :key="hz" :x="M.left - 8" :y="yLog(hz) + 4" text-anchor="end">{{ hz }}</text>
        </g>
        <text :x="M.left - 8" :y="M.top - 1" text-anchor="end" class="unit">Hz</text>
        <text v-for="n in as" :key="n" :x="x(n)" :y="H - M.bottom + 18" text-anchor="middle">{{ n }}</text>
        <text :x="W - M.right" :y="H - 2" text-anchor="end" class="unit">MIDI note</text>
      </g>

      <path v-for="m in marks" :key="m.note" class="guide" :style="d(m.guide)" />

      <path class="curve" :style="d(curve)" />

      <g v-for="n in as" :key="n" class="octave">
        <circle :cx="x(n)" r="4.5" :style="cy(y(mtof(n)))" />
        <!-- On the log axis the tick labels already name every A. -->
        <text v-if="n >= 45" class="on-linear" :x="x(n) - 8" y="-6" text-anchor="end" :style="at(y(mtof(n)))">
          {{ Math.round(mtof(n)) }}
        </text>
      </g>

      <g v-for="m in marks" :key="m.note" class="mark">
        <circle :cx="m.px" r="7" :style="cy(m.py)" />
        <text
          v-if="m.labelled"
          :x="m.px + (m.flip ? -12 : 12)"
          :y="m.flip ? -10 : 24"
          :text-anchor="m.flip ? 'end' : 'start'"
          :style="at(m.py)"
        >{{ m.note }} → {{ m.hz.toFixed(1) }} Hz</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.pitch-graph-wrap {
  position: relative;
}

.pitch-graph {
  width: 100%;
  overflow: visible;
  font-family: var(--font-mono);
}

.scale-toggle {
  position: absolute;
  top: -0.2rem;
  left: 3.5rem;
  font-family: var(--font-body);
}

/* The Linear / Log switch: everything that moves, moves together. */
.pitch-graph path,
.pitch-graph circle,
.pitch-graph text,
.on-linear,
.on-log {
  transition:
    d 0.6s ease-in-out,
    cy 0.6s ease-in-out,
    translate 0.6s ease-in-out,
    opacity 0.6s ease-in-out;
}

.pitch-graph.log .on-linear,
.pitch-graph.linear .on-log {
  opacity: 0;
}

.grid line {
  stroke: var(--surface);
  stroke-width: 1.5;
}

.axis text {
  fill: var(--muted);
  font-size: 13px;
}

.axis .unit {
  font-family: var(--font-body);
  font-size: 12px;
}

.curve {
  fill: none;
  stroke: var(--ink);
  stroke-width: 2.5;
  stroke-linecap: round;
}

.octave circle {
  fill: var(--bg);
  stroke: var(--ink);
  stroke-width: 2;
}

.octave text {
  fill: var(--muted);
  font-size: 13px;
  paint-order: stroke;
  stroke: var(--bg);
  stroke-width: 4px;
  stroke-linejoin: round;
}

.guide {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.5;
  stroke-dasharray: 3 4;
}

.mark circle {
  fill: var(--accent);
  stroke: var(--bg);
  stroke-width: 2;
}

.mark text {
  fill: var(--ink);
  font-size: 15px;
  font-weight: 700;
  paint-order: stroke;
  stroke: var(--bg);
  stroke-width: 5px;
  stroke-linejoin: round;
}
</style>
