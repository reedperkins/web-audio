<script setup lang="ts">
import { computed } from 'vue'

// An Akai MPK mini mk2 drawn on the slide, so the room sees what the hands are
// doing: the joystick, 8 pads, 8 knobs and 25 keys, laid out like the real one.
// It only shows what the parent tells it, and emits the same gestures with
// the mouse: drag a knob up or down, hold a pad, play the keys.
//
//   <MpkMini :knobs="[{ label, value }]" :pads="[{ note, label }]"
//            :pads-down="downSet" :keys-down="heldSet" :joystick="{ x, y }"
//            @knob="(i, v) => …" @pad-press="…" @pad-release="…"
//            @press="…" @release="…" />
//
// Knobs are 0–1; joystick x is -1…1 and y is 0…1 (bottom to top). Pads are listed top
// row first, four to a row. `pads-down` and `keys-down` say which notes are
// down: anything with `has(note)`. The default slot goes under the name, top
// left (an extra control of the parent's).
const props = withDefaults(
  defineProps<{
    knobs: { label: string; value: number; accent?: boolean }[]
    pads: { note: number; label: string; dashed?: boolean }[]
    padsDown?: { has(note: number): boolean }
    keysDown?: { has(note: number): boolean }
    joystick?: { x: number; y: number }
    from?: number
  }>(),
  {
    padsDown: () => new Set<number>(),
    keysDown: () => new Set<number>(),
    joystick: () => ({ x: 0, y: 0 }),
    from: 48,
  },
)
const emit = defineEmits<{
  knob: [index: number, value: number]
  padPress: [note: number]
  padRelease: [note: number]
  press: [note: number, velocity: number]
  release: [note: number]
}>()

// Knob drag: up is more, 150 px for the full turn. The knob holds the
// pointer, so the drag ends however the pointer goes (up, cancelled, lost).
let turning: { knob: number; value: number; y: number } | null = null

function grab(i: number, e: PointerEvent) {
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  turning = { knob: i, value: props.knobs[i].value, y: e.clientY }
}

function turn(e: PointerEvent) {
  if (!turning) return
  turning.value = Math.min(1, Math.max(0, turning.value + (turning.y - e.clientY) / 150))
  turning.y = e.clientY
  emit('knob', turning.knob, turning.value)
}

const letGo = () => (turning = null)

// A knob's arc: 270°, clockwise from bottom-left.
function arc(value: number) {
  const r = 15
  const from = (135 * Math.PI) / 180
  const to = from + Math.max(0.001, value) * 1.5 * Math.PI
  const point = (a: number) => `${(20 + r * Math.cos(a)).toFixed(2)} ${(20 + r * Math.sin(a)).toFixed(2)}`
  return `M ${point(from)} A ${r} ${r} 0 ${value > 2 / 3 ? 1 : 0} 1 ${point(to)}`
}
// Where the pointer line on the knob cap points.
function pointer(value: number) {
  const a = ((135 + value * 270) * Math.PI) / 180
  return { x2: 20 + 9 * Math.cos(a), y2: 20 + 9 * Math.sin(a) }
}

// The stick's dot inside its well. x (pitch bend) rests in the middle; y is
// one 0–127 control, so it spans the whole height, 0 at the bottom.
const stick = computed(() => ({
  left: `${50 + props.joystick.x * 38}%`,
  top: `${88 - props.joystick.y * 76}%`,
}))

// Pads hold while the pointer is down, like the key path.
const held = new Set<number>()
function pressPad(note: number) {
  held.add(note)
  emit('padPress', note)
}
function releasePad(note: number) {
  if (!held.delete(note)) return
  emit('padRelease', note)
}
</script>

