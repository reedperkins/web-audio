<script setup lang="ts">
import { computed, ref } from 'vue'
import { unlock } from '../audio/audio'
import { addRecording, picked, sample, samples } from '../audio/samples'
import { useBufferPlayer } from '../audio/useBufferPlayer'
import { useDemo } from '../audio/useDemo'

// Plays the "The mic" slide's code. The live stream only goes to an analyser
// for the scrolling picture, never to the speakers, so there's no feedback.
// Record captures a few seconds with MediaRecorder and decodes them into an
// AudioBuffer, which joins the clip list for the next slide. The mic is
// turned off (tracks stopped) on leave.

// PLACEHOLDER(refine): longest recording, in seconds
const RECORD_MAX = 5

type Status = 'off' | 'asking' | 'live' | 'denied' | 'missing' | 'failed'
const status = ref<Status>('off')
const recording = ref(false)
const note = ref('')

let active = false
let stream: MediaStream | null = null
let mic: MediaStreamAudioSourceNode | null = null
let recorder: MediaRecorder | null = null
// Whether the take in progress is kept when it stops.
let take = { keep: false }
let stopTimer: ReturnType<typeof setTimeout> | undefined
// Bumped on every mic on/off, so a permission answer that arrives after
// leaving the slide is dropped.
let asking = 0

const { ctx, out } = useDemo({
  enter: () => (active = true),
  leave() {
    active = false
    micOff()
    player.stop()
  },
})
const player = useBufferPlayer(out)
const analyser = new AnalyserNode(ctx, { fftSize: 2048 })

// The newest recording; with no mic, the backup clip stands in.
const shown = computed(
  () =>
    samples.find((s) => s.id.startsWith('recording-')) ??
    (['denied', 'missing', 'failed'].includes(status.value) ? sample('hello') : undefined),
)

const messages: Record<Status, string> = {
  off: 'Turn on the mic. Chrome asks for permission first.',
  asking: 'Waiting for permission…',
  live: '',
  denied: 'The mic is blocked. The backup clip is ready below and on the next slide.',
  missing: 'No mic found. The backup clip is ready below and on the next slide.',
  failed: "The mic didn't start. The backup clip is ready below and on the next slide.",
}

async function micOn() {
  const token = ++asking
  status.value = 'asking'
  note.value = ''
  await unlock()
  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (token !== asking || !active) {
      mediaStream.getTracks().forEach((t) => t.stop())
      return
    }
    stream = mediaStream
    mic = new MediaStreamAudioSourceNode(ctx, { mediaStream })
    mic.connect(analyser)
    status.value = 'live'
  } catch (e) {
    if (token !== asking) return
    const name = (e as DOMException).name
    status.value = name === 'NotAllowedError' ? 'denied' : name === 'NotFoundError' ? 'missing' : 'failed'
    picked.value = sample('hello')
  }
}

function micOff() {
  ++asking
  stopRecording(false)
  stream?.getTracks().forEach((t) => t.stop())
  mic?.disconnect()
  stream = null
  mic = null
  status.value = 'off'
}

function record() {
  if (!stream) return
  note.value = ''
  const current = (take = { keep: true })
  recorder = new MediaRecorder(stream)
  // With no timeslice, stop() hands over the whole recording in one go:
  // a complete file, which is what decodeAudioData needs.
  recorder.ondataavailable = async (e) => {
    if (!current.keep) return
    try {
      const data = await e.data.arrayBuffer()
      const buffer = await ctx.decodeAudioData(data)
      addRecording(buffer)
    } catch {
      note.value = "Couldn't decode that recording. Try again."
    }
  }
  recorder.start()
  recording.value = true
  stopTimer = setTimeout(() => stopRecording(true), RECORD_MAX * 1000)
}

// `save: false` throws the recording away (leaving the slide mid-take).
function stopRecording(save: boolean) {
  clearTimeout(stopTimer)
  if (recorder?.state === 'recording') {
    take.keep = save
    recorder.stop()
  }
  recorder = null
  recording.value = false
}

function toggleMic() {
  if (status.value === 'live') micOff()
  else if (status.value !== 'asking') micOn()
}

function toggleRecord() {
  if (recording.value) stopRecording(true)
  else record()
}

function togglePlay() {
  if (player.playing.value) player.stop()
  else if (shown.value?.buffer) player.play(shown.value.buffer)
}

const micLabel = computed(() =>
  ({ off: 'Turn on mic', asking: 'Asking…', live: 'Mic off', denied: 'Try again', missing: 'Try again', failed: 'Try again' })[
    status.value
  ],
)
</script>

<template>
  <div class="mic-demo">
    <div class="mic-buttons">
      <ToggleChip action class="mic-button" :on="status === 'live'" @click="toggleMic">{{ micLabel }}</ToggleChip>
      <ToggleChip action class="mic-button" :on="recording" :disabled="status !== 'live'" @click="toggleRecord">
        {{ recording ? '■ Stop' : '● Record' }}
      </ToggleChip>
    </div>
    <div class="mic-strip">
      <LiveWave class="mic-picture" :analyser="analyser" :active="status === 'live'" :recording="recording" />
      <span class="mic-tag">MediaStream · live</span>
      <span v-if="messages[status]" class="mic-message">{{ messages[status] }}</span>
    </div>

    <div class="mic-buttons">
      <PlayButton :playing="player.playing.value" :disabled="!shown?.buffer" @play="togglePlay" />
    </div>
    <div class="mic-strip">
      <BufferView
        class="mic-picture"
        :buffer="shown?.buffer"
        :version="shown?.version"
        :position="player.position.value"
      />
      <span class="mic-tag">AudioBuffer · {{ shown ? shown.name.toLowerCase() : 'recorded' }}</span>
      <span v-if="note" class="mic-message">{{ note }}</span>
      <span v-else-if="!shown" class="mic-message">Record to turn the stream into a buffer.</span>
    </div>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): mic demo layout and look */
.mic-demo {
  display: grid;
  grid-template-columns: 8.5rem 1fr;
  gap: 0.6rem 1rem;
  align-items: center;
}

.mic-buttons {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.4rem;
}

/* The picture fills the strip; the tag and message sit on top of it, all in
   one grid cell, sized by the strip (not by the canvas inside). */
.mic-strip {
  display: grid;
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
  height: 4.25rem;
  border-radius: 0.4rem;
  background: var(--surface);
}

.mic-strip > * {
  grid-area: 1 / 1;
  z-index: 3;
}

.mic-strip > .mic-picture {
  z-index: auto;
  height: 100%;
  min-width: 0;
  background: none;
}

.mic-tag {
  place-self: start;
  margin: 0.3rem 0.5rem;
  padding: 0 0.3em;
  border-radius: 0.2rem;
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.6rem;
}

.mic-message {
  place-self: center;
  padding: 0.2em 0.7em;
  border-radius: 0.3rem;
  background: var(--surface);
  white-space: nowrap;
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 0.8rem;
}

.mic-button {
  font-size: 0.75rem;
}
</style>
