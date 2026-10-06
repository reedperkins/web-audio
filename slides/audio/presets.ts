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
