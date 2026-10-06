<script setup lang="ts">
import { computed, reactive, ref, shallowRef, toRaw, watch } from 'vue'
import { analyser, unlock } from '../audio/audio'
import type { Grain, WindowName } from '../audio/grains'
import { GRAIN, hopOf, playGrain, playGrains } from '../audio/grains'
import type { PlaybackParams } from '../audio/playhead'
import { Playhead } from '../audio/playhead'
import { load, picked as clip } from '../audio/samples'
import { useDemo } from '../audio/useDemo'

// The grain slides: the picked clip, looping, drawn as its signal chain with
// the controls in the nodes. The grain engine (audio/grains.ts) plays it;
// under the chain, StretchView shows the whole clip before and after, with
// the grains sounding right now. `stage` builds the engine up a slide at a
// time:
//   chop:    grains end to end, no fade (it buzzes); speed only
//   fade:    end to end, each faded with Hann (the level pumps); speed only
//   overlap: overlapping by half (the default): speed, pitch, the window
//            picker, and preserve pitch, which swaps in one plain buffer
//            source where speed and pitch move together
// Play pauses where it is. While paused, the step buttons move a grain back
// or forward, light it up, and play just that grain.
const props = withDefaults(defineProps<{ stage?: 'chop' | 'fade' | 'overlap' }>(), { stage: 'overlap' })
const full = props.stage === 'overlap'

const settings = reactive({
  speed: 1,
  semitones: 0,
  window: (props.stage === 'chop' ? 'rectangle' : 'hann') as WindowName,
  overlap: full,
})
// The engine reads the settings for every grain it schedules, outside any
// effect. It gets the plain object, so those reads skip the proxy.
const engineSettings = toRaw(settings)
const preserve = ref(true)
const playing = ref(false)
const position = ref<number | null>(null)
// Replaced whole every frame, never changed in place.
const shown = shallowRef<(Grain & { opacity: number })[]>([])
// Where it's paused, in seconds into the clip; null when it isn't.
const paused = ref<number | null>(null)

// Whether this is the current slide: playback only runs then.
const active = ref(false)
let frame = 0
// Bumped by every stop, so a play still loading when stopped gives up.
let generation = 0
// Grain mode.
let engine: ReturnType<typeof playGrains> | null = null
// The one grain a step plays.
let single: ReturnType<typeof playGrain> | null = null
let scheduled: Grain[] = []
// Plain mode.
let source: AudioBufferSourceNode | null = null
let playhead: Playhead | null = null
let applied: PlaybackParams
let lastTime = 0

const { ctx, out } = useDemo({
  enter: () => (active.value = true),
  leave() {
    active.value = false
    stop()
    unpause()
  },
})

const buffer = computed(() => clip.value.buffer)

const nodes = computed(() => [
  { key: 'buffer', label: 'AudioBuffer', style: { width: '10rem' } },
  { key: 'source', label: 'AudioBufferSourceNode', style: { flex: 1, minWidth: 0, alignItems: 'flex-start' } },
  // Faded out when it isn't used: one plain source has no grains to fade.
  { key: 'fade', label: 'GainNode', style: { width: '10.5rem', opacity: preserve.value ? 1 : 0.35 } },
  { key: 'out', label: 'destination', style: { width: '8.5rem' } },
])

const plainParams = (): PlaybackParams => ({
  playbackRate: settings.speed,
  detune: settings.semitones * 100,
  loop: true,
  loopStart: 0,
  loopEnd: 0,
})

function catchUp() {
  if (!playhead) return
  const now = ctx.currentTime
  playhead.advance(now - lastTime, applied)
  lastTime = now
}

function follow() {
  const now = ctx.currentTime
  if (engine) {
    position.value = engine.positionAt(now)
    scheduled = scheduled.filter((g) => now < g.time + GRAIN)
    shown.value = scheduled
      .filter((g) => g.time <= now)
      .map((g) => ({ ...g, opacity: Math.sin((Math.PI * (now - g.time)) / GRAIN) ** 2 }))
  } else if (playhead) {
    catchUp()
    position.value = playhead.time
  }
  frame = requestAnimationFrame(follow)
}

// Where playback is now, so switching modes carries on from the same spot.
function here() {
  if (engine) return engine.positionAt()
  catchUp()
  return playhead?.time ?? 0
}

function stop() {
  generation++
  cancelAnimationFrame(frame)
  engine?.stop()
  engine = null
  single?.stop()
  single = null
  scheduled = []
  if (source) {
    const t = ctx.currentTime
    source.stop(t)
    source = null
  }
  playhead = null
  playing.value = false
  position.value = null
  shown.value = []
}

async function play(from = 0) {
  stop()
  paused.value = null
  const gen = generation
  // Show it as playing now, so a second click while loading stops it.
  playing.value = true
  await unlock()
  const buffer = await load(clip.value)
  // Left the slide, or stopped or restarted, while loading.
  if (!active.value || gen !== generation) return

  if (preserve.value) {
    engine = playGrains(buffer, out.value, engineSettings, from, (g) => scheduled.push(g))
  } else {
    source = new AudioBufferSourceNode(ctx, { buffer, loop: true })
    source.playbackRate.value = settings.speed
    source.detune.value = settings.semitones * 100
    source.connect(out.value)
    source.start(0, from)
    playhead = new Playhead(buffer.duration, from)
    applied = plainParams()
    lastTime = ctx.currentTime
  }
  follow()
}

