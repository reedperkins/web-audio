<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { held } from '../audio/input'
import { mtof } from '../audio/mtof'
import { vNoFocus } from '../audio/useDemo'

// 5b: the `mtof` curve, MIDI note across, Hz up (linear, so the curve bends).
// A dot on every A (keyed off A 440 = note 69) shows the doubling with
// whole numbers: 55, 110, 220, 440, 880, 1760. Held notes, and the note under the
// pointer, get a dot on the curve with their frequency.
// The Linear / Log toggle switches the Hz axis. On a log axis every octave is
// the same height, so the curve straightens into a line: equal steps in note
// number are equal ratios in frequency. The switch animates between the two.
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

// 0 = linear axis, 1 = log axis; in between while the switch animates.
const log = ref(false)
const mix = ref(0)
const y = (hz: number) => yLinear(hz) + (yLog(hz) - yLinear(hz)) * mix.value

const MORPH_MS = 600
let frame = 0
watch(log, (on) => {
  cancelAnimationFrame(frame)
  const start = performance.now()
  const from = mix.value
  const to = on ? 1 : 0
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / MORPH_MS)
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    mix.value = from + (to - from) * eased
    if (t < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
})
onUnmounted(() => cancelAnimationFrame(frame))

const curve = computed(() =>
  Array.from({ length: (TO - FROM) * 4 + 1 }, (_, i) => FROM + i / 4)
    .map((n, i) => `${i ? 'L' : 'M'}${x(n).toFixed(1)},${y(mtof(n)).toFixed(1)}`)
    .join(''),
)
const as = Array.from({ length: (TO - FROM) / 12 + 1 }, (_, i) => FROM + i * 12)
// Each axis has its own ticks; they cross-fade during the switch. (Opacity is
// set as a style: Slidev's UnoCSS reads an `opacity` attribute as a utility.)
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
    return { note, hz, px, py: y(hz), labelled: i === notes.length - 1, flip: px > W - 140 }
  })
})
</script>

<template>
  <div class="pitch-graph-wrap">
    <div class="scale-toggle" role="group" aria-label="Hz axis">
      <button v-no-focus :class="{ on: !log }" @click="log = false">Linear</button>
      <button v-no-focus :class="{ on: log }" @click="log = true">Log</button>
    </div>
    <svg
      ref="svg"
      class="pitch-graph"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      aria-label="Frequency doubles every 12 MIDI notes"
      @pointermove="hover"
      @pointerleave="hovered = null"
    >
      <g class="grid" :style="{ opacity: 1 - mix }">
        <line v-for="hz in linearTicks" :key="hz" :x1="M.left" :x2="W - M.right" :y1="yLinear(hz)" :y2="yLinear(hz)" />
      </g>
      <g class="grid" :style="{ opacity: mix }">
        <line v-for="hz in logTicks" :key="hz" :x1="M.left" :x2="W - M.right" :y1="yLog(hz)" :y2="yLog(hz)" />
      </g>
      <g class="axis">
        <g :style="{ opacity: 1 - mix }">
          <text v-for="hz in linearTicks" :key="hz" :x="M.left - 8" :y="yLinear(hz) + 4" text-anchor="end">{{ hz }}</text>
        </g>
        <g :style="{ opacity: mix }">
          <text v-for="hz in logTicks" :key="hz" :x="M.left - 8" :y="yLog(hz) + 4" text-anchor="end">{{ hz }}</text>
        </g>
        <text :x="M.left - 8" :y="M.top - 1" text-anchor="end" class="unit">Hz</text>
        <text v-for="n in as" :key="n" :x="x(n)" :y="H - M.bottom + 18" text-anchor="middle">{{ n }}</text>
        <text :x="W - M.right" :y="H - 2" text-anchor="end" class="unit">MIDI note</text>
      </g>

      <g v-for="m in marks" :key="m.note" class="guide">
        <line :x1="m.px" :x2="m.px" :y1="m.py" :y2="H - M.bottom" />
        <line :x1="M.left" :x2="m.px" :y1="m.py" :y2="m.py" />
      </g>

      <path :d="curve" class="curve" />

      <g v-for="n in as" :key="n" class="octave">
        <circle :cx="x(n)" :cy="y(mtof(n))" r="4.5" />
        <!-- On the log axis the tick labels already name every A. -->
        <text v-if="n >= 45" :style="{ opacity: 1 - mix }" :x="x(n) - 8" :y="y(mtof(n)) - 6" text-anchor="end">{{ Math.round(mtof(n)) }}</text>
      </g>

      <g v-for="m in marks" :key="m.note" class="mark">
        <circle :cx="m.px" :cy="m.py" r="7" />
        <text
          v-if="m.labelled"
          :x="m.px + (m.flip ? -12 : 12)"
          :y="m.py + (m.flip ? -10 : 24)"
          :text-anchor="m.flip ? 'end' : 'start'"
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
  display: flex;
  border: 1px solid var(--wire);
  border-radius: 999px;
  overflow: hidden;
}

.scale-toggle button {
  padding: 0.1em 0.8em;
  border: none;
  background: none;
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 0.7rem;
  cursor: pointer;
}

.scale-toggle button.on {
  background: var(--ink);
  color: var(--bg);
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

.guide line {
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
