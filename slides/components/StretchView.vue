<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Grain, WindowName } from '../audio/grains'
import { GRAIN, fadeOf, hopOf, stretched } from '../audio/grains'
import { fitCanvas } from '../lib/canvas'

// The whole clip before and after stretching, on one time scale:
//   <StretchView :buffer :version v-model:speed :semitones :window :granular
//                :overlap :position :grains />
// Bottom lane: the original. Top lane: what comes out (worked out from the
// same grains). Each grain's window is drawn in both lanes, where it reads
// and where it plays, joined by a line between their starts: stretched out,
// the output's grains drift further behind with each one. With `granular`
// off it's one plain source: grey lines show where points of the original
// land, but the pitch moves too. `position` (seconds into the original) puts
// a playhead in both lanes, and `grains` lights up the ones sounding, with a
// band between the lanes from what each reads to where it plays.
// Dragging sideways stretches: it sets `speed` (v-model:speed).
// Zoomed in, both lanes show the same few grains: the original from `start`,
// the output from where `start` lands. While playing, the playheads scan
// across and the view turns the page when they reach the end; when stopped,
// a click on either lane turns it to there.
// The "stacked" layout draws the grains instead as one row each: a ghost
// over what it reads, a filled window where it plays, and an arrow from one
// start to the other. Down the rows the arrows grow (the drift), and down any
// column you can count the grains reading or playing there (the overlap).
const props = defineProps<{
  buffer?: AudioBuffer
  version?: number
  semitones: number
  window: WindowName
  granular: boolean
  // Off: each grain starts as the last ends, instead of overlapping by half.
  overlap?: boolean
  position?: number | null
  grains?: (Grain & { opacity: number })[]
}>()
const speed = defineModel<number>('speed', { required: true })

// PLACEHOLDER(refine): stretch view look
// Lane edges, as shares of the height: output on top, original below. The
// overlays get the same edges through v-bind() in the styles.
// The strip above the top lane holds the layout and zoom controls.
const TOOLBAR = 0.17
const OUT = [TOOLBAR, 0.46]
const IN = [0.64, 0.94]
const lanes = {
  out: { top: `${OUT[0] * 100}%`, height: `${(OUT[1] - OUT[0]) * 100}%` },
  in: { top: `${IN[0] * 100}%`, height: `${(IN[1] - IN[0]) * 100}%` },
  bridge: { top: `${OUT[1] * 100}%`, height: `${(IN[0] - OUT[1]) * 100}%` },
}
// Samples worked out per pixel column of the output.
const PER_COLUMN = 24

const canvas = ref<HTMLCanvasElement>()

const ratio = computed(() => 2 ** (props.semitones / 12))
// How much longer the output is than the original.
const stretch = computed(() => 1 / (props.granular ? speed.value : speed.value * ratio.value))
const inDur = computed(() => props.buffer?.duration ?? 1)
const outDur = computed(() => inDur.value * stretch.value)
// Seconds across the full width: a fixed scale set by the original, so the
// original holds still and the output grows and shrinks as it stretches. Up
// to FIT× as long; stretched further, the output fills the width and the
// original shrinks instead.
const FIT = 2
const span = computed(() => Math.max(inDur.value * FIT, outDur.value))

// Seconds across the width when zoomed in; null shows everything.
const ZOOMS = [null, 2, 0.5].map((z) => ({ value: z, label: z === null ? 'all' : `${z} s` }))
const zoom = ref<number | null>(null)
// Seconds into the original at the zoomed view's left edge.
const start = ref(0)
const layout = ref<'lanes' | 'stacked'>('lanes')
const LAYOUTS = [
  { value: 'lanes' as const, label: 'lanes' },
  { value: 'stacked' as const, label: 'stacked' },
]
// Stacked: how many rows, and where the top row reads from in the original.
const ROWS = 9
const stackStart = ref(0)
const stacked = computed(() => layout.value === 'stacked' && props.granular)

