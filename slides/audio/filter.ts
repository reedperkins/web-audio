import { reactive, watch } from 'vue'
import { ctx } from './audio'
import type { Envelope } from './envelope'
import { GLIDE, fadeOut } from './envelope'

// The synth's lowpass filter: one per voice, between the oscillator and the
// envelope's gain. The "Carve it: filters" slide edits these settings; every
// new note reads them, and held notes follow cutoff and resonance changes.
//
// It starts wide open (cutoff at the top, no resonance), so it can't be heard
// until that slide changes it. The envelope amount starts at 1 octave for that
// slide; with the cutoff at the top it changes nothing (the cutoff can't go
// past it).
export interface FilterSettings {
  // Hz
  cutoff: number
  // dB: for a lowpass, Q is a resonance peak at the cutoff, not a classic Q.
  resonance: number
  // Cents the envelope opens the filter by, on top of the cutoff.
  amount: number
}

// The top is Nyquist: a lowpass there passes everything exactly, so the
// wide-open filter leaves earlier slides sounding as they did.
export const CUTOFF_RANGE = { min: 40, max: ctx.sampleRate / 2 }
// Past about 15 dB, a cutoff sitting on a chord's fundamentals can clip.
export const RESONANCE_MAX = 15
export const AMOUNT_MAX = 4800
export const OPEN: FilterSettings = { cutoff: CUTOFF_RANGE.max, resonance: 0, amount: 1200 }

export const filter = reactive<FilterSettings>({ ...OPEN })

// The filter's own envelope, separate from the volume's. Its shape is scaled
// by `filter.amount`: at 0 the cutoff never moves.
// PLACEHOLDER(refine): filter envelope defaults, tune by ear
export const filterEnv = reactive<Envelope>({ attack: 0.005, decay: 0.35, sustain: 0.2, release: 0.3 })

// Glide for slider changes on held notes, so dragging doesn't zipper.
const SMOOTH = 0.02

// An LFO on every voice's cutoff, for the wah step. Off (depth 0) unless a
// slide turns it on with `setWah`; `wah.rate` can change while it runs.
// PLACEHOLDER(refine): wah depth and rate range, tune by ear
export const WAH_DEPTH = 1200
export const WAH_RATE = { min: 0.2, max: 12 }
export const wah = reactive({ rate: 3 })
let wahLfo: OscillatorNode | null = null
// The LFO's phase (in cycles) at `wahFrom`, so the picture stays in step
// when the rate changes.
let wahFrom = 0
let wahPhase = 0
const wahDepth = new GainNode(ctx, { gain: 0 })

export function setWah(on: boolean) {
  const t = ctx.currentTime
  if (on && !wahLfo) {
    wahLfo = new OscillatorNode(ctx, { frequency: wah.rate })
    wahLfo.connect(wahDepth)
    wahLfo.start(t)
    wahFrom = t
    wahPhase = 0
    wahDepth.gain.setTargetAtTime(WAH_DEPTH, t, SMOOTH)
  } else if (!on && wahLfo) {
    wahDepth.gain.setTargetAtTime(0, t, SMOOTH)
    wahLfo.stop(t + 0.2)
    wahLfo = null
  }
}

// An oscillator's frequency can jump without a click: its phase carries on.
let wahRate = wah.rate
watch(() => wah.rate, (rate) => {
  const t = ctx.currentTime
  wahPhase += wahRate * (t - wahFrom)
  wahFrom = t
  wahRate = rate
  wahLfo?.frequency.setValueAtTime(rate, t)
})

// The filter envelope: noteOn's ramps, aimed at the filter's detune and
// scaled by `amount`. Each voice has a fresh filter, so there's nothing to
// cancel first.
function filterOn(detune: AudioParam, t: number) {
  const { attack, decay, sustain } = filterEnv
  detune.setValueAtTime(0, t)
  detune.linearRampToValueAtTime(filter.amount, t + attack)
  detune.linearRampToValueAtTime(filter.amount * sustain, t + attack + decay)
}

