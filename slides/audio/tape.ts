import { markRaw } from 'vue'
import { ctx } from './audio'
import workletUrl from './tape.worklet.js?url'

// The chaos slide's four-track looper. It prints whatever comes into `input`
// (the chaos engine, after its limiter) and loops it back into `out`.
// Loops don't go back into `input`, so a new take never prints the old ones.
//
// Synced: the first take sets the loop length. Every later take waits for the
// next loop boundary to start, and its length rounds to a whole number of
// loops, so layers line up with no click track. Lengths are counted in
// frames, so nothing drifts however long it loops.
//
// One control per track, acting on press: an empty track starts a take, a
// recording track ends it and starts looping, a playing track mutes and a
// muted one unmutes. Clearing is its own call (the slide does it on a hold).
// Each track also has its own volume, set with `setVolume`.

export type TrackState = 'empty' | 'armed' | 'recording' | 'playing' | 'muted'

// `state`, `buffer` and `volume` are for the slide; it passes in a reactive
// array. `volume` is the loop's level, 1 as printed.
export interface Track {
  state: TrackState
  buffer: AudioBuffer | null
  volume: number
}

export const MAX_VOLUME = 1.5

export const TRACK_COUNT = 4
export const newTracks = (): Track[] =>
  Array.from({ length: TRACK_COUNT }, () => ({ state: 'empty', buffer: null, volume: 1 }))

// The longest take, in seconds. A take still going then ends on its own.
const MAX_TAKE = 60
// A first take shorter than this is a stray tap, not a loop.
const MIN_LOOP = 0.25
// PLACEHOLDER(refine): the time between a sample leaving the graph and the
// room hearing it. You play along with what you hear, so takes are printed
// this much later to land in time with the loops. Chrome's estimate moves a
// little, so a take reads it once and keeps it.
const latency = () => ctx.baseLatency + ctx.outputLatency
const FADE = 0.01

let loaded: Promise<void> | null = null
const load = () => (loaded ??= ctx.audioWorklet.addModule(workletUrl))

