<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Envelope, EnvelopePosition, TimeSegment } from '../audio/envelope'
import { fractionToTime, GLIDE, timeToFraction } from '../audio/envelope'
import { duration } from '../lib/format'

// A drag-and-drop ADSR curve: <AdsrEditor v-model="env" @commit="play" />
// Four handles: attack (time), decay (time and sustain level), sustain
// (level) and release (time). Emits `commit` when a handle is let go.
// `playhead` draws a dot where a playing note is in its envelope. `compact`
// is for small sizes: only the A D S R letters, drawn bigger, no values or
// key labels. `width` trims the drawing's right edge (the full drawing is
// 1000 wide; compact editors default to COMPACT_WIDTH), for small sizes where
// the longest releases aren't needed; the editor keeps its height, so it draws
// bigger in the same width.
// `--adsr-color` sets the curve and handle color (default `--accent`).
const model = defineModel<Envelope>({ required: true })
const props = defineProps<{ playhead?: EnvelopePosition | null; compact?: boolean; width?: number }>()
// Room for every preset's release, without the empty stretch the longest
// ones need.
const COMPACT_WIDTH = 720
const width = computed(() => props.width ?? (props.compact ? COMPACT_WIDTH : 1000))
const emit = defineEmits<{ commit: [] }>()

// PLACEHOLDER(refine): ADSR editor geometry and look
const X0 = 40
const TOP = 40
const BASE = 250
const HOLD = 150
const WIDTH = { attack: 230, decay: 230, release: 300 }

const toPx = (seg: TimeSegment, t: number) => WIDTH[seg] * timeToFraction(seg, t)
const toTime = (seg: TimeSegment, px: number) => fractionToTime(seg, px / WIDTH[seg])
const yOf = (level: number) => BASE - level * (BASE - TOP)
const levelOf = (y: number) => Math.min(1, Math.max(0, (BASE - y) / (BASE - TOP)))

const pts = computed(() => {
  const { attack, decay, sustain, release } = model.value
  const xA = X0 + toPx('attack', attack)
  const xD = xA + toPx('decay', decay)
  const xS = xD + HOLD
  const xR = xS + toPx('release', release)
  return { xA, xD, xS, xR, yS: yOf(sustain) }
})

// The release is a glide (see noteOff), so it's drawn as a curve: falling
// fast, then easing into silence at the R handle.
const RELEASE_POINTS = 16
const path = computed(() => {
  const { xA, xD, xS, xR, yS } = pts.value
  let release = ''
  for (let i = 1; i < RELEASE_POINTS; i++) {
    const f = i / RELEASE_POINTS
    release += ` L${xS + (xR - xS) * f} ${BASE - (BASE - yS) * Math.exp(-GLIDE * f)}`
  }
  return `M${X0} ${BASE} L${xA} ${TOP} L${xD} ${yS} L${xS} ${yS}${release} L${xR} ${BASE}`
})

type Handle = 'attack' | 'decay' | 'sustain' | 'release'
const handles = computed(() => {
  const { xA, xD, xS, xR, yS } = pts.value
  return [
    { key: 'attack' as const, x: xA, y: TOP },
    { key: 'sustain' as const, x: (xD + xS) / 2, y: yS },
    { key: 'release' as const, x: xR, y: BASE },
    // Last, so it sits on top when decay is 0 and it overlaps attack.
    { key: 'decay' as const, x: xD, y: yS },
  ]
})

// Labels closer than this would overlap their values ("300 ms" is ~54 wide).
const LABEL_GAP = 64

const labels = computed(() => {
  const { xA, xD, xS, xR } = pts.value
  const { attack, decay, sustain, release } = model.value
  // Each label sits under its handle (sustain's is the middle of its line).
  const placed = [
    { key: 'attack', x: xA, letter: 'A', value: duration(attack) },
    { key: 'decay', x: xD, letter: 'D', value: duration(decay) },
    { key: 'sustain', x: (xD + xS) / 2, letter: 'S', value: sustain.toFixed(2) },
    { key: 'release', x: xR, letter: 'R', value: duration(release) },
  ]
  // Short segments bunch the labels up; push each clear of the one before.
  for (let i = 1; i < placed.length; i++) {
    placed[i].x = Math.max(placed[i].x, placed[i - 1].x + LABEL_GAP)
  }
  return placed
})

const playheadPoint = computed(() => {
  const p = props.playhead
  if (!p) return null
  const { xA, xD, xS, xR } = pts.value
  const [from, to] = {
    attack: [X0, xA],
    decay: [xA, xD],
    sustain: [xD, xS],
    release: [xS, xR],
  }[p.phase]
  return { x: from + (to - from) * p.progress, y: yOf(p.level), phase: p.phase }
})

const svg = ref<SVGSVGElement>()
const dragging = ref<Handle | null>(null)

function svgPoint(e: PointerEvent) {
  const m = svg.value!.getScreenCTM()!.inverse()
  return new DOMPoint(e.clientX, e.clientY).matrixTransform(m)
}

function grab(key: Handle, e: PointerEvent) {
  dragging.value = key
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
}