// And noteOff's: back to the cutoff over the release, from wherever it is.
const filterOff = (detune: AudioParam, t: number) => fadeOut(detune, t, filterEnv.release)

// One voice's filter, and what its envelope was scheduled with, for drawing
// where the cutoff is and for moving held notes when `amount` changes.
interface Sweep {
  node: BiquadFilterNode
  frequency: number
  at: number
  off: number | null
  amount: number
  attack: number
  decay: number
  sustain: number
  release: number
}
const KEEP = 16
const sweeps: Sweep[] = []
const live = new Set<Sweep>()

// A filter for one voice starting at `t`, with its envelope scheduled. It
// follows the settings until `source` ends. Call `release(t)` at note-off.
export function voiceFilter(frequency: number, t: number, source: AudioScheduledSourceNode) {
  const node = new BiquadFilterNode(ctx, {
    type: 'lowpass',
    frequency: filter.cutoff,
    Q: filter.resonance,
  })
  filterOn(node.detune, t)
  wahDepth.connect(node.detune)
  const sweep: Sweep = { node, frequency, at: t, off: null, amount: filter.amount, ...filterEnv }
  live.add(sweep)
  source.addEventListener('ended', () => {
    wahDepth.disconnect(node.detune)
    live.delete(sweep)
  })
  sweeps.push(sweep)
  if (sweeps.length > KEEP) sweeps.shift()
  return {
    node,
    release(at: number) {
      sweep.off = at
      sweep.release = filterEnv.release
      filterOff(node.detune, at)
    },
  }
}

watch(() => filter.cutoff, (cutoff) => {
  for (const { node } of live) node.frequency.setTargetAtTime(cutoff, ctx.currentTime, SMOOTH)
})
watch(() => filter.resonance, (resonance) => {
  for (const { node } of live) node.Q.setTargetAtTime(resonance, ctx.currentTime, SMOOTH)
})
// Held notes that have reached their sustain glide to the new amount.
watch(() => filter.amount, (amount) => {
  const t = ctx.currentTime
  for (const sweep of live) {
    if (sweep.off !== null || t < sweep.at + sweep.attack + sweep.decay) continue
    sweep.amount = amount
    sweep.node.detune.setTargetAtTime(amount * sweep.sustain, t, SMOOTH)
  }
})

function envelopeDetune(sweep: Sweep, t: number): number {
  const { at, off, amount, attack, decay, sustain, release } = sweep
  if (off !== null && t >= off) {
    const held = envelopeDetune({ ...sweep, off: null }, off)
    return held * Math.exp((-GLIDE * (t - off)) / release)
  }
  const s = t - at
  if (s < attack) return amount * s / attack
  if (s < attack + decay) return amount * (1 - (1 - sustain) * (s - attack) / decay)
  return amount * sustain
}

// The latest note that has started by `t`, and the filter's detune for it
// then (envelope plus wah), mirroring what filterOn, filterOff and the LFO
// schedule.
export function sweepAt(t: number) {
  let note: Sweep | undefined
  for (let i = sweeps.length - 1; i >= 0; i--) {
    if (sweeps[i].at <= t) {
      note = sweeps[i]
      break
    }
  }
  let detune = note ? envelopeDetune(note, t) : 0
  if (wahLfo) detune += WAH_DEPTH * Math.sin(2 * Math.PI * (wahPhase + wahRate * (t - wahFrom)))
  return { frequency: note?.frequency ?? null, detune }
}

// The filter's response in dB at each of `hz`, for the current settings
// plus `detune`. A probe node that's never connected answers it.
const probe = new BiquadFilterNode(ctx, { type: 'lowpass' })
export function responseDb(hz: Float32Array, detune: number) {
  probe.frequency.value = filter.cutoff
  probe.Q.value = filter.resonance
  probe.detune.value = detune
  const mag = new Float32Array(hz.length)
  probe.getFrequencyResponse(hz, mag, new Float32Array(hz.length))
  return mag.map((m) => 20 * Math.log10(Math.max(m, 1e-6)))
}

// A hot update would leave the old watchers running. Reload instead.
if (import.meta.hot) import.meta.hot.decline()