// Made once and kept, like the loops: `out` is a node that stays connected.
export async function createTape(tracks: Track[], out: AudioNode) {
  await load()
  const rate = ctx.sampleRate
  const frameAt = (t: number) => Math.round(t * rate)
  const timeAt = (frame: number) => frame / rate
  const now = () => frameAt(ctx.currentTime)
  const wrap = (frame: number, length: number) => ((frame % length) + length) % length

  const input = new AudioWorkletNode(ctx, 'tape', {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 1,
    channelCountMode: 'explicit',
  })

  // The loop, in frames of context time: boundaries are origin + k × length.
  let loop: { origin: number; length: number } | null = null
  const nextBoundary = (frame: number) => {
    const { origin, length } = loop!
    return origin + Math.ceil((frame - origin) / length) * length
  }

  // Per track, what the slide doesn't need to see. Frames throughout.
  // `gain` fades for mutes and clears; `volume`, after it, is the slider's.
  interface Deck {
    gain: GainNode
    volume: GainNode
    source: AudioBufferSourceNode | null
    // The take's id while it's armed or recording.
    take: number | null
    start: number
    stop: number | null
    // How much later than start and stop the tape prints this take.
    delay: number
    // When the buffer's first sample plays (or would).
    anchor: number
  }
  const decks: Deck[] = tracks.map((track) => {
    const gain = new GainNode(ctx)
    const volume = new GainNode(ctx, { gain: track.volume })
    gain.connect(volume).connect(out)
    return { gain, volume, source: null, take: null, start: 0, stop: null, delay: 0, anchor: 0 }
  })
  let nextId = 0

  input.port.onmessage = ({ data }: MessageEvent<{ id: number; samples: Float32Array }>) => {
    const i = decks.findIndex((d) => d.take === data.id)
    if (i < 0) return
    decks[i].take = null
    const buffer = new AudioBuffer({ length: data.samples.length, sampleRate: rate })
    buffer.copyToChannel(data.samples, 0)
    tracks[i].buffer = markRaw(buffer)
    tracks[i].state = 'playing'
    decks[i].anchor = decks[i].start
    play(i)
  }

  // Starts track i's buffer in step with its anchor. A take arrives a moment
  // after its last loop ends, so it comes in a few milliseconds into the loop.
  function play(i: number) {
    const buffer = tracks[i].buffer!
    const deck = decks[i]
    deck.source?.stop()
    const source = new AudioBufferSourceNode(ctx, { buffer, loop: true })
    source.connect(deck.gain)
    const at = now() + frameAt(FADE)
    source.start(timeAt(at), timeAt(wrap(at - deck.anchor, buffer.length)))
    deck.source = source
  }

  // A take on track i, from the next boundary (or now, for the first). It
  // never starts before a take still printing ends, so they can follow on.
  function record(i: number) {
    const frame = now()
    const busy = decks.filter((d) => d.take !== null).map((d) => d.stop ?? Infinity)
    const start = loop ? nextBoundary(Math.max(frame, ...busy)) : frame
    const deck = decks[i]
    Object.assign(deck, { take: ++nextId, start, stop: null, delay: frameAt(latency()) })
    tracks[i].state = start > frame ? 'armed' : 'recording'
    input.port.postMessage({ type: 'start', id: deck.take, frame: start + deck.delay, max: MAX_TAKE * rate })
  }

  // Ends track i's take on a boundary. The first take makes the loop.
  function finish(i: number) {
    const deck = decks[i]
    const frame = now()
    if (!loop) {
      if (frame - deck.start < MIN_LOOP * rate) return cancel(i)
      loop = { origin: deck.start, length: frame - deck.start }
      deck.stop = frame
    } else {
      const loops = Math.max(1, Math.round((frame - deck.start) / loop.length))
      deck.stop = deck.start + loops * loop.length
    }
    input.port.postMessage({ type: 'stop', id: deck.take, frame: deck.stop + deck.delay })
  }

  // Drops track i's take, armed or recording.
  function cancel(i: number) {
    const deck = decks[i]
    if (deck.take !== null) input.port.postMessage({ type: 'cancel', id: deck.take })
    deck.take = null
    if (!tracks[i].buffer) tracks[i].state = 'empty'
    if (tracks.every((t) => t.state === 'empty')) loop = null
  }

  function fade(i: number, to: number) {
    const gain = decks[i].gain.gain
    gain.cancelScheduledValues(ctx.currentTime)
    gain.setTargetAtTime(to, ctx.currentTime, FADE)
  }

  function tap(i: number) {
    const deck = decks[i]
    switch (tracks[i].state) {
      case 'empty':
        // Tapping the next track ends the take going now, so it can follow on.
        decks.forEach((d, j) => d.take !== null && d.stop === null && tracks[j].state === 'recording' && finish(j))
        return record(i)
      case 'armed':
        return cancel(i)
      case 'recording':
        if (deck.stop === null) finish(i)
        return
      case 'playing':
        tracks[i].state = 'muted'
        return fade(i, 0)
      case 'muted':
        tracks[i].state = 'playing'
        return fade(i, 1)
    }
  }

  function setVolume(i: number, volume: number) {
    tracks[i].volume = volume
    decks[i].volume.gain.setTargetAtTime(volume, ctx.currentTime, FADE)
  }

  // A cleared track starts its next take at full volume.
  function clear(i: number) {
    const deck = decks[i]
    setVolume(i, 1)
    tracks[i].buffer = null
    cancel(i)
    tracks[i].state = 'empty'
    if (tracks.every((t) => t.state === 'empty')) loop = null
    const t = ctx.currentTime
    deck.source?.stop(t + FADE * 5)
    deck.source = null
    const gain = deck.gain.gain
    gain.cancelScheduledValues(t)
    gain.setTargetAtTime(0, t, FADE)
    gain.setValueAtTime(1, t + FADE * 6)
  }

  // Armed → recording once the boundary comes, and a take that's run too long
  // ends itself. Only the slide's labels depend on this.
  let timer: ReturnType<typeof setInterval> | undefined
  function check() {
    const frame = now()
    tracks.forEach((t, i) => {
      const deck = decks[i]
      if (t.state === 'armed' && frame >= deck.start) t.state = 'recording'
      if (t.state === 'recording' && deck.stop === null && frame - deck.start > (MAX_TAKE - 1) * rate) finish(i)
    })
  }

  // Entering the slide: loops that were kept start again, together, from the
  // top.
  function start() {
    timer = setInterval(check, 30)
    if (!loop) return
    loop.origin = now() + frameAt(FADE)
    tracks.forEach((t, i) => {
      if (!t.buffer) return
      decks[i].anchor = loop!.origin
      play(i)
    })
  }

  // Leaving: a take in progress is dropped; the loops are kept for next time.
  function stop() {
    clearInterval(timer)
    decks.forEach((deck, i) => {
      cancel(i)
      deck.source?.stop(ctx.currentTime + 0.05)
      deck.source = null
    })
  }

  // For the slide's drawing: where track i's playhead is in its buffer (0–1),
  // as heard, and how long its take has run (seconds).
  function phase(i: number) {
    const buffer = tracks[i].buffer
    if (!buffer || !decks[i].source) return null
    return wrap(frameAt(ctx.currentTime - latency()) - decks[i].anchor, buffer.length) / buffer.length
  }
  function elapsed(i: number) {
    return tracks[i].state === 'recording' ? Math.max(0, timeAt(now() - decks[i].start)) : 0
  }
  const loopLength = () => (loop ? timeAt(loop.length) : null)

  return { input, tap, clear, setVolume, start, stop, phase, elapsed, loopLength }
}

export type Tape = Awaited<ReturnType<typeof createTape>>