// Where a time sits in each lane, as a share of the width.
const view = computed(() => {
  if (zoom.value === null) {
    const s = span.value
    return { secs: s, inAt: (p: number) => p / s, outAt: (t: number) => t / s }
  }
  const v = zoom.value
  const c = start.value
  const cOut = c * stretch.value
  return { secs: v, inAt: (p: number) => (p - c) / v, outAt: (t: number) => (t - cOut) / v }
})

// The engine's settings, as the pictures need them.
const settings = computed(() => ({
  speed: speed.value,
  semitones: props.semitones,
  window: props.window,
  overlap: props.overlap ?? true,
}))

watch(() => [props.buffer, props.version, settings.value, props.granular], draw)

function draw() {
  const fit = fitCanvas(canvas.value)
  const buffer = props.buffer
  if (!fit || !buffer) return
  const { g, w: W, h: H, scale, color } = fit
  const colors = [color('--accent'), color('--signal')]
  if (stacked.value) return drawStacked(g, W, H, scale, colors, color)

  const { secs, inAt, outAt } = view.value
  const xIn = (p: number) => inAt(p) * W
  const xOut = (t: number) => outAt(t) * W
  // What's showing of each lane, in its own seconds.
  const inFrom = xIn(0) < 0 ? -xIn(0) * (secs / W) : 0
  const outFrom = xOut(0) < 0 ? -xOut(0) * (secs / W) : 0
  const [outTop, outBottom] = OUT.map((v) => v * H)
  const [inTop, inBottom] = IN.map((v) => v * H)
  const half = (outBottom - outTop) / 2
  const hop = hopOf(settings.value)
  // How far the read position moves from one grain to the next.
  const readHop = speed.value * hop
  const strength = Math.min(1, Math.max(0, ((GRAIN / secs) * W) / (60 * scale)))

  // Drift: a line from where each grain starts reading in the original to
  // where it starts playing in the output. Stretched out, the output's grains
  // fall further behind with every one, so the lines lean more and more. Only
  // the grains near either lane's view, thinned out when they're packed too
  // tight to tell apart. Without grains, the same points of the original,
  // in grey, show where they land.
  const count = Math.ceil(outDur.value / hop)
  const spacing = (hop / secs) * W
  const stride = Math.max(1, Math.ceil((6 * scale) / spacing))
  const first = Math.max(0, Math.floor(Math.min((inFrom - GRAIN) / readHop, (outFrom - GRAIN) / hop)))
  g.lineWidth = scale
  g.globalAlpha = 0.3 + 0.4 * strength
  for (let k = first - (first % stride); k < count; k += stride) {
    const p = k * readHop
    const [xi, xo] = [xIn(p), xOut(p * stretch.value)]
    if (xi > W && xo > W) break
    g.strokeStyle = props.granular ? colors[k % 2] : color('--wire')
    g.beginPath()
    g.moveTo(xi, inTop)
    g.lineTo(xo, outBottom)
    g.stroke()
  }
  g.globalAlpha = 1

  // Both waveforms, min and max per column. `x0` is where time 0 is.
  const wave = (data: Float32Array, sr: number, mid: number, x0: number) => {
    const per = (secs * sr) / W
    for (let col = Math.max(0, Math.floor(x0)); col < W; col++) {
      const i0 = Math.floor((col - x0) * per)
      if (i0 >= data.length) break
      const end = Math.min(data.length, Math.max(i0 + 1, Math.floor((col + 1 - x0) * per)))
      let lo = 0
      let hi = 0
      for (let i = i0; i < end; i++) {
        const v = data[i]
        if (v < lo) lo = v
        else if (v > hi) hi = v
      }
      g.fillRect(col, mid - hi * half * 0.95, 1, Math.max(scale / 2, (hi - lo) * half * 0.95))
    }
  }
  // Drawn last, over the windows and their overlaps, so they stay readable.
  const waves = () => {
    g.globalAlpha = 1
    g.fillStyle = color('--muted')
    wave(buffer.getChannelData(0), buffer.sampleRate, (inTop + inBottom) / 2, xIn(0))

    // The output, worked out for the columns in view: up to PER_COLUMN samples
    // each, enough for the shape without doing every sample of a long clip.
    const at = stretched(buffer, settings.value, props.granular)
    const perCol = secs / W
    const n = Math.max(1, Math.min(PER_COLUMN, Math.round(perCol * buffer.sampleRate)))
    const outEnd = Math.min(W, xOut(outDur.value))
    const outMid = (outTop + outBottom) / 2
    for (let col = Math.max(0, Math.floor(xOut(0))); col < outEnd; col++) {
      const t0 = (col - xOut(0)) * perCol
      let lo = 0
      let hi = 0
      for (let j = 0; j < n; j++) {
        const v = at(t0 + (j / n) * perCol)
        if (v < lo) lo = v
        else if (v > hi) hi = v
      }
      g.fillRect(col, outMid - hi * half * 0.95, 1, Math.max(scale / 2, (hi - lo) * half * 0.95))
    }
  }

  // Every grain's window: over what it reads below, where it plays above.
  // Each is a filled bump on the lane's floor, as a gain: the floor is 0 and
  // the lane's top is 1. Faint when they're packed tight, stronger as zooming
  // spreads them out. The sounding ones are drawn over them, bold.
  if (!props.granular) return waves()
  const fade = fadeOf(settings.value)
  const curve = (x0: number, x1: number, top: number, bottom: number, alpha: number) => {
    g.beginPath()
    g.moveTo(x0, bottom)
    for (let i = 0; i < fade.length; i++)
      g.lineTo(x0 + ((x1 - x0) * i) / (fade.length - 1), bottom - fade[i] * (bottom - top))
    g.lineTo(x1, bottom)
    g.globalAlpha = alpha * 0.25
    g.fill()
    g.globalAlpha = alpha
    g.stroke()
  }
  g.lineWidth = scale * 0.75
  const readSpan = GRAIN * ratio.value
  // The grains in view in either lane.
  const k0 = Math.max(0, Math.floor(Math.min((inFrom - readSpan) / readHop, (outFrom - GRAIN) / hop)))
  for (let k = k0; k < count; k++) {
    const read = k * readHop
    const [r0, o0] = [xIn(read), xOut(k * hop)]
    if (r0 > W && o0 > W) break
    g.strokeStyle = g.fillStyle = colors[k % 2]
    curve(r0, xIn(read + readSpan), inTop, inBottom, 0.12 + 0.4 * strength)
    curve(o0, xOut(k * hop + GRAIN), outTop, outBottom, 0.2 + 0.6 * strength)
  }

  // Where grains overlap in the output, in yellow: the part under the
  // second-highest window, which is where two grains are sounding at once,
  // crossfading. (In the original, overlap means the same audio read by more
  // than one grain; the label says how many times instead.)
  const overlaps = (x0: number, every: number, span: number, top: number, bottom: number) => {
    const from = Math.max(0, Math.floor(x0))
    g.beginPath()
    g.moveTo(from, bottom)
    for (let col = from; col < W; col++) {
      const t = (col - x0) * (secs / W)
      let [a, b] = [0, 0]
      for (
        let k = Math.max(0, Math.floor((t - span) / every) + 1);
        k <= Math.min(count - 1, Math.floor(t / every));
        k++
      ) {
        const v = fade[Math.round(((t - k * every) / span) * (fade.length - 1))]
        if (v > a) [a, b] = [v, a]
        else if (v > b) b = v
      }
      g.lineTo(col, bottom - b * (bottom - top))
    }
    g.lineTo(W, bottom)
    g.fill()
  }
  g.fillStyle = color('--overlap')
  g.globalAlpha = 0.35 + 0.35 * strength
  overlaps(xOut(0), hop, GRAIN, outTop, outBottom)

  // The windows added up, dashed: the output's total gain. Flat at the top
  // means a steady level; Hann's halves fill each other's gaps exactly.
  const last = count - 1
  g.globalAlpha = 0.9
  g.strokeStyle = color('--ink')
  g.lineWidth = scale
  g.setLineDash([4 * scale, 3 * scale])
  g.beginPath()
  const outStart = Math.max(0, Math.floor(xOut(0)))
  const outStop = Math.min(W, xOut(outDur.value))
  for (let col = outStart; col < outStop; col++) {
    const t = (col - xOut(0)) * (secs / W)
    let sum = 0
    for (let k = Math.max(0, Math.floor((t - GRAIN) / hop) + 1); k <= Math.min(last, Math.floor(t / hop)); k++)
      sum += fade[Math.round(((t - k * hop) / GRAIN) * (fade.length - 1))]
    const y = outBottom - sum * (outBottom - outTop)
    if (col === outStart) g.moveTo(col, y)
    else g.lineTo(col, y)
  }
  g.stroke()
  g.setLineDash([])
  g.globalAlpha = 1
  waves()
}

