// Changes pitch without changing speed (or speed without pitch) by playing a
// buffer as short grains. Each grain is a buffer source played at the new
// pitch (its `detune`), faded in and out; the read position moves on by
// `speed` × hop for every hop of output. Grains normally overlap by half (hop
// is HOP); the build-up slides turn `overlap` off, so each starts as the last
// ends (hop is GRAIN). A timer wakes every TICK ms and
// schedules the grains that start in the next LOOKAHEAD seconds, like the
// sequencer, and each grain reads the settings when it's scheduled.

// PLACEHOLDER(refine): grain length, tune by ear
export const GRAIN = 0.08
// The hop when grains overlap by half.
export const HOP = GRAIN / 2
const TICK = 25
// The first grain starts this long after the player is made.
const LEAD = 0.05
// One-shots are played from keys, so they start sooner.
const HIT_LEAD = 0.01
const LOOKAHEAD = 0.1
// Stopping cuts the grains in flight with a short fade so it doesn't click.
const CUT = 0.02

// The fade each grain gets, as a curve for setValueCurveAtTime. Overlapping,
// each is scaled so that two half-overlapping grains never add up past 1:
// otherwise a rectangle would play twice as loud and a sine window about
// 1.4×, and the windows would differ in loudness instead of only in their
// edges. Without overlap they're left at full height, since nothing adds up.
export type WindowName = 'rectangle' | 'triangle' | 'hann' | 'sine'
const POINTS = 129
const shapes: Record<WindowName, (x: number) => number> = {
  rectangle: () => 1,
  triangle: (x) => 1 - Math.abs(2 * x - 1),
  // One smooth bump from 0 up to 1 and back to 0. Half-overlapping copies add
  // up to exactly 1, because sin² + cos² = 1.
  hann: (x) => Math.sin(Math.PI * x) ** 2,
  sine: (x) => Math.sin(Math.PI * x),
}

function curve(shape: (x: number) => number) {
  const raw = Float32Array.from({ length: POINTS }, (_, i) => shape(i / (POINTS - 1)))
  const half = (POINTS - 1) / 2
  let peak = 0
  for (let i = 0; i <= half; i++) peak = Math.max(peak, raw[i] + raw[i + half])
  return raw.map((v) => v / peak)
}

export const windows = Object.fromEntries(
  Object.entries(shapes).map(([name, shape]) => [name, curve(shape)]),
) as Record<WindowName, Float32Array>

const unscaled = Object.fromEntries(
  Object.entries(shapes).map(([name, shape]) => [
    name,
    Float32Array.from({ length: POINTS }, (_, i) => shape(i / (POINTS - 1))),
  ]),
) as Record<WindowName, Float32Array>

export interface GrainSettings {
  speed: number
  semitones: number
  window: WindowName
  // Overlap by half (the default), or start each grain as the last ends.
  overlap?: boolean
  // Play through the buffer once and end, instead of looping it.
  once?: boolean
}

export const hopOf = (settings: GrainSettings) => (settings.overlap === false ? GRAIN : HOP)
export const fadeOf = (settings: GrainSettings) => (settings.overlap === false ? unscaled : windows)[settings.window]

export interface Grain {
  // When it starts, in context time.
  time: number
  // Where it reads from, in buffer seconds, and how much it reads.
  offset: number
  span: number
}

interface Live {
  source: AudioBufferSourceNode
  env: GainNode
}

