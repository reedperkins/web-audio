import { ctx } from './audio'
import type { Envelope } from './envelope'
import { mtof } from './mtof'

// The "Chaos" slide: two instruments into one limiter.
//
// The swarm (keys): every key is dozens of sawtooth oscillators around one
// pitch. Their detune comes from shared sources: `spread` (a ConstantSource,
// scaled per oscillator by a random gain in -1…1), slow `drift` LFOs, and the
// pitch `bend`. Turning one knob moves one source, and every oscillator follows
// at audio rate, with no JS loop. `resolve` fades the swarm into one pure sine
// per key and pulls spread and drift to zero.
//
// The keys have two modes. 'osc' is the oscillator swarm above. 'voice' plays
// the recording as a granular synth: every key is a cloud of grains at the
// key's pitch (middle C as recorded), walking through the take's loud parts.
// Each grain's detune listens to the same spread, drift and bend sources, so
// every knob works the same way in both modes.
//
// The mangler (pads): grains of a recording, each pad scheduling them its own
// way (stutter, scramble, reverse…) while it's held, the way grains.ts does:
// a timer schedules the grains that start in the next LOOKAHEAD seconds.

// The MPK mini mk2 as it's set up. Knobs K1–K8 send CC 1–8; the joystick sends
// pitch bend left/right and CC 1 (the same as K1) up; the pads send notes
// 44–51 on channel 10, top row 48–51.
//
// K6 and K7 depend on what the keys play. In voice mode they're grain and
// scatter (which the pads use too). In osc mode the keys don't use those, so
// K6 and K7 become the swarm's filter: cutoff and resonance.
export const PAD_CHANNEL = 10

export interface Knobs {
  resolve: number
  spread: number
  drift: number
  rate: number
  size: number
  grain: number
  scatter: number
  crush: number
  cutoff: number
  resonance: number
}
export type KnobName = keyof Knobs

export interface KnobSlot {
  name: KnobName
  label: string
  cc: number
}

// Knob order is K1–K8, CC 1–8. Every value is 0–1.
const VOICE_KNOBS: KnobSlot[] = [
  { name: 'resolve', label: 'resolve', cc: 1 },
  { name: 'spread', label: 'spread', cc: 2 },
  { name: 'drift', label: 'drift', cc: 3 },
  { name: 'rate', label: 'drift rate', cc: 4 },
  { name: 'size', label: 'swarm size', cc: 5 },
  { name: 'grain', label: 'grain', cc: 6 },
  { name: 'scatter', label: 'scatter', cc: 7 },
  { name: 'crush', label: 'crush', cc: 8 },
]
const OSC_KNOBS: KnobSlot[] = VOICE_KNOBS.map((k) =>
  k.cc === 6 ? { name: 'cutoff', label: 'cutoff', cc: 6 }
  : k.cc === 7 ? { name: 'resonance', label: 'resonance', cc: 7 }
  : k,
)
// What K1–K8 do while the keys play `mode`.
export const knobsFor = (mode: KeysMode) => (mode === 'osc' ? OSC_KNOBS : VOICE_KNOBS)

// PLACEHOLDER(refine): starting knob positions
export const START: Knobs = {
  resolve: 0,
  spread: 0.35,
  drift: 0.3,
  rate: 0.35,
  size: 0.45,
  grain: 0.35,
  scatter: 0.2,
  crush: 0,
  // About 6 kHz: a little off the top, like the fixed tone filter before it.
  cutoff: 0.8,
  resonance: 0,
}

export type KeysMode = 'osc' | 'voice'

// 'keys' switches the keys between the modes; it plays nothing itself.
export type PadMode = 'stutter' | 'scramble' | 'reverse' | 'freeze' | 'up' | 'keys' | 'choir' | 'record'

// Top row first, as they sit on the controller.
export const PADS: { note: number; mode: PadMode }[] = [
  { note: 48, mode: 'up' },
  { note: 49, mode: 'keys' },
  { note: 50, mode: 'choir' },
  { note: 51, mode: 'record' },
  { note: 44, mode: 'stutter' },
  { note: 45, mode: 'scramble' },
  { note: 46, mode: 'reverse' },
  { note: 47, mode: 'freeze' },
]