// Stacked: one row per grain, from the one reading at `stackStart`. Read and
// play share one scale, each measured from the top row's start, so row k's
// arrow is k × (hop − readHop) long: how far it's drifted.
function drawStacked(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  scale: number,
  colors: string[],
  color: (name: string) => string,
) {
  const hop = hopOf(settings.value)
  const readHop = speed.value * hop
  const readSpan = GRAIN * ratio.value
  const fade = fadeOf(settings.value)
  const count = Math.ceil(outDur.value / hop)
  const kTop = Math.max(0, Math.round(stackStart.value / readHop))
  const pad = 8 * scale
  const top = H * TOOLBAR
  const rowH = (H * (0.98 - TOOLBAR)) / ROWS
  const secs = Math.max((ROWS - 1) * hop + GRAIN, (ROWS - 1) * readHop + readSpan) * 1.02
  const x = (t: number) => pad + (t / secs) * (W - 2 * pad)
  const lit = new Map((props.grains ?? []).map((gr) => [Math.round(gr.offset / readHop), gr.opacity]))

  const curve = (x0: number, x1: number, y0: number, y1: number) => {
    g.beginPath()
    g.moveTo(x0, y1)
    for (let i = 0; i < fade.length; i++) g.lineTo(x0 + ((x1 - x0) * i) / (fade.length - 1), y1 - fade[i] * (y1 - y0))
    g.lineTo(x1, y1)
    g.closePath()
  }

  for (let i = 0; i < ROWS && kTop + i < count; i++) {
    const k = kTop + i
    const y0 = top + i * rowH
    // The windows sit in the top of the row, the drift arrow under them.
    const peak = y0 + rowH * 0.1
    const base = y0 + rowH * 0.7
    const under = y0 + rowH * 0.88
    const [r0, r1] = [x(i * readHop), x(i * readHop + readSpan)]
    const [p0, p1] = [x(i * hop), x(i * hop + GRAIN)]
    const on = lit.get(k)
    if (on) {
      g.globalAlpha = 0.18 * on
      g.fillStyle = color('--accent')
      g.fillRect(0, y0, W, rowH)
    }
    g.strokeStyle = g.fillStyle = colors[k % 2]
    g.lineWidth = scale
    // Where it plays: filled.
    curve(p0, p1, peak, base)
    g.globalAlpha = 0.35
    g.fill()
    g.globalAlpha = 0.9
    g.stroke()
    // What it reads: a ghost, since that's where the audio comes from, not
    // where it plays.
    curve(r0, r1, peak, base)
    g.globalAlpha = 0.08
    g.fill()
    g.setLineDash([3 * scale, 2 * scale])
    g.globalAlpha = 0.3
    g.stroke()
    g.setLineDash([])
    // The drift: down from where it starts reading, along under the row,
    // and up into where it starts playing.
    if (Math.abs(p0 - r0) > 4 * scale) {
      g.strokeStyle = g.fillStyle = color('--ink')
      g.globalAlpha = 0.7
      g.beginPath()
      g.moveTo(r0, base)
      g.lineTo(r0, under)
      g.lineTo(p0, under)
      g.lineTo(p0, base + 3 * scale)
      g.stroke()
      g.beginPath()
      g.moveTo(p0, base)
      g.lineTo(p0 - 2.5 * scale, base + 4 * scale)
      g.lineTo(p0 + 2.5 * scale, base + 4 * scale)
      g.fill()
    }
  }

  // Playheads: dashed where it's reading, solid where it's playing.
  const p = props.position
  if (p != null) {
    g.globalAlpha = 0.8
    g.strokeStyle = color('--ink')
    g.lineWidth = scale
    for (const [t, dash] of [
      [p - kTop * readHop, true],
      [p * stretch.value - kTop * hop, false],
    ] as const) {
      g.setLineDash(dash ? [4 * scale, 3 * scale] : [])
      g.beginPath()
      g.moveTo(x(t), top)
      g.lineTo(x(t), H)
      g.stroke()
    }
    g.setLineDash([])
  }
  g.globalAlpha = 1
}