function unpause() {
  paused.value = null
  position.value = null
  shown.value = []
}

// How far the read position moves from one grain to the next, so grain k
// reads from k × readHop().
const readHop = () => settings.speed * hopOf(settings)
const snap = (p: number) => Math.round(p / readHop()) * readHop()

// Paused at `at`: the playhead there, and with grains, that grain lit.
function hold(at: number) {
  paused.value = at
  position.value = at
  shown.value = preserve.value
    ? [{ time: 0, offset: at, span: GRAIN * 2 ** (settings.semitones / 12), opacity: 1 }]
    : []
}

function pause() {
  const at = here()
  stop()
  hold(preserve.value ? snap(at) : at)
}

function toggle() {
  if (playing.value) pause()
  else play(paused.value ?? 0)
}

// One grain back or forward, and play it.
async function step(by: number) {
  if (playing.value) pause()
  await unlock()
  const buffer = await load(clip.value)
  if (!active.value) return
  const last = Math.floor(buffer.duration / readHop() - 1e-9)
  const k = Math.min(last, Math.max(0, Math.round((paused.value ?? 0) / readHop()) + by))
  hold(k * readHop())
  single?.stop()
  single = playGrain(buffer, out.value, engineSettings, k * readHop())
}

// The grain engine reads the settings for each grain; a plain source needs
// telling, after the playhead catches up under the old values.
watch(
  () => ({ ...settings }),
  () => {
    if (!source) return
    catchUp()
    applied = plainParams()
    source.playbackRate.value = settings.speed
    source.detune.value = settings.semitones * 100
  },
)

watch(preserve, () => {
  if (playing.value) play(here())
  else if (paused.value !== null) hold(preserve.value ? snap(paused.value) : paused.value)
})

watch(clip, () => {
  if (playing.value) play()
  else unpause()
})

// Paused, a new speed moves the grid of grains: snap to the nearest one. A
// new pitch changes how much the lit grain reads.
watch(
  () => [settings.speed, settings.semitones],
  () => {
    if (paused.value !== null && preserve.value) hold(snap(paused.value))
  },
)
</script>

<template>
  <div class="stretch-demo">
    <SignalChain class="chain" stretch :nodes="nodes">
      <template #buffer>
        <ClipPicker variant="compact" />
      </template>
      <template #source>
        <div class="sub">
          <template v-if="preserve">a new one for every grain</template>
          <template v-else>one, looping</template>
        </div>
        <Slider v-model="settings.speed" label="speed" :min="0.25" :max="2" :step="0.05" />
        <Slider v-if="full" v-model="settings.semitones" label="pitch" :min="-12" :max="12" :step="1" :digits="0" />
      </template>
      <template #fade>
        <div class="sub">
          <template v-if="!preserve">not used</template>
          <template v-else-if="stage === 'chop'">no fade: cuts in and out</template>
          <template v-else>fades each grain</template>
        </div>
        <WindowShapes
          v-model="settings.window"
          class="windows"
          :class="{ single: !full }"
          :names="full ? undefined : [settings.window]"
        />
      </template>
      <template #out>
        <div class="sub">speakers</div>
        <Scope class="scope" :analyser="analyser" :active="playing" />
      </template>
    </SignalChain>

    <div class="stretch-row">
      <div class="stretch-buttons">
        <PlayButton :playing="playing" pauses @play="toggle" />
        <div v-if="preserve" class="stretch-step">
          <ToggleChip class="stretch-step-button" @click="step(-1)">‹ grain</ToggleChip>
          <ToggleChip class="stretch-step-button" @click="step(1)">grain ›</ToggleChip>
        </div>
        <ToggleChip v-if="full" class="stretch-toggle" :on="preserve" @click="preserve = !preserve">
          preserve pitch
        </ToggleChip>
      </div>
      <StretchView
        class="stretch-view"
        :buffer="buffer"
        :version="clip.version"
        v-model:speed="settings.speed"
        :semitones="settings.semitones"
        :window="settings.window"
        :granular="preserve"
        :overlap="settings.overlap"
        :position="position"
        :grains="shown"
      />
    </div>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): stretch demo layout */
.stretch-demo {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.chain {
  --node-padding: 0.45rem 0.6rem;
  --slider-width: 6em;
}

.sub {
  margin-top: -0.3rem;
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 0.6rem;
}

.windows {
  width: 100%;
  --shape-padding: 0.2rem 0.3rem 0.15rem;
}

.windows.single {
  grid-template-columns: 1fr;
}

.scope {
  flex: 1;
  width: 100%;
  min-height: 3rem;
  border-radius: 0.4rem;
  background: var(--bg);
}

.stretch-row {
  display: flex;
  gap: 1rem;
  align-items: stretch;
}

.stretch-buttons {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.5rem;
}

.stretch-view {
  flex: 1;
  min-width: 0;
  height: 10.5rem;
}

.stretch-step {
  display: flex;
  gap: 0.3rem;
}

.stretch-step-button {
  flex: 1;
  padding: 0.2em 0.5em;
  font-family: var(--font-mono);
  font-size: 0.6rem;
}

.stretch-toggle {
  font-family: var(--font-mono);
  font-size: 0.7rem;
}
</style>