// PLACEHOLDER(refine): the pads' other bank (the BANK button) runs the
// looper (audio/tape.ts): the bottom row is tracks 1–4, top right clears them
// all. Check these notes against what the controller sends on bank B.
export const TRACK_PADS = [36, 37, 38, 39]
export const CLEAR_PAD = 43

// PLACEHOLDER(refine): levels and ranges, tune by ear
const SWARM_LEVEL = 0.5
const PURE_LEVEL = 0.3
const GRAIN_LEVEL = 0.8
const VOICE_LEVEL = 0.9
// Even fully down, a key is a small swarm, never one plain oscillator.
const MIN_SIZE = 8
const MAX_SIZE = 200
// Past this many oscillators, new keys get smaller swarms.
const MAX_OSCILLATORS = 2400
const MAX_SPREAD = 2400
const MAX_DRIFT = 700
const BEND = 1200
// The swarm's lowpass. Resonance stays modest: a sharp peak swept across a
// thousand saws would pump the limiter.
const CUTOFF = { min: 80, max: 18000 }
const MAX_RESONANCE = 10
// The keys' own envelope, edited on the slide. Its own, not the deck's
// shared one, so a wild setting here doesn't follow the synth to the finale.
export const START_ENVELOPE: Envelope = { attack: 0.08, decay: 0.3, sustain: 0.8, release: 0.6 }

// Each key's filter envelope, edited with the mouse: its shape opens the
// key's cutoff by up to `amount` cents above K6's setting.
export interface FilterEnvelope extends Envelope {
  amount: number
}
// PLACEHOLDER(refine): filter envelope start. Amount 0 keeps the swarm
// sounding as it did until the slider is moved.
export const START_FILTER_ENVELOPE: FilterEnvelope = { attack: 0.01, decay: 0.4, sustain: 0.3, release: 0.5, amount: 0 }
export const MAX_FILTER_AMOUNT = 4800

// An envelope's level (0–1) `s` seconds after key down, while held.
function heldLevel(e: Envelope, s: number) {
  if (s < e.attack) return s / e.attack
  if (s < e.attack + e.decay) return 1 - (1 - e.sustain) * (s - e.attack) / e.decay
  return e.sustain
}
const DRIFTS = 8
const SMOOTH = 0.03

// Knob (0–1) → setting. Squared where the low end needs the detail.
export const spreadOf = (k: number) => MAX_SPREAD * k * k
export const driftOf = (k: number) => MAX_DRIFT * k * k
export const rateOf = (k: number) => 0.05 * 2 ** (k * 8)
export const sizeOf = (k: number) => Math.round(MIN_SIZE + (MAX_SIZE - MIN_SIZE) * k * k)
export const grainOf = (k: number) => 0.015 * 2 ** (k * 5)
// Voice mode: grains per second on each key.
export const densityOf = (k: number) => Math.round(15 * 2 ** (k * 3))
export const stepsOf = (k: number) => Math.round(2 ** (1 + 5 * (1 - k)))
// In octaves, so each bit of travel sounds the same.
export const cutoffOf = (k: number) => CUTOFF.min * (CUTOFF.max / CUTOFF.min) ** k
export const resonanceOf = (k: number) => MAX_RESONANCE * k

// The grain fade: a Hann window.
const HANN = Float32Array.from({ length: 129 }, (_, i) => Math.sin((Math.PI * i) / 128) ** 2)

// Rounds every sample to one of `steps` levels each side of zero.
function stairs(steps: number) {
  return Float32Array.from({ length: 1025 }, (_, i) => Math.round((i / 512 - 1) * steps) / steps)
}

// Spots in a buffer worth hearing: the 10 ms windows at least a third as loud
// as the loudest, so a grain rarely lands on silence.
function loudSpots(buffer: AudioBuffer) {
  const data = buffer.getChannelData(0)
  const window = Math.round(buffer.sampleRate * 0.01)
  const levels: number[] = []
  for (let i = 0; i + window <= data.length; i += window) {
    let sum = 0
    for (let j = i; j < i + window; j++) sum += data[j] * data[j]
    levels.push(Math.sqrt(sum / window))
  }
  const loudest = Math.max(...levels, 1e-6)
  const spots = levels.flatMap((l, i) => (l >= loudest / 3 ? [(i * window) / buffer.sampleRate] : []))
  return spots.length ? spots : [0]
}