// Stacked, the rows follow playback and stepping: when the current grain
// leaves them, the next row of grains starts one before it.
function pageRows() {
  const p = props.position
  if (p == null || !stacked.value) return
  const readHop = speed.value * hopOf(settings.value)
  const k = Math.floor(p / readHop + 1e-6)
  const kTop = Math.round(stackStart.value / readHop)
  if (k < kTop || k >= kTop + ROWS) stackStart.value = Math.max(0, k - 1) * readHop
}

// Overlays, in percent of the width: the playhead and the sounding grains.
const pct = (share: number) => `${share * 100}%`
const playheads = computed(() => {
  if (props.position == null || !props.buffer) return null
  const { inAt, outAt } = view.value
  return { in: pct(inAt(props.position)), out: pct(outAt(props.position * stretch.value)) }
})
const lit = computed(() => {
  const { secs, inAt, outAt } = view.value
  return (props.grains ?? []).map((gr) => ({
    in: {
      left: pct(inAt(gr.offset)),
      width: pct(Math.min(gr.span, inDur.value - gr.offset) / secs),
    },
    out: { left: pct(outAt(gr.offset * stretch.value)), width: pct(GRAIN / secs) },
    // The band between the lanes, as an SVG polygon in percent.
    band: [
      [inAt(gr.offset), 100],
      [inAt(gr.offset + Math.min(gr.span, inDur.value - gr.offset)), 100],
      [outAt(gr.offset * stretch.value + GRAIN), 0],
      [outAt(gr.offset * stretch.value), 0],
    ]
      .map(([x, y]) => `${x * 100},${y}`)
      .join(' '),
    opacity: gr.opacity,
  }))
})

