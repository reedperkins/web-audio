<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { unlock } from '../audio/audio'
import type { Envelope, EnvelopePosition } from '../audio/envelope'
import { env, envelopeAt, noteOff, noteOn } from '../audio/envelope'
import type { EnvelopePreset } from '../audio/presets'
import { envelopePresets } from '../audio/presets'
import { useDemo, vNoFocus } from '../audio/useDemo'

// The "Shape over time" editor. Hold the button (or Enter) to play a note
// through the envelope; let go to release it. Letting go of a handle plays a
// short note so you hear the new shape, and so does picking a preset. A
// playhead follows the newest note.
const KEY = 'Enter'
// Long enough to hear the sustain after a handle is let go.
const PREVIEW_HOLD = 0.35

interface Voice {
  amp: GainNode
  osc: OscillatorNode
  shape: Envelope
  onAt: number
  offAt: number | null
}

const { ctx, out } = useDemo({ enter: listen, leave: stopAll })

const envModel = computed({
  get: () => ({ ...env }),
  set: (value: Envelope) => Object.assign(env, value),
})

const voice = shallowRef<Voice | null>(null)
const holding = ref(false)
const playhead = ref<EnvelopePosition | null>(null)
let frame = 0

async function start(holdFor?: number) {
  await unlock()
  const t = ctx.currentTime
  // PLACEHOLDER(refine): the demo's tone, tune by ear
  const osc = new OscillatorNode(ctx, { type: 'sawtooth', frequency: 220 })
  const amp = new GainNode(ctx, { gain: 0 })
  const volume = new GainNode(ctx, { gain: 0.3 })
  osc.connect(amp).connect(volume).connect(out.value)
  noteOn(amp.gain, t)
  osc.start(t)
  const v: Voice = { amp, osc, shape: { ...env }, onAt: t, offAt: null }
  osc.onended = () => volume.disconnect()
  if (voice.value && voice.value.offAt === null) release(voice.value)
  voice.value = v
  if (holdFor !== undefined) release(v, t + env.attack + env.decay + holdFor)
  // Let go while the context was still unlocking.
  else if (!holding.value) release(v)
  tick()
}

function release(v: Voice, t = ctx.currentTime) {
  if (v.offAt !== null) return
  v.offAt = t
  v.shape.release = env.release
  noteOff(v.amp.gain, t)
  v.osc.stop(t + env.release + 0.05)
}

function tick() {
  cancelAnimationFrame(frame)
  const v = voice.value
  playhead.value = v && envelopeAt(v.shape, v.onAt, v.offAt, ctx.currentTime)
  if (playhead.value) frame = requestAnimationFrame(tick)
  else voice.value = null
}

function pick({ attack, decay, sustain, release }: EnvelopePreset) {
  Object.assign(env, { attack, decay, sustain, release })
  start(PREVIEW_HOLD)
}

function press() {
  if (holding.value) return
  holding.value = true
  start()
}

function lift() {
  if (!holding.value) return
  holding.value = false
  if (voice.value) release(voice.value)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== KEY || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
  e.preventDefault()
  press()
}

function onKeyUp(e: KeyboardEvent) {
  if (e.key !== KEY) return
  e.preventDefault()
  lift()
}

function listen() {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  // Let go of Enter while the window is in the background: still release.
  window.addEventListener('blur', lift)
}

function stopAll() {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', lift)
  holding.value = false
  cancelAnimationFrame(frame)
  voice.value?.osc.stop(ctx.currentTime + 0.05)
  voice.value = null
  playhead.value = null
}
</script>

<template>
  <div class="adsr-demo">
    <AdsrEditor v-model="envModel" :playhead="playhead" @commit="start(PREVIEW_HOLD)" />
    <div class="controls">
      <AdsrPresets :presets="envelopePresets" :current="env" @pick="pick" />
      <!-- PLACEHOLDER(refine): trigger button look -->
      <button
        v-no-focus
        class="trigger"
        :class="{ holding }"
        @pointerdown.prevent="press"
        @pointerup="lift"
        @pointerleave="lift"
        @pointercancel="lift"
      >
        Hold to play <kbd>⏎ Enter</kbd>
      </button>
    </div>
  </div>
</template>

<style scoped>
.adsr-demo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

/* Leaves room for the presets row under it. */
.adsr-demo :deep(.adsr-editor) {
  width: 82%;
}

.controls {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.trigger {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.6em;
  padding: 0.35em 0.9em;
  border: 2px solid var(--accent);
  border-radius: 999px;
  background: none;
  color: var(--accent);
  font-family: var(--font-body);
  font-size: var(--size-small);
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  touch-action: none;
}

.trigger:hover,
.trigger.holding {
  background: var(--accent);
  color: var(--bg);
}

kbd {
  padding: 0.05em 0.45em;
  border: 1.5px solid currentColor;
  border-radius: 0.3em;
  font-family: var(--font-mono);
  font-size: 0.8em;
  font-weight: 400;
}
</style>