function reversed(buffer: AudioBuffer) {
  const copy = new AudioBuffer({ length: buffer.length, sampleRate: buffer.sampleRate })
  copy.copyToChannel(buffer.getChannelData(0).toReversed(), 0)
  return copy
}

export interface ChaosStats {
  oscillators: number
  grains: number
}

const LOOKAHEAD = 0.1
const TICK = 25
// PLACEHOLDER(refine): grain limits. Past MAX_GRAINS in flight, grains are
// skipped (the stream keeps time); MIN_HOP keeps tiny grains from flooding.
const MAX_GRAINS = 400
const MIN_HOP = 0.008

// `stats` is a plain object, counted on every grain; the slide polls it
// rather than making it reactive.
export function createChaos(out: AudioNode, knobs: Knobs, envelope: Envelope, filterEnvelope: FilterEnvelope, tap?: AudioNode) {
  const stats: ChaosStats = { oscillators: 0, grains: 0 }
  // Everything goes through a hard limiter last: a thousand saws or a pile of
  // grains can't blow the speakers.
  const limiter = new DynamicsCompressorNode(ctx, { threshold: -10, knee: 0, ratio: 20, attack: 0.002, release: 0.15 })
  limiter.connect(out)
  if (tap) limiter.connect(tap)

  // Crush: a dry path and a stair-step wave shaper, crossfaded.
  const mix = new GainNode(ctx)
  const dry = new GainNode(ctx)
  const drive = new GainNode(ctx)
  const shaper = new WaveShaperNode(ctx)
  const wet = new GainNode(ctx, { gain: 0 })
  mix.connect(dry).connect(limiter)
  mix.connect(drive).connect(shaper).connect(wet).connect(limiter)

  // The swarm into `wild`, the pure sines into `calm`; resolve fades between.
  // Each key's swarm has its own lowpass on the way (see `swarm`).
  const wild = new GainNode(ctx)
  const calm = new GainNode(ctx, { gain: 0 })
  wild.connect(mix)
  calm.connect(mix)
  const grainBus = new GainNode(ctx, { gain: GRAIN_LEVEL })
  grainBus.connect(mix)

  // The shared detune sources. Each drift LFO runs at its own multiple of the
  // rate, so the swarm never moves in step.
  const spread = new ConstantSourceNode(ctx, { offset: 0 })
  const bend = new ConstantSourceNode(ctx, { offset: 0 })
  const ratios = Array.from({ length: DRIFTS }, (_, i) => 0.6 + (0.9 * i) / (DRIFTS - 1))
  const lfos = ratios.map(() => new OscillatorNode(ctx, { frequency: 1 }))
  const drift = lfos.map((lfo) => lfo.connect(new GainNode(ctx, { gain: 0 })) as GainNode)
  for (const source of [spread, bend, ...lfos]) source.start()
  stats.oscillators = DRIFTS

  // Every key that's sounding (see `swarm`). Declared here, as `update` walks it.
  const swarms = new Map<number, Swarm>()

  let steps = 0
  // Sets every shared source from the knobs. Cheap: only a dozen params,
  // however many oscillators are listening.
  function update() {
    const t = ctx.currentTime
    const calmness = knobs.resolve
    const wildness = 1 - calmness
    const set = (param: AudioParam, value: number) => param.setTargetAtTime(value, t, SMOOTH)
    set(spread.offset, spreadOf(knobs.spread) * wildness)
    drift.forEach((d) => set(d.gain, driftOf(knobs.drift) * wildness))
    lfos.forEach((lfo, i) => set(lfo.frequency, rateOf(knobs.rate) * ratios[i]))
    set(wild.gain, wildness)
    set(calm.gain, calmness)
    for (const { filter } of swarms.values()) {
      set(filter.frequency, cutoffOf(knobs.cutoff))
      set(filter.Q, resonanceOf(knobs.resonance))
    }
    const crushing = knobs.crush > 0.02
    set(dry.gain, crushing ? 0 : 1)
    set(wet.gain, crushing ? 1 : 0)
    set(drive.gain, 1 + 3 * knobs.crush)
    const next = stepsOf(knobs.crush)
    if (next !== steps) shaper.curve = stairs((steps = next))
  }
  update()

  // ── The swarm ──

  interface Swarm {
    oscs: OscillatorNode[]
    offsets: GainNode[]
    envs: GainNode[]
    // The key's lowpass, and what its envelope was started with.
    filter: BiquadFilterNode
    at: number
    shape: FilterEnvelope
    // Voice mode: the key's grain stream, in `streams`.
    cloud?: number
  }
  let keysMode: KeysMode = 'osc'
  // Voice clouds share `streams` with the pads, keyed past any MIDI note.
  const CLOUD = 1000

  // The slide's code, plus an envelope, a pure sine for `resolve`, and
  // bookkeeping so it can be released.
  function swarm(note: number, velocity: number) {
    const voice = keysMode === 'voice' && source !== null
    const size = voice ? 0 : Math.max(1, Math.min(sizeOf(knobs.size), MAX_OSCILLATORS - stats.oscillators))
    const t = ctx.currentTime
    const level = velocity / 127
    const amp = new GainNode(ctx, {
      gain: voice ? VOICE_LEVEL * level : (SWARM_LEVEL * level) / Math.sqrt(size),
    })
    const oscs: OscillatorNode[] = []
    const offsets: GainNode[] = []
    for (let i = 0; i < size; i++) {
      const osc = new OscillatorNode(ctx, { type: 'sawtooth', frequency: mtof(note) })
      const offset = new GainNode(ctx, { gain: Math.random() * 2 - 1 })
      spread.connect(offset).connect(osc.detune)
      drift[i % drift.length].connect(osc.detune)
      bend.connect(osc.detune)
      osc.connect(amp)
      // A random start spreads the phases, so the swarm in unison isn't one
      // huge saw.
      osc.start(t + Math.random() / mtof(note))
      oscs.push(osc)
      offsets.push(offset)
    }

    const pure = new OscillatorNode(ctx, { frequency: mtof(note) })
    bend.connect(pure.detune)
    pure.start(t)
    oscs.push(pure)

    const env = new GainNode(ctx, { gain: 0 })
    const pureEnv = new GainNode(ctx, { gain: 0 })
    // The key's lowpass: K6 and K7 set it; its envelope sweeps its detune, in
    // cents, from the cutoff up by `amount` and back down to `sustain` of it.
    const shape = { ...filterEnvelope }
    const filter = new BiquadFilterNode(ctx, {
      type: 'lowpass',
      frequency: cutoffOf(knobs.cutoff),
      Q: resonanceOf(knobs.resonance),
    })
    filter.detune.setValueAtTime(0, t)
    filter.detune.linearRampToValueAtTime(shape.amount, t + shape.attack)
    filter.detune.linearRampToValueAtTime(shape.amount * shape.sustain, t + shape.attack + shape.decay)
    amp.connect(filter).connect(env).connect(wild)
    pure.connect(new GainNode(ctx, { gain: PURE_LEVEL * level })).connect(pureEnv).connect(calm)
    // The same ramps as noteOn on the envelope slides.
    const { attack, decay, sustain } = envelope
    for (const e of [env, pureEnv]) {
      e.gain.setValueAtTime(0, t)
      e.gain.linearRampToValueAtTime(1, t + attack)
      e.gain.linearRampToValueAtTime(sustain, t + attack + decay)
    }
    stats.oscillators += oscs.length
    const keys = { oscs, offsets, envs: [env, pureEnv], filter, at: t, shape }
    if (!voice) return keys

    const cloud = CLOUD + note
    const start = source!.spots[0]
    startStream(cloud, { mode: 'voice', note, next: t + 0.01, pos: start, home: start, amp })
    return { ...keys, cloud }
  }

  function release(s: Swarm, fade: number) {
    const t = ctx.currentTime
    for (const e of s.envs) {
      e.gain.cancelAndHoldAtTime(t)
      e.gain.linearRampToValueAtTime(0, t + fade)
    }
    // The filter falls back over its own release. cancelAndHoldAtTime only
    // holds a value while a ramp is still running; past the decay it adds
    // nothing, so the hold is set by hand.
    const { detune } = s.filter
    detune.cancelAndHoldAtTime(t)
    detune.setValueAtTime(s.shape.amount * heldLevel(s.shape, t - s.at), t)
    detune.linearRampToValueAtTime(0, t + s.shape.release)
    for (const osc of s.oscs) osc.stop(t + fade + 0.05)
    // Once the last one ends, cut every connection into it so nothing keeps
    // the swarm alive.
    s.oscs.at(-1)!.onended = () => {
      if (s.cloud !== undefined) endStream(s.cloud)
      for (const osc of s.oscs) {
        bend.disconnect(osc.detune)
        osc.disconnect()
      }
      s.offsets.forEach((offset, i) => {
        spread.disconnect(offset)
        drift[i % drift.length].disconnect(s.oscs[i].detune)
        offset.disconnect()
      })
      s.envs.forEach((e) => e.disconnect())
      s.filter.disconnect()
      stats.oscillators -= s.oscs.length
    }
  }

  function noteOn(note: number, velocity: number) {
    noteOff(note, 0.03)
    swarms.set(note, swarm(note, velocity))
  }
  function noteOff(note: number, fade = envelope.release) {
    const s = swarms.get(note)
    if (!s) return
    release(s, fade)
    swarms.delete(note)
  }

  // ── The mangler ──

  let source: { buffer: AudioBuffer; backwards: AudioBuffer; spots: number[] } | null = null
  function useBuffer(buffer: AudioBuffer) {
    source = { buffer, backwards: reversed(buffer), spots: loudSpots(buffer) }
  }

  interface Stream {
    mode: PadMode | 'voice'
    // Voice mode: the key it plays.
    note?: number
    // When the next grain starts, and where it reads from.
    next: number
    pos: number
    // A loud spot picked on press, for the modes that stay in one place.
    home: number
    amp: GainNode
  }
  const streams = new Map<number, Stream>()
  let timer: ReturnType<typeof setInterval> | undefined

  // `wobble`: the grain's detune also listens to spread and drift, like a
  // swarm oscillator (voice mode).
  function grain(buffer: AudioBuffer, time: number, offset: number, length: number, cents: number, gain: number, into: AudioNode, wobble = false) {
    const src = new AudioBufferSourceNode(ctx, { buffer, detune: cents })
    const env = new GainNode(ctx, { gain: 0 })
    env.gain.setValueCurveAtTime(HANN.map((v) => v * gain), time, length)
    bend.connect(src.detune)
    let spreadBy: GainNode | null = null
    const lfo = drift[Math.floor(Math.random() * drift.length)]
    if (wobble) {
      spreadBy = new GainNode(ctx, { gain: Math.random() * 2 - 1 })
      spread.connect(spreadBy).connect(src.detune)
      lfo.connect(src.detune)
    }
    src.connect(env).connect(into)
    src.start(time, offset)
    src.stop(time + length)
    stats.grains++
    src.onended = () => {
      bend.disconnect(src.detune)
      if (spreadBy) {
        spread.disconnect(spreadBy)
        spreadBy.disconnect()
        lfo.disconnect(src.detune)
      }
      env.disconnect()
      stats.grains--
    }
  }

  // The next loud moment at or after `t`, wrapping to the first.
  function nextLoud(spots: number[], t: number) {
    const i = spots.findIndex((p) => p + 0.01 > t)
    return i < 0 ? spots[0] : Math.max(t, spots[i])
  }

  function step(s: Stream) {
    if (!source) {
      s.next = Infinity
      return
    }
    const { buffer, backwards, spots } = source
    const size = grainOf(knobs.grain)
    const jitter = () => (Math.random() * 2 - 1) * knobs.scatter
    const spot = () => spots[Math.floor(Math.random() * spots.length)]
    let buf = buffer
    let offset = s.pos
    let cents = jitter() * 700
    let hop = size / 2
    let gain = 0
    switch (s.mode) {
      case 'voice':
        // Through the take at its own speed, skipping silence; the key sets
        // the pitch and spread and drift (on the grain's detune) do the rest.
        hop = 1 / densityOf(knobs.size)
        cents = (s.note! - 60) * 100
        s.pos = nextLoud(spots, s.pos + hop)
        offset = s.pos + jitter() * 0.1
        // Grains this dense overlap out of step; scale for that.
        gain = Math.min(1, 1.5 * Math.sqrt(hop / size))
        break
      case 'stutter':
        offset = s.home
        hop = size
        break
      case 'scramble':
        offset = spot()
        if (Math.random() < 0.3) buf = backwards
        break
      case 'reverse':
        buf = backwards
        s.pos += hop
        break
      case 'freeze':
        offset = s.home + jitter() * 0.2
        hop = size / 4
        break
      case 'up':
        cents += 1200
        s.pos += hop * 1.5
        break
      case 'choir': {
        // Sing the shout at the pitches the swarm is holding.
        const notes = [...swarms.keys()]
        const note = notes.length ? notes[Math.floor(Math.random() * notes.length)] : 60 + [0, 3, 5, 7, 10][Math.floor(Math.random() * 5)]
        cents += (note - 60) * 100
        offset = s.home + jitter() * 0.3
        hop = size / 3
        break
      }
    }
    hop = Math.max(MIN_HOP, hop)
    const end = Math.max(0.001, buf.duration - size)
    offset = ((offset % end) + end) % end
    s.pos %= buffer.duration
    // Overlapping Hann windows add up; scale each so the level holds.
    gain ||= Math.min(1, (2 * hop) / size)
    if (stats.grains < MAX_GRAINS) grain(buf, s.next, offset, size, cents, gain, s.amp, s.mode === 'voice')
    s.next += hop
  }

  function tick() {
    const now = ctx.currentTime
    const until = now + LOOKAHEAD
    for (const s of streams.values()) {
      // Fell behind (a stalled timer or a busy page): skip ahead, don't burst.
      if (s.next < now) s.next = now
      while (s.next < until) step(s)
    }
  }

  function startStream(key: number, stream: Stream) {
    streams.set(key, stream)
    tick()
    timer ??= setInterval(tick, TICK)
  }
  function endStream(key: number) {
    streams.delete(key)
    if (!streams.size) {
      clearInterval(timer)
      timer = undefined
    }
  }

  function padOn(note: number, velocity: number, mode: PadMode) {
    padOff(note)
    if (!source || mode === 'record' || mode === 'keys') return
    const home = source.spots[Math.floor(Math.random() * source.spots.length)]
    const amp = new GainNode(ctx, { gain: velocity / 127 })
    amp.connect(grainBus)
    const pos = mode === 'reverse' ? source.buffer.duration - home : home
    startStream(note, { mode, next: ctx.currentTime + 0.01, pos, home, amp })
  }

  function padOff(note: number) {
    const s = streams.get(note)
    if (!s) return
    endStream(note)
    const t = ctx.currentTime
    s.amp.gain.cancelAndHoldAtTime(t)
    s.amp.gain.linearRampToValueAtTime(0, t + 0.05)
    setTimeout(() => s.amp.disconnect(), 400)
  }

  // Leaving the slide: useDemo fades `out`; this stops the sources and timer.
  function stop() {
    clearInterval(timer)
    timer = undefined
    for (const note of [...swarms.keys()]) noteOff(note, 0.03)
    for (const note of [...streams.keys()]) if (note < CLOUD) padOff(note)
    // Clouds stop with their key's fade; end them now so the timer stops.
    for (const note of [...streams.keys()]) endStream(note)
    for (const s of [spread, bend, ...lfos]) s.stop(ctx.currentTime + 0.1)
    setTimeout(() => limiter.disconnect(), 300)
  }

  // New keys use the new mode; keys already down keep theirs.
  const setKeys = (mode: KeysMode) => (keysMode = mode)

  return { stats, setKeys, update, noteOn, noteOff, padOn, padOff, useBuffer, bend: (amount: number) => bend.offset.setTargetAtTime(amount * BEND, ctx.currentTime, 0.01), stop }
}

export type Chaos = ReturnType<typeof createChaos>