// The window's shape, for drawing inside each sounding grain.
const shape = computed(() => {
  const fade = fadeOf(settings.value)
  return Array.from(fade, (v, i) => `${(i / (fade.length - 1)) * 100},${100 - v * 100}`).join(' ')
})

const fmt = (s: number) => `${s.toFixed(1)} s`
const ms = (s: number) => `${Math.round(s * 1000)} ms`
const semis = (n: number) => `${n > 0 ? '+' : ''}${n}`
// Each lane's name and details, beside it on the left.
const labels = computed(() => ({
  out: {
    name: 'output',
    details: [
      fmt(outDur.value),
      `${stretch.value.toFixed(2)}× as long`,
      ...(props.granular ? [`grains ${ms(hopOf(settings.value))} apart`] : []),
      !props.granular ? 'pitch moves' : props.semitones ? `pitch ${semis(props.semitones)}` : 'same pitch',
    ],
  },
  in: {
    name: 'original',
    details: [
      fmt(inDur.value),
      ...(props.granular ? [`grains ${ms(speed.value * hopOf(settings.value))} apart`, reads.value] : []),
    ],
  },
}))

// How many grains read each bit of the original: more than once when slowed
// down (the same audio played again), less than once when sped up past the
// point where grains stop touching.
const reads = computed(() => {
  const n = (GRAIN * ratio.value) / (speed.value * hopOf(settings.value))
  if (n < 0.999) return 'some skipped'
  const whole = Math.round(n)
  return `each bit read ${Math.abs(n - whole) < 0.05 ? whole : `~${n.toFixed(1)}`}×`
})

