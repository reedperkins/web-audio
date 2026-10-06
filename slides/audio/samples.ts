import { markRaw, reactive, ref } from 'vue'
import { ctx } from './audio'

// The clips for section 6. Every file is in `public/samples/`, so they load
// offline. Each is decoded once and shared, so a change made on one slide
// (reversing it, a mic recording joining the list) shows on the next.

export interface Sample {
  id: string
  name: string
  url?: string
  buffer?: AudioBuffer
  // Whether the samples are stored backwards right now.
  reversed: boolean
  // Counts edits to the buffer's samples in place (reversing), so pictures
  // know to redraw.
  version: number
}

const file = (id: string, name: string): Sample => ({
  id,
  name,
  url: `${import.meta.env.BASE_URL}samples/${id}.mp3`,
  reversed: false,
  version: 0,
})

export const samples = reactive<Sample[]>([
  file('small-step', 'One small step'),
  file('drum-loop', 'Drum loop'),
  file('piano-c4', 'Piano C4'),
  file('hello', 'Hello (backup)'),
])

export const sample = (id: string) => samples.find((s) => s.id === id)!

// The clip the section's controls are working on.
export const picked = ref<Sample>(samples[0])

// The slides' own code, so what's shown is what runs.
async function decode(url: string) {
  const response = await fetch(url)
  const data = await response.arrayBuffer()
  return ctx.decodeAudioData(data)
}

const loading = new Map<string, Promise<AudioBuffer>>()

// Decoding works while the context is still suspended, so this can run on
// slide enter, before anyone clicks.
export function load(s: Sample) {
  if (s.buffer) return Promise.resolve(s.buffer)
  if (!s.url) return Promise.reject(new Error(`${s.id} has no file`))
  if (!loading.has(s.id)) {
    const pending = decode(s.url).then((buffer) => (s.buffer = markRaw(buffer)))
    // A failed load can be tried again.
    pending.catch(() => loading.delete(s.id))
    loading.set(s.id, pending)
  }
  return loading.get(s.id)!
}

// The slide's code. Every clip is mono, so one channel is the whole sound.
// A source that's playing should be restarted from the mirrored spot.
export function reverse(s: Sample) {
  if (!s.buffer) return
  s.buffer.getChannelData(0).reverse()
  s.reversed = !s.reversed
  s.version++
}

// Average every channel into one, so a recording reverses whole like the clips.
function mono(buffer: AudioBuffer) {
  if (buffer.numberOfChannels === 1) return buffer
  const { length, sampleRate, numberOfChannels } = buffer
  const out = new AudioBuffer({ length, sampleRate, numberOfChannels: 1 })
  const mix = out.getChannelData(0)
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < length; i++) mix[i] += data[i] / numberOfChannels
  }
  return out
}

let recordings = 0

// A mic recording joins the list (replacing the last one) and becomes the
// picked clip, so the next slide opens on it.
export function addRecording(buffer: AudioBuffer) {
  const recording: Sample = {
    id: `recording-${++recordings}`,
    name: 'Your recording',
    buffer: markRaw(mono(buffer)),
    reversed: false,
    version: 0,
  }
  const old = samples.findIndex((s) => s.id.startsWith('recording-'))
  if (old >= 0) samples.splice(old, 1, recording)
  else samples.push(recording)
  // The list's own (reactive) copy, so `s === picked.value` comparisons hold.
  picked.value = sample(recording.id)
  return picked.value
}

export const loadAll = () => Promise.all(samples.map(load))

// Fetch every clip as soon as the deck loads, so section 6 never waits on the
// server (and keeps working if the server goes away mid-talk).
if (typeof window !== 'undefined') loadAll().catch(() => {})

declare global {
  // eslint-disable-next-line no-var
  var __talkSamples: { samples: Sample[]; picked: typeof picked } | undefined
}

// For checks in dev (what was recorded, what's picked); never in the build.
if (import.meta.env.DEV) globalThis.__talkSamples = { samples, picked }
