import type { Envelope } from './envelope'
import type { Step } from './sequencer'

// The song presets on the "Wave types" slide: each one sets the synth's wave
// and envelope, then loops a melody through the sequencer.
export interface Song {
  name: string
  wave: OscillatorType
  env: Envelope
  bpm: number
  steps: Step[]
}

const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

// "Bb4:2 F4:1.5 r:.5" → steps: note name and octave (or r for a rest), then
// its length in beats.
function melody(text: string): Step[] {
  return text.trim().split(/\s+/).map((token) => {
    const [name, beats] = token.split(':')
    if (name === 'r') return { note: null, beats: Number(beats) }
    const [, letter, accidental, octave] = name.match(/^([A-G])([#b]?)(\d)$/)!
    const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
    return { note: 12 * (Number(octave) + 1) + LETTERS[letter] + shift, beats: Number(beats) }
  })
}

const third = 1 / 3

// PLACEHOLDER(refine): melodies, tempos and envelopes, tune by ear
export const songs: Song[] = [
  {
    // The NES overworld theme. A square wave with an envelope that's nearly a
    // switch, and short gaps between notes: that's the 8-bit sound.
    name: 'Zelda',
    wave: 'square',
    env: { attack: 0.003, decay: 0.12, sustain: 0.6, release: 0.03 },
    bpm: 150,
    steps: melody(`
      Bb4:2 F4:1.5 Bb4:.5
      Bb4:.25 C5:.25 D5:.25 Eb5:.25 F5:2 F5:${third} Gb5:${third} Ab5:${third}
      Bb5:3 Bb5:${third} Ab5:${third} Gb5:${third}
      Ab5:.75 Gb5:.25 F5:3
      Eb5:.5 Eb5:.25 F5:.25 Gb5:2 F5:.5 Eb5:.5
      Db5:.5 Db5:.25 Eb5:.25 F5:2 Eb5:.5 Db5:.5
      C5:.5 C5:.25 D5:.25 E5:2 G5:1
      F5:.5 F4:.25 F4:.25 F4:.5 F4:.25 F4:.25 F4:.5 F4:.25 F4:.25 F4:.5 F4:.5
    `),
  },
  {
    name: 'Mountain King',
    wave: 'sawtooth',
    env: { attack: 0.005, decay: 0.15, sustain: 0.4, release: 0.08 },
    bpm: 160,
    steps: melody(`
      A3:.5 B3:.5 C4:.5 D4:.5 E4:.5 C4:.5 E4:1
      D#4:.5 B3:.5 D#4:1 D4:.5 Bb3:.5 D4:1
      A3:.5 B3:.5 C4:.5 D4:.5 E4:.5 C4:.5 E4:.5 A4:.5
      G4:.5 E4:.5 C4:.5 E4:.5 G4:2
    `),
  },
  {
    name: 'Für Elise',
    wave: 'triangle',
    env: { attack: 0.005, decay: 0.4, sustain: 0, release: 0.3 },
    bpm: 70,
    steps: melody(`
      E5:.25 D#5:.25 E5:.25 D#5:.25 E5:.25 B4:.25 D5:.25 C5:.25 A4:.75
      C4:.25 E4:.25 A4:.25 B4:.75 E4:.25 G#4:.25 B4:.25 C5:.75
      E4:.25 E5:.25 D#5:.25 E5:.25 D#5:.25 E5:.25 B4:.25 D5:.25 C5:.25 A4:.75
      C4:.25 E4:.25 A4:.25 B4:.75 E4:.25 C5:.25 B4:.25 A4:1.5
    `),
  },
  {
    name: 'Ode to Joy',
    wave: 'sine',
    env: { attack: 0.06, decay: 0.2, sustain: 0.8, release: 0.4 },
    bpm: 120,
    steps: melody(`
      E5:1 E5:1 F5:1 G5:1 G5:1 F5:1 E5:1 D5:1
      C5:1 C5:1 D5:1 E5:1 E5:1.5 D5:.5 D5:2
      E5:1 E5:1 F5:1 G5:1 G5:1 F5:1 E5:1 D5:1
      C5:1 C5:1 D5:1 E5:1 D5:1.5 C5:.5 C5:2
    `),
  },
]
