<script setup lang="ts">
import { computed, markRaw, reactive, ref, shallowRef } from 'vue'
import { unlock } from '../audio/audio'
import { midi, noteName, onNote, pressKey, releaseKey } from '../audio/input'
import type { Hit, PitchMode } from '../audio/pads'
import { copyRegion, CUT, hit, RELEASE } from '../audio/pads'
import { load, picked as clip } from '../audio/samples'
import { useDemo, vNoFocus } from '../audio/useDemo'
import type { LoopRegion } from './BufferView.vue'

// The "Sample pads" slide. Drag across the clip to mark a region, then
// "→ pad" copies it (the slide's `copyRegion`) onto the selected pad. Every
// key plays the selected pad chromatically, C4 as recorded (or, while that
// pad is empty, the marked region straight from the clip). Held keys sound
// until let go. `pitch` picks how: a plain source (`detune`: higher is
// shorter) or grains (every key as long). Clicking a pad selects it and
// plays it at C4 through the same keys path.
//
// While the on-screen keyboard is open the root has `keys-open`, so the slide
// can make room for it (the slide's own style hides the code).

const PADS = 4
const ROOT = 60
const CLICK_SOURCE = 'Pads'

interface Pad {
  buffer: AudioBuffer | null
  // Where it came from, for the tooltip.
  from: string
}
const pads = reactive<Pad[]>(Array.from({ length: PADS }, () => ({ buffer: null, from: '' })))
const selected = ref(0)
const pitch = ref<PitchMode>('grains')

const buffer = computed(() => clip.value.buffer)
// Each clip keeps its own selection; a new one starts on the second quarter.
const regions = reactive(new Map<string, LoopRegion>())
const region = computed<LoopRegion>({
  get() {
    const duration = buffer.value?.duration ?? 1
    return regions.get(clip.value.id) ?? { start: duration / 4, end: duration / 2 }
  },
  set: (value) => regions.set(clip.value.id, value),
})

// What's sounding, by key (or 'preview' for the ▶ button), and where each
// one is, for its playhead. `pad` is -1 for the marked region, which plays
// from `from` in the clip.
interface Voice {
  pad: number
  from: number
  note: number | null
  hit: Hit
}
type Key = number | 'preview'
const voices = new Map<Key, Voice>()
const heads = shallowRef<{ key: Key; pad: number; from: number; note: number | null; at: number }[]>([])
let frame = 0
let active = false
let stopListening: (() => void) | null = null

const { out } = useDemo({
  enter() {
    active = true
    stopListening = onNote({ noteOn, noteOff })
  },
  leave() {
    active = false
    stopListening?.()
    stopListening = null
    stopAll()
  },
})

function follow() {
  const now = []
  for (const [key, v] of voices) {
    const at = v.hit.position()
    if (at == null) voices.delete(key)
    else now.push({ key, pad: v.pad, from: v.from, note: v.note, at })
  }
  heads.value = now
  frame = voices.size ? requestAnimationFrame(follow) : 0
}

// The same key again cuts the last hit short.
function start(key: Key, voice: Voice) {
  voices.get(key)?.hit.stop(CUT)
  voices.set(key, voice)
  if (!frame) frame = requestAnimationFrame(follow)
}

function stopAll() {
  for (const v of voices.values()) v.hit.stop(CUT)
  voices.clear()
  cancelAnimationFrame(frame)
  frame = 0
  heads.value = []
}

function noteOn(note: number, velocity: number) {
  if (!active) return
  const semitones = note - ROOT
  const pad = pads[selected.value].buffer
  if (pad) {
    start(note, { pad: selected.value, from: 0, note, hit: hit(pad, out.value, semitones, velocity, pitch.value) })
    return
  }
  // An empty pad: play what's marked, straight from the clip.
  if (!buffer.value) return
  const { start: from, end } = region.value
  const marked = copyRegion(buffer.value, from, end)
  start(note, { pad: -1, from, note, hit: hit(marked, out.value, semitones, velocity, pitch.value) })
}

function noteOff(note: number) {
  voices.get(note)?.hit.stop(RELEASE)
  voices.delete(note)
}

// A click goes through the keys path too, so it unlocks audio and shows on
// the on-screen keyboard.
let clicked = false
function padDown(i: number) {
  selected.value = i
  clicked = true
  pressKey(ROOT, 100, CLICK_SOURCE)
}
function padUp() {
  if (!clicked) return
  releaseKey(ROOT, CLICK_SOURCE)
  clicked = false
}

async function preview() {
  await unlock()
  const source = await load(clip.value)
  if (!active) return
  const { start: from, end } = region.value
  const pad = copyRegion(source, from, end)
  start('preview', { pad: -1, from, note: null, hit: hit(pad, out.value, 0, 100, 'rate') })
}

