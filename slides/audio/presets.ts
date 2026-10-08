import type { Envelope } from './envelope'

export interface EnvelopePreset extends Envelope {
  name: string
  feel: string
}

// PLACEHOLDER(refine): envelope preset values, tune by ear
export const envelopePresets: EnvelopePreset[] = [
  { name: 'Organ', feel: 'a switch', attack: 0.005, decay: 0, sustain: 1, release: 0.05 },
  { name: 'Pluck', feel: 'a plucked string', attack: 0.005, decay: 0.3, sustain: 0, release: 0.2 },
  { name: 'Stab', feel: 'a short synth hit', attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.1 },
  { name: 'Percussive', feel: 'a drum', attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
  { name: 'Pad', feel: 'a slow swell', attack: 0.8, decay: 0.5, sustain: 0.7, release: 1.5 },
]

export interface Chord {
  name: string
  notes: number[]
}

// Silent Night, reharmonized: one chord per bar, and the top note of each
// voicing is the melody note that starts the bar. The last chord leads back
// to the first. Click through in order.
// PLACEHOLDER(refine): voicings, tune by ear
export const progression: Chord[] = [
  { name: 'Cmaj9', notes: [48, 59, 62, 64, 67] }, // Si-lent night
  { name: 'Am11', notes: [45, 55, 60, 62, 67] }, // Ho-ly night
  { name: 'G13sus', notes: [43, 53, 60, 64, 69, 74] }, // All is calm
  { name: 'C6/9', notes: [48, 55, 62, 64, 69, 72] }, // All is bright
  { name: 'Fmaj9', notes: [41, 52, 55, 60, 69] }, // Round yon vir-gin
  { name: 'B♭13♯11', notes: [46, 56, 62, 64, 67] }, // Mo-ther and child
  { name: 'Dm9', notes: [50, 53, 60, 64, 69, 74] }, // Sleep in heav-en-ly
  { name: 'G7♭9♭13', notes: [43, 53, 59, 63, 68] }, // peace
]

export interface FilterPreset {
  name: string
  feel: string
  // The filter: cutoff in Hz, resonance in dB, envelope amount in cents.
  cutoff: number
  resonance: number
  amount: number
  filterEnv: Envelope
  // The volume envelope.
  env: Envelope
  // LFO rate in Hz, or null for off.
  lfo: number | null
}

// The presets on the filters slide: each sets the filter, both envelopes and
// the LFO, for a sawtooth.
// PLACEHOLDER(refine): filter preset values, tune by ear
export const filterPresets: FilterPreset[] = [
  {
    name: 'Acid bass',
    feel: 'a TB-303: resonance and a fast filter envelope',
    cutoff: 300, resonance: 12, amount: 3600,
    filterEnv: { attack: 0.003, decay: 0.2, sustain: 0, release: 0.1 },
    env: { attack: 0.003, decay: 0.3, sustain: 0.6, release: 0.08 },
    lfo: null,
  },
  {
    name: 'Brass',
    feel: 'the filter opens a little slower than the volume',
    cutoff: 600, resonance: 2, amount: 2400,
    filterEnv: { attack: 0.08, decay: 0.4, sustain: 0.4, release: 0.3 },
    env: { attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.3 },
    lfo: null,
  },
  {
    name: 'Pluck',
    feel: 'bright, then dull, like a string',
    cutoff: 400, resonance: 4, amount: 3600,
    filterEnv: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.2 },
    env: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.3 },
    lfo: null,
  },
  {
    name: 'Sweep pad',
    feel: 'the tone opens slowly while you hold',
    cutoff: 250, resonance: 6, amount: 1800,
    filterEnv: { attack: 1.2, decay: 1.5, sustain: 0.5, release: 1.5 },
    env: { attack: 0.6, decay: 0.5, sustain: 0.8, release: 1.5 },
    lfo: null,
  },
  {
    name: 'Wah',
    feel: 'the LFO moves the cutoff instead of the envelope',
    cutoff: 500, resonance: 10, amount: 0,
    filterEnv: { attack: 0.005, decay: 0.35, sustain: 0.2, release: 0.3 },
    env: { attack: 0.01, decay: 0, sustain: 1, release: 0.2 },
    lfo: 4,
  },
  {
    name: 'Thump',
    feel: 'almost every harmonic cut, a short click',
    cutoff: 150, resonance: 0, amount: 1200,
    filterEnv: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
    env: { attack: 0.001, decay: 0.25, sustain: 0.3, release: 0.08 },
    lfo: null,
  },
]