const legend = computed(() => ({
  name: 'grains',
  details: ['one per row', 'ghost: reads from', 'solid: plays at', '→ drift', reads.value],
}))

// Drag sideways to stretch: right is slower (longer), left faster. Doubles
// every STRETCH_PX.
const STRETCH_PX = 160
const MIN_SPEED = 0.25
const MAX_SPEED = 2
let dragX: number | null = null
let dragSpeed = 1

let moved = false

function grab(e: PointerEvent) {
  dragX = e.clientX
  moved = false
  dragSpeed = speed.value
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function drag(e: PointerEvent) {
  if (dragX === null) return
  const box = canvas.value!.getBoundingClientRect()
  // In slide pixels, so the slide's scaling doesn't change the feel.
  const dx = ((e.clientX - dragX) / box.width) * canvas.value!.clientWidth
  if (Math.abs(dx) < 4 && !moved) return
  moved = true
  const next = Math.min(MAX_SPEED, Math.max(MIN_SPEED, dragSpeed * 2 ** (-dx / STRETCH_PX)))
  speed.value = Math.round(next * 20) / 20
}

// A click without a drag, zoomed in: turn the page to there, in the lane
// clicked.
function drop(e: PointerEvent) {
  if (dragX !== null && !moved && zoom.value !== null && !stacked.value) {
    const box = canvas.value!.getBoundingClientRect()
    const share = (e.clientX - box.left) / box.width
    const inOutput = e.clientY - box.top < box.height * ((OUT[1] + IN[0]) / 2)
    const at = start.value + share * zoom.value * (inOutput ? 1 / stretch.value : 1)
    turnTo(Math.min(inDur.value, Math.max(0, at)))
  }
  dragX = null
}

// Open zoomed views where the clip gets loud, so there's something to see.
function loudStart(buffer: AudioBuffer) {
  const data = buffer.getChannelData(0)
  const peak = data.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  const i = data.findIndex((v) => Math.abs(v) > peak * 0.4)
  return Math.max(0, i / buffer.sampleRate)
}

watch(
  () => [props.buffer, props.version],
  () => {
    if (props.buffer) start.value = Math.max(0, loudStart(props.buffer) - 0.02)
  },
  { immediate: true },
)
// Zoomed in while playing, the view holds still and the playheads scan
// across it. When the faster of the two (the output's, when it's stretched
// out) reaches EDGE, or playback loops back past the left side, the view
// turns the page: the playhead starts again near the left.
const EDGE = 0.95
const START = 0.05
// Seconds of the original that the faster playhead crosses the view in.
const pageSecs = () => zoom.value! / Math.max(1, stretch.value)
const turnTo = (p: number) => (start.value = p - START * pageSecs())

function page(force = false) {
  const p = props.position
  if (p == null || zoom.value === null) return
  const at = (p - start.value) / pageSecs()
  if (force || at > EDGE || at < 0) turnTo(p)
}
watch(
  () => props.position,
  () => page(),
)
watch(zoom, () => page(true))
watch([zoom, start], draw)
watch(
  () => props.position,
  () => pageRows(),
)
watch(stacked, (on) => {
  if (on) stackStart.value = props.position ?? start.value
  pageRows()
  draw()
})
// Stacked draws the sounding grains and playheads itself.
watch([() => props.grains, () => props.position, stackStart], () => {
  if (stacked.value) draw()
})

// Slides that aren't showing have zero size; draw once they're laid out.
const resize = new ResizeObserver(draw)
onMounted(() => {
  resize.observe(canvas.value!)
})
onUnmounted(() => resize.disconnect())
</script>

<template>
  <div class="stretch-view">
    <div class="labels">
      <div v-if="stacked" class="label all">
        <span class="name">{{ legend.name }}</span>
        <span v-for="d in legend.details" :key="d">{{ d }}</span>
      </div>
      <div v-for="(label, lane) in labels" v-else :key="lane" class="label" :class="lane">
        <span class="name">{{ label.name }}</span>
        <span v-for="d in label.details" :key="d">{{ d }}</span>
      </div>
    </div>
    <div class="lanes" @pointerdown="grab" @pointermove="drag" @pointerup="drop" @pointercancel="drop">
      <canvas ref="canvas" />
      <template v-if="!stacked">
        <svg class="bridge" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon v-for="(g, i) in lit" :key="i" :points="g.band" :style="{ opacity: g.opacity }" />
        </svg>
        <template v-for="(g, i) in lit" :key="i">
          <div
            v-for="lane in ['out', 'in'] as const"
            :key="lane"
            class="lit"
            :class="lane"
            :style="{ ...g[lane], opacity: g.opacity }"
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline :points="shape" />
            </svg>
          </div>
        </template>
        <template v-if="playheads">
          <div class="playhead out" :style="{ left: playheads.out }" />
          <div class="playhead in" :style="{ left: playheads.in }" />
        </template>
      </template>
      <div class="zooms" @pointerdown.stop>
        <template v-if="granular">
          <Segmented v-model="layout" class="zoom-chips" size="sm" :options="LAYOUTS" />
        </template>
        <Segmented v-if="!stacked" v-model="zoom" label="zoom" class="zoom-chips gap" size="sm" :options="ZOOMS" />
      </div>
      <span class="hint">↔ drag to stretch<template v-if="zoom !== null && !stacked"> · click to move</template></span>
    </div>
  </div>
</template>

<style scoped>
.stretch-view {
  display: flex;
  gap: 0.5rem;
}

.labels {
  position: relative;
  width: 6.5rem;
  flex-shrink: 0;
}

.label {
  position: absolute;
  right: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-end;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.55rem;
  line-height: 1.3;
  text-align: right;
}

.label.all {
  top: 17%;
  height: 81%;
  justify-content: flex-start;
  padding-top: 0.5rem;
}

.label .name {
  color: var(--ink);
  font-size: 0.75rem;
  font-weight: 600;
}

.lanes {
  position: relative;
  flex: 1;
  min-width: 0;
  border-radius: 0.4rem;
  overflow: hidden;
  background: var(--surface);
  cursor: ew-resize;
  touch-action: none;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* Between the lanes: from OUT's bottom to IN's top. */
.bridge {
  position: absolute;
  top: v-bind('lanes.bridge.top');
  left: 0;
  width: 100%;
  height: v-bind('lanes.bridge.height');
  overflow: visible;
  pointer-events: none;
}

.bridge polygon {
  fill: color-mix(in srgb, var(--accent) 30%, transparent);
  stroke: var(--accent);
  stroke-width: 2px;
  vector-effect: non-scaling-stroke;
}

.out {
  top: v-bind('lanes.out.top');
  height: v-bind('lanes.out.height');
}

.in {
  top: v-bind('lanes.in.top');
  height: v-bind('lanes.in.height');
}

.lit,
.playhead {
  position: absolute;
  pointer-events: none;
}

.lit {
  min-width: 3px;
  background: color-mix(in srgb, var(--accent) 30%, transparent);
}

.lit svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  color: var(--accent);
}

.lit polyline {
  fill: none;
  stroke: currentColor;
  stroke-width: 2px;
  vector-effect: non-scaling-stroke;
}

/* Where the grain starts and stops, standing out past the lane's edges. */
.lit::before,
.lit::after {
  content: '';
  position: absolute;
  top: -0.3rem;
  bottom: -0.3rem;
  width: 2px;
  background: var(--accent);
}

.lit::before {
  left: -1px;
}

.lit::after {
  right: -1px;
}

.playhead {
  width: 2px;
  margin-left: -1px;
  background: var(--ink);
}

.zooms {
  position: absolute;
  top: 0.4rem;
  left: 0.5rem;
  display: flex;
  gap: 0.25rem;
  align-items: center;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.55rem;
  cursor: default;
}

.zooms .gap {
  margin-left: 0.9rem;
}

.zoom-chips {
  font-size: inherit;
}

.hint {
  position: absolute;
  right: 0.5rem;
  top: 0.4rem;
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 0.6rem;
  pointer-events: none;
}
</style>
