import { reactive } from 'vue'

export interface Envelope {
  attack: number
  decay: number
  sustain: number
  release: number
}

// The deck's one envelope. The ADSR editor edits it; every note reads it.
export const env = reactive<Envelope>({ attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.4 })

// noteOn / noteOff are the code on the "An envelope is a scheduled gain" slide.
export function noteOn(gain: AudioParam, t: number) {
  gain.cancelScheduledValues(t)
  gain.setValueAtTime(0, t)
  gain.linearRampToValueAtTime(1, t + env.attack)
  gain.linearRampToValueAtTime(env.sustain,
    t + env.attack + env.decay)
}
export function noteOff(gain: AudioParam, t: number) {
  gain.cancelAndHoldAtTime(t)
  gain.linearRampToValueAtTime(0, t + env.release)
}

export type Phase = 'attack' | 'decay' | 'sustain' | 'release'

// Where a note is in its envelope, for drawing a playhead. `progress` runs 0→1
// through the phase (sustain fills over SUSTAIN_DRAW seconds). Mirrors the
// ramps noteOn/noteOff schedule; returns null once the release has finished.
const SUSTAIN_DRAW = 1.5

export interface EnvelopePosition {
  phase: Phase
  progress: number
  level: number
}

function heldLevel(e: Envelope, s: number) {
  if (s < e.attack) return s / e.attack
  if (s < e.attack + e.decay) return 1 - (1 - e.sustain) * (s - e.attack) / e.decay
  return e.sustain
}

export function envelopeAt(e: Envelope, onAt: number, offAt: number | null, t: number): EnvelopePosition | null {
  if (offAt !== null && t >= offAt) {
    const progress = (t - offAt) / e.release
    if (progress >= 1) return null
    return { phase: 'release', progress, level: heldLevel(e, offAt - onAt) * (1 - progress) }
  }
  const s = Math.max(0, t - onAt)
  const level = heldLevel(e, s)
  if (s < e.attack) return { phase: 'attack', progress: s / e.attack, level }
  if (s < e.attack + e.decay) return { phase: 'decay', progress: (s - e.attack) / e.decay, level }
  return { phase: 'sustain', progress: Math.min(1, (s - e.attack - e.decay) / SUSTAIN_DRAW), level }
}

// How far each time can go, for the editor and the preset bars. Drawn on a
// square-root scale, so a few ms still shows and 2 s still fits.
export const TIME_LIMITS = {
  attack: { min: 0.001, max: 1.5 },
  decay: { min: 0, max: 1.5 },
  release: { min: 0.01, max: 2 },
}
export type TimeSegment = keyof typeof TIME_LIMITS

export const timeToFraction = (seg: TimeSegment, t: number) => Math.sqrt(t / TIME_LIMITS[seg].max)
export function fractionToTime(seg: TimeSegment, f: number) {
  const { min, max } = TIME_LIMITS[seg]
  const clamped = Math.min(1, Math.max(0, f))
  return Math.max(min, max * clamped * clamped)
}
