<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { unlock } from '../audio/audio'
import type { PlaybackParams } from '../audio/playhead'
import { Playhead } from '../audio/playhead'
import { load, picked as clip, reverse } from '../audio/samples'
import { useClipRegion } from '../audio/useClipRegion'
import { useDemo } from '../audio/useDemo'

// Plays the "Play it differently" slide's code on any clip. Rate, detune and
// the loop change the playing source live; reversing and seeking start a new
// one, since a source can't jump. The playhead follows the spec's playback
// rules (audio/playhead.ts), so it moves at the real rate and wraps the loop.

const buffer = computed(() => clip.value.buffer)

const params = reactive({ playbackRate: 1, detune: 0, loop: false })
// Each clip keeps its own loop.
const region = useClipRegion(clip)

let source: AudioBufferSourceNode | null = null
let playhead: Playhead | null = null
// What the source is playing with right now. The reactive values above have
// already changed by the time a watcher sees them.
let applied: PlaybackParams
let lastTime = 0
let frame = 0
// Bumped by every stop, so a play still loading when stopped gives up.
let generation = 0
const playing = ref(false)
const position = ref<number | null>(null)
let active = false

const { ctx, out } = useDemo({
  enter() {
    active = true
  },
  leave() {
    active = false
    stop()
  },
})

const current = (): PlaybackParams => ({
  ...params,
  loopStart: region.value.start,
  loopEnd: region.value.end,
})

// Catch the playhead up to now, with the params that held until now.
function catchUp() {
  if (!playhead) return true
  const now = ctx.currentTime
  const running = playhead.advance(now - lastTime, applied)
  lastTime = now
  position.value = playhead.time
  return running
}

function follow() {
  if (!catchUp()) return
  frame = requestAnimationFrame(follow)
}

function stop() {
  generation++
  cancelAnimationFrame(frame)
  if (source) {
    source.onended = null
    source.stop()
    source = null
  }
  playhead = null
  playing.value = false
  position.value = null
}

async function play(offset = 0) {
  stop()
  const gen = generation
  // Show it as playing now, so a second click while loading stops it.
  playing.value = true
  await unlock()
  const buffer = await load(clip.value)
  // Left the slide, or stopped or restarted, while loading.
  if (!active || gen !== generation) return
  // Past the loop end, start() would play on to the end of the clip without
  // looping. Start at the loop instead.
  if (params.loop && offset >= region.value.end) offset = region.value.start

  source = new AudioBufferSourceNode(ctx, { buffer })
  source.playbackRate.value = params.playbackRate
  source.detune.value = params.detune
  source.loop = params.loop
  source.loopStart = region.value.start
  source.loopEnd = region.value.end
  source.connect(out.value)
  source.start(0, offset)

  const self = source
  source.onended = () => self === source && stop()
  playhead = new Playhead(buffer.duration, offset)
  applied = current()
  lastTime = ctx.currentTime
  follow()
}

// Live changes: bring the playhead up to date under the old values first.
watch(current, (next) => {
  if (!source) return
  catchUp()
  applied = next
  source.playbackRate.value = next.playbackRate
  source.detune.value = next.detune
  source.loop = next.loop
  source.loopStart = next.loopStart
  source.loopEnd = next.loopEnd
})

function toggle() {
  if (playing.value) stop()
  else play()
}

// The clip picker sits beside the code. A playing clip hands over to the new one.
watch(clip, () => {
  const was = playing.value
  stop()
  if (was) play()
})

// The picture and the loop flip with the samples, so the loop stays on the
// same sound. A playing clip carries on from the mirrored spot.
function flip() {
  const duration = buffer.value?.duration
  if (!duration) return
  const at = playing.value && catchUp() ? playhead!.time : null
  const { start, end } = region.value
  stop()
  reverse(clip.value)
  region.value = { start: duration - end, end: duration - start }
  if (at != null) play(duration - at)
}

function seek(seconds: number) {
  play(seconds)
}
</script>

<template>
  <div class="sampler-demo">
    <BufferView
      v-model:loop="region"
      class="sampler-wave"
      :loop-active="params.loop"
      :buffer="buffer"
      :version="clip.version"
      :position="position"
      seekable
      @seek="seek"
    />

    <div class="sampler-controls">
      <PlayButton :playing="playing" @play="toggle" />
      <ToggleChip class="sampler-toggle" :on="clip.reversed" @click="flip">reverse()</ToggleChip>
      <ToggleChip class="sampler-toggle" :on="params.loop" @click="params.loop = !params.loop">loop</ToggleChip>
      <Slider v-model="params.playbackRate" label="playbackRate" :min="0.25" :max="3" :step="0.05" />
      <Slider v-model="params.detune" label="detune" :min="-1200" :max="1200" :step="100" :digits="0" />
    </div>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): sampler layout and control look */
.sampler-demo {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.sampler-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  /* Room for "-1200" without the row reflowing as values change. */
  --slider-width: 7em;
  --slider-value-width: 5ch;
}

.sampler-controls > * {
  flex-shrink: 0;
}

.sampler-wave {
  height: 6rem;
}

.sampler-toggle {
  font-family: var(--font-mono);
}
</style>