// The grain engine for one buffer, scheduling on `into`'s context. `tick`
// schedules up to a given time; `playGrains` below runs it on a timer.
export function createGrainPlayer(
  buffer: AudioBuffer,
  into: AudioNode,
  settings: GrainSettings,
  from = 0,
  onGrain?: (grain: Grain) => void,
) {
  const ctx = into.context
  const live = new Set<Live>()
  // Recent grains, oldest first, for working out the read position.
  const recent: Grain[] = []
  let next = ctx.currentTime + (settings.once ? HIT_LEAD : LEAD)
  let position = from
  // Once through, it stops scheduling; the last grain ends at `end`.
  let done = false
  let end = 0
  const wrap = (p: number) => (settings.once ? p : p % buffer.duration)

  // The slide's code, plus bookkeeping so stop() can reach it.
  function grain(time: number, offset: number) {
    const cents = settings.semitones * 100
    const fade = fadeOf(settings)
    const source = new AudioBufferSourceNode(ctx, { buffer, detune: cents })
    const env = new GainNode(ctx, { gain: 0 })
    env.gain.setValueCurveAtTime(fade, time, GRAIN)
    source.connect(env).connect(into)
    source.start(time, offset, GRAIN * 2 ** (cents / 1200))

    const voice = { source, env }
    live.add(voice)
    source.onended = () => {
      env.disconnect()
      live.delete(voice)
    }
  }

  function tick(until: number) {
    while (next < until) {
      if (settings.once && position >= buffer.duration) {
        done = true
        break
      }
      grain(next, position)
      end = next + GRAIN
      const span = GRAIN * 2 ** (settings.semitones / 12)
      const g = { time: next, offset: position, span }
      recent.push(g)
      if (recent.length > 64) recent.shift()
      onGrain?.(g)
      const hop = hopOf(settings)
      position = wrap(position + settings.speed * hop)
      next += hop
    }
    return done
  }

  // A one-shot that has played its last grain.
  const finished = () => done && ctx.currentTime >= end

  // Where the read position is at context time `t` (now, by default).
  function positionAt(t = ctx.currentTime) {
    let last: Grain | undefined
    for (const g of recent) if (g.time <= t) last = g
    if (!last) return from
    return wrap(last.offset + settings.speed * (t - last.time))
  }

  function stop() {
    const t = ctx.currentTime
    for (const { source, env } of live) {
      env.gain.cancelAndHoldAtTime(t)
      env.gain.linearRampToValueAtTime(0, t + CUT)
      source.stop(t + CUT)
    }
  }

  return { tick, stop, positionAt, finished }
}

// One grain on its own, starting now, for stepping through grain by grain.
export function playGrain(buffer: AudioBuffer, into: AudioNode, settings: GrainSettings, offset: number) {
  const player = createGrainPlayer(buffer, into, settings, offset)
  // The player's first grain is LEAD from now; schedule only that one.
  player.tick(into.context.currentTime + LEAD + 0.001)
  return player
}

export function playGrains(...args: Parameters<typeof createGrainPlayer>) {
  const player = createGrainPlayer(...args)
  const ctx = args[1].context
  const tick = () => player.tick(ctx.currentTime + LOOKAHEAD) && clearInterval(timer)
  const timer = setInterval(tick, TICK)
  tick()
  return {
    positionAt: player.positionAt,
    finished: player.finished,
    stop() {
      clearInterval(timer)
      player.stop()
    },
  }
}

// The output for pictures, worked out directly instead of played: the sample
// heard `t` seconds after the first grain. Each grain k starts at k × hop,
// reads from k × speed × hop at the new pitch, and is faded by the window;
// the grains overlapping `t` add up. Cheap enough to draw on every frame.
// With `granular` off it's one plain source, where speed and pitch move
// together.
export function stretched(buffer: AudioBuffer, settings: GrainSettings, granular: boolean) {
  const data = buffer.getChannelData(0)
  const sr = buffer.sampleRate
  const ratio = 2 ** (settings.semitones / 12)
  const sample = (p: number) => data[Math.floor(p * sr)] ?? 0
  if (!granular) return (t: number) => sample(t * settings.speed * ratio)

  const fade = fadeOf(settings)
  const hop = hopOf(settings)
  const last = Math.ceil(buffer.duration / settings.speed / hop) - 1
  return (t: number) => {
    let sum = 0
    for (let k = Math.max(0, Math.floor((t - GRAIN) / hop) + 1); k <= Math.min(last, Math.floor(t / hop)); k++) {
      const into = t - k * hop
      sum += fade[Math.round((into / GRAIN) * (POINTS - 1))] * sample(k * settings.speed * hop + into * ratio)
    }
    return sum
  }
}