<template>
  <div class="mpk">
    <div class="mpk-top">
      <div class="mpk-left">
        <span class="mpk-brand">MPK mini</span>
        <slot />
        <div class="mpk-stick" :class="{ moved: Math.abs(joystick.x) > 0.02 || joystick.y > 0.02 }">
          <span class="mpk-cross" />
          <span class="mpk-dot" :style="stick" />
        </div>
      </div>

      <div class="mpk-pads">
        <div
          v-for="p in pads"
          :key="p.note"
          class="mpk-pad"
          :class="{ down: padsDown.has(p.note), dashed: p.dashed }"
          @pointerdown="pressPad(p.note)"
          @pointerup="releasePad(p.note)"
          @pointerleave="releasePad(p.note)"
          @pointercancel="releasePad(p.note)"
        >
          {{ p.label }}
        </div>
      </div>

      <div class="mpk-knobs">
        <div
          v-for="(k, i) in knobs"
          :key="i"
          class="mpk-knob"
          :class="{ accent: k.accent }"
          @pointerdown="grab(i, $event)"
          @pointermove="turn"
          @lostpointercapture="letGo"
        >
          <svg viewBox="0 0 40 40">
            <path class="track" :d="arc(1)" />
            <path class="value" :d="arc(k.value)" />
            <circle class="cap" cx="20" cy="20" r="10" />
            <line class="tick" x1="20" y1="20" v-bind="pointer(k.value)" />
          </svg>
          <span class="mpk-knob-label">K{{ i + 1 }} {{ k.label }}</span>
        </div>
      </div>
    </div>

    <div class="mpk-keys">
      <Keyboard
        :from="from"
        :count="25"
        :down="keysDown"
        @press="(n, v) => emit('press', n, v)"
        @release="(n) => emit('release', n)"
      />
    </div>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): MPK mini look */
.mpk {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.6rem;
  border: 2px solid var(--ink);
  border-radius: 0.6rem;
  background: var(--surface);
  user-select: none;
}

.mpk-top {
  display: grid;
  grid-template-columns: 4.5rem 1fr 1fr;
  gap: 0.8rem;
  align-items: stretch;
}

.mpk-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
}

.mpk-brand {
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-weight: 700;
  white-space: nowrap;
}

.mpk-stick {
  position: relative;
  width: 3.4rem;
  height: 3.4rem;
  border: 2px solid var(--wire);
  border-radius: 50%;
  background: var(--bg);
}

.mpk-stick.moved {
  border-color: var(--accent);
}

.mpk-cross {
  position: absolute;
  inset: 50% 15% auto;
  border-top: 1px dashed var(--wire);
}

.mpk-dot {
  position: absolute;
  width: 1rem;
  height: 1rem;
  translate: -50% -50%;
  border-radius: 50%;
  background: var(--ink);
  transition: left 0.03s, top 0.03s;
}

.mpk-stick.moved .mpk-dot {
  background: var(--accent);
}

.mpk-pads {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.35rem;
}

.mpk-pad {
  aspect-ratio: 1;
  display: grid;
  place-items: end center;
  padding: 0.2rem;
  border: 2px solid var(--ink);
  border-radius: 0.3rem;
  background: var(--bg);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.5rem;
  line-height: 1.1;
  cursor: pointer;
  touch-action: none;
  transition: background 0.05s;
}

.mpk-pad.dashed {
  border-style: dashed;
}

.mpk-pad.down {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--bg);
}

.mpk-knobs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.2rem 0.35rem;
}

.mpk-knob {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: ns-resize;
  touch-action: none;
}

.mpk-knob svg {
  width: 2.6rem;
  height: 2.6rem;
}

.track,
.value {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
}

.track {
  stroke: var(--bg);
}

.value {
  stroke: var(--accent);
}

.mpk-knob.accent .value {
  stroke: var(--signal);
}

.cap {
  fill: var(--ink);
}

.tick {
  stroke: var(--bg);
  stroke-width: 2.5;
  stroke-linecap: round;
}

.mpk-knob-label {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.5rem;
  white-space: nowrap;
}

.mpk-keys {
  height: 4.5rem;
  --key-label-size: 0.45rem;
}
</style>