async function save() {
  const source = await load(clip.value)
  const { start: from, end } = region.value
  const i = selected.value
  for (const [key, v] of voices) if (v.pad === i) (v.hit.stop(CUT), voices.delete(key))
  pads[i].buffer = markRaw(copyRegion(source, from, end))
  pads[i].from = clip.value.name
}

const seconds = (s: number) => (s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(2)} s`)
const selectionLength = computed(() => seconds(region.value.end - region.value.start))

const headsOn = (i: number) => heads.value.filter((h) => h.pad === i)
const clipPercent = (at: number) => `${(at / (buffer.value?.duration || 1)) * 100}%`
const percent = (at: number, i: number) => `${(at / (pads[i].buffer?.duration || 1)) * 100}%`
</script>

<template>
  <div class="pads-demo" :class="{ 'keys-open': midi.onScreen }">
    <div class="pads-main">
      <BufferView
        v-model:loop="region"
        class="pads-wave"
        :class="{ 'on-keys': !pads[selected].buffer }"
        :buffer="buffer"
        :version="clip.version"
        selectable
      >
        <div v-for="h in headsOn(-1)" :key="h.key" class="pad-head" :style="{ left: clipPercent(h.from + h.at) }">
          <span v-if="h.note != null">{{ noteName(h.note) }}</span>
        </div>
      </BufferView>
      <div class="pads-controls">
        <button v-no-focus class="pads-button" @click="preview">▶ {{ selectionLength }}</button>
        <button v-no-focus class="pads-button primary" @click="save">→ pad {{ selected + 1 }}</button>
        <div class="pads-switch">
          <span>pitch</span>
          <button v-no-focus :class="{ on: pitch === 'rate' }" @click="pitch = 'rate'">detune</button>
          <button v-no-focus :class="{ on: pitch === 'grains' }" @click="pitch = 'grains'">grains</button>
        </div>
      </div>
      <ClipPicker inline />
    </div>

    <div class="pads-grid">
      <div
        v-for="(pad, i) in pads"
        :key="i"
        class="pad"
        :title="pad.from"
        :class="{ selected: i === selected, sounding: headsOn(i).length }"
        @pointerdown="padDown(i)"
        @pointerup="padUp"
        @pointerleave="padUp"
        @pointercancel="padUp"
      >
        <BufferView v-if="pad.buffer" class="pad-wave" :buffer="pad.buffer">
          <div v-for="h in headsOn(i)" :key="h.key" class="pad-head" :style="{ left: percent(h.at, i) }">
            <span v-if="h.note != null">{{ noteName(h.note) }}</span>
          </div>
        </BufferView>
        <div v-else class="pad-wave pad-blank">empty</div>
        <div class="pad-label">
          <span class="pad-key">{{ i + 1 }}<template v-if="i === selected"> · on keys</template></span>
          <span v-if="pad.buffer">{{ seconds(pad.buffer.duration) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): pad look and layout */
.pads-demo {
  display: grid;
  grid-template-columns: 1fr 17rem;
  gap: 1rem;
}

.pads-main {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.pads-main .pads-wave {
  height: 5.5rem;
}

/* The keys play the marked region while the selected pad is empty. */
.pads-wave.on-keys {
  outline: 2px dashed var(--accent);
  outline-offset: 2px;
}

.pads-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pads-switch {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-left: auto;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.pads-button,
.pads-switch button {
  padding: 0.3em 0.8em;
  border: 2px solid var(--wire);
  border-radius: 999px;
  background: none;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.pads-switch button {
  padding: 0.2em 0.65em;
  font-size: 0.65rem;
}

.pads-button.primary,
.pads-switch button.on {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--bg);
}

.pads-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-content: start;
  gap: 0.5rem;
}

.pad {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.3rem;
  border: 2px solid var(--wire);
  border-radius: 0.4rem;
  cursor: pointer;
  user-select: none;
  touch-action: none;
  transition: background 0.08s;
}

.pad.selected {
  border-color: var(--accent);
}

.pad.sounding {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}

.pad .pad-wave {
  flex: none;
  height: 2.5rem;
  pointer-events: none;
}

/* With the code out of the way (keyboard open), there's room to grow. */
.keys-open .pads-main .pads-wave {
  height: 9rem;
}

.keys-open .pad .pad-wave {
  height: 5rem;
}

.pad-blank {
  display: grid;
  place-items: center;
  border-radius: 0.4rem;
  background: var(--surface);
  color: var(--wire);
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.pad-label {
  display: flex;
  justify-content: space-between;
  gap: 0.4em;
  white-space: nowrap;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.6rem;
}

.pad-key {
  color: var(--ink);
  font-weight: 600;
}

.pad-head {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 2;
  width: 2px;
  margin-left: -1px;
  background: var(--ink);
}

/* The note, just right of its line at the top. */
.pad-head span {
  position: absolute;
  top: 0.1rem;
  left: 0.2rem;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.5rem;
}
</style>