function move(e: PointerEvent) {
  const key = dragging.value
  if (!key) return
  const { x, y } = svgPoint(e)
  const { xA, xD } = pts.value
  const next = { ...model.value }
  if (key === 'attack') next.attack = toTime('attack', x - X0)
  if (key === 'decay') {
    next.decay = toTime('decay', x - xA)
    next.sustain = levelOf(y)
  }
  if (key === 'sustain') next.sustain = levelOf(y)
  if (key === 'release') next.release = toTime('release', x - xD - HOLD)
  model.value = next
}

function drop() {
  if (!dragging.value) return
  dragging.value = null
  emit('commit')
}
</script>

<template>
  <svg
    ref="svg"
    class="adsr-editor"
    :class="{ dragging, compact }"
    :viewBox="`0 0 ${width} 320`"
    role="img"
    aria-label="Envelope editor: attack, decay, sustain, release"
    @pointermove="move"
    @pointerup="drop"
    @pointercancel="drop"
  >
    <line :x1="X0" :y1="BASE" :x2="width - 10" :y2="BASE" class="axis" />
    <line :x1="X0" :y1="BASE" :x2="X0" y2="10" class="axis" />
    <line :x1="pts.xS" y1="20" :x2="pts.xS" :y2="BASE" class="marker" />
    <template v-if="!compact">
      <text :x="X0 + 6" y="24" class="note">key down</text>
      <text :x="pts.xS + 6" y="24" class="note">key up</text>
    </template>

    <path :d="`${path} Z`" class="area" />
    <path :d="path" class="trace" />

    <g v-for="label in labels" :key="label.key" class="label" :class="{ active: playheadPoint?.phase === label.key }">
      <text :x="label.x" :y="BASE + (compact ? 54 : 42)" class="letter">{{ label.letter }}</text>
      <text v-if="!compact" :x="label.x" :y="BASE + 64" class="value">{{ label.value }}</text>
    </g>

    <g v-if="playheadPoint" class="playhead">
      <line :x1="playheadPoint.x" :y1="TOP - 10" :x2="playheadPoint.x" :y2="BASE" />
      <circle :cx="playheadPoint.x" :cy="playheadPoint.y" r="9" />
    </g>

    <g
      v-for="h in handles"
      :key="h.key"
      class="handle"
      :class="[h.key, { held: dragging === h.key }]"
      @pointerdown.prevent="grab(h.key, $event)"
    >
      <circle :cx="h.x" :cy="h.y" r="26" class="hit" />
      <!-- Sustain is a level, not a time: a fader cap that only moves up and down. -->
      <g v-if="h.key === 'sustain'" :transform="`translate(${h.x} ${h.y})`">
        <path d="M-7 -22 L0 -30 L7 -22 M-7 22 L0 30 L7 22" class="chevrons" />
        <g class="fader">
          <rect x="-24" y="-10" width="48" height="20" rx="6" class="dot" />
          <line x1="-12" y1="0" x2="12" y2="0" class="grip" />
        </g>
      </g>
      <circle v-else :cx="h.x" :cy="h.y" r="12" class="dot" />
    </g>
  </svg>
</template>

<style scoped>
.adsr-editor {
  width: 100%;
  touch-action: none;
  user-select: none;
  overflow: visible;
}

.axis {
  stroke: var(--muted);
  stroke-width: 2;
}

.marker {
  stroke: var(--wire);
  stroke-width: 2;
  stroke-dasharray: 6 6;
}

.note {
  fill: var(--muted);
  font-family: var(--font-body);
  font-size: 16px;
}

.area {
  fill: color-mix(in srgb, var(--adsr-color, var(--accent)) 10%, transparent);
}

.trace {
  fill: none;
  stroke: var(--adsr-color, var(--accent));
  stroke-width: 5;
  stroke-linejoin: round;
}

.label text {
  text-anchor: middle;
}

.letter {
  fill: var(--ink);
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 700;
}

.compact .letter {
  font-size: 38px;
}

.value {
  fill: var(--muted);
  font-family: var(--font-mono);
  font-size: 15px;
}

.label.active .letter {
  fill: var(--signal);
}

.playhead line {
  stroke: var(--signal);
  stroke-width: 2;
}

.playhead circle {
  fill: var(--signal);
}

.handle {
  cursor: grab;
}

.handle.attack,
.handle.release {
  cursor: ew-resize;
}

.handle.sustain {
  cursor: ns-resize;
}

.dragging,
.dragging .handle {
  cursor: grabbing;
}

.hit {
  fill: transparent;
}

.dot {
  fill: var(--bg);
  stroke: var(--adsr-color, var(--accent));
  stroke-width: 4;
  transition: r 0.1s;
}

.handle:hover .dot,
.handle.held .dot {
  fill: var(--adsr-color, var(--accent));
  r: 15;
}

.fader {
  transition: scale 0.1s;
}

.handle:hover .fader,
.handle.held .fader {
  scale: 1.2;
}

.grip {
  stroke: var(--adsr-color, var(--accent));
  stroke-width: 3;
  stroke-linecap: round;
}

.handle:hover .grip,
.handle.held .grip {
  stroke: var(--bg);
}

.chevrons {
  fill: none;
  stroke: var(--adsr-color, var(--accent));
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
  transition: opacity 0.1s;
}

.handle:hover .chevrons,
.handle.held .chevrons {
  opacity: 1;
}
</style>
