import type { Ref } from 'vue'
import { reactive, ref } from 'vue'
import { ctx } from './audio'
import { mtof } from './mtof'

// The cold open: a 16-step chiptune loop with drums, bass, pad and melody.
// Each step is an eighth note, so the loop is two bars, one chord per 4 steps.
// There are a few variations, all on A minor's notes (A minor or C major) so
// any switch sounds related, and one that's generated fresh every time it
// comes up. Switching waits for the top of the loop.
//
// The scheduler is the lookahead pattern from MDN: a timer wakes every TICK ms
// and schedules every step that starts in the next LOOKAHEAD seconds, at its
// exact time on the audio clock. It reads the tempo and the grid as it
// schedules each step, so edits are heard within LOOKAHEAD.
const TICK = 25
const LOOKAHEAD = 0.1
export const STEPS = 16
// How much of a note's length it's held before the release.
const GATE = 0.9
// Stopping fades the loop out over this long instead of cutting it.
const CUT = 0.03
// PLACEHOLDER(refine): how many loops shuffle plays before it switches.
const SHUFFLE_LOOPS = 2
// Jazz swing: the first eighth of each pair gets this share of the beat.
// 0.5 is straight and 2/3 a full triplet feel; this is a light swing.
// PLACEHOLDER(refine): swing amount, tune by ear
const SWING = 0.58
// Jazz comping: within each half bar of a chord, the pad hits on these
// steps (1 and the and-of-2), short, instead of holding.
const COMP = [0, 3]
const STAB = 0.7

// PLACEHOLDER(refine): levels, tune by ear. Worst case they sum to about 1.
const LEVEL = { kick: 0.9, snare: 0.45, hat: 0.2, bass: 0.55, pad: 0.1, melody: 0.28, keys: 0.2, vibes: 0.4 }
const BUS = 0.32

// --- Notes, keys and chords ----------------------------------------------

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

// "C#" → 1, "Bb" → 10.
function pitchClass(name: string) {
  const shift = name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0
  return (LETTERS[name[0]] + shift + 12) % 12
}

// "Eb5" → 75.
function parseNote(token: string) {
  const [, name, octave] = token.match(/^([A-G][#b]?)(\d)$/)!
  return 12 * (Number(octave) + 1) + pitchClass(name)
}

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] }
// The triad built on each degree of the scale: '' major, 'm' minor, 'dim'.
const TRIADS = { major: ['', 'm', 'm', '', '', 'm', 'dim'], minor: ['m', 'dim', '', 'm', 'm', '', ''] }
const SHAPES: Record<string, number[]> = { '': [0, 4, 7], 'm': [0, 3, 7], 'dim': [0, 3, 6] }

export interface Chord {
  name: string
  notes: number[]
  // Its root's pitch class, and '' major, 'm' minor or 'dim'.
  root: number
  quality: string
}

// "Am" → A C E, voiced between G3 and F#4 so the pad stays in one place.
function chord(name: string): Chord {
  const [, root, quality] = name.match(/^([A-G][#b]?)(m|dim)?$/)!
  const notes = SHAPES[quality ?? ''].map((i) => {
    let note = 48 + pitchClass(root) + i
    while (note < 55) note += 12
    while (note > 66) note -= 12
    return note
  })
  return { name, notes: notes.sort((a, b) => a - b), root: pitchClass(root), quality: quality ?? '' }
}

// Modern jazz harmony: the same chord, extended and voiced without its root
// (the bass has it), the way a jazz pianist comps. Each extension comes from
// the key where it can, so it fits what the chord does there:
//   major with a major 7th: maj9, or maj9#11 where the key has the #11 (IV)
//   major with a flat 7th (a dominant): 13, or 7b9b13 outside the key (E in Am)
//   minor: m9, or m11 where the 9th would be a clashing b9 (iii)
//   diminished: m7b5
export function jazzChord(v: Variation, c: Chord): Chord {
  const has = (i: number) => v.diatonic.includes((c.root + i) % 12)
  const either = (want: number, otherwise: number) => (has(want) ? want : otherwise)
  let suffix: string
  let intervals: number[]
  if (c.quality === 'dim') {
    suffix = 'm7♭5'
    intervals = [3, 6, 10, 17]
  }
  else if (c.quality === 'm') {
    if (has(2)) [suffix, intervals] = ['m9', [3, 7, 10, 14]]
    else [suffix, intervals] = ['m11', [3, 10, 17, 19]]
  }
  else if (has(11)) {
    if (has(6)) [suffix, intervals] = ['maj9♯11', [4, 11, 14, 18]]
    else [suffix, intervals] = ['maj9', [4, 7, 11, 14]]
  }
  else {
    const ninth = either(2, 1)
    const thirteenth = either(9, 8)
    suffix = ninth === 2 && thirteenth === 9 ? '13' : `7${ninth === 1 ? '♭9' : ''}${thirteenth === 8 ? '♭13' : ''}`
    intervals = [4, 10, 12 + ninth, 12 + thirteenth]
  }
  // Lowest note between E3 and D#4, under the melody.
  let notes = intervals.map(i => 48 + c.root + i)
  while (Math.min(...notes) < 52) notes = notes.map(n => n + 12)
  while (Math.min(...notes) > 63) notes = notes.map(n => n - 12)
  return { ...c, name: c.name.replace(/(m|dim)$/, '') + suffix, notes }
}

type Mode = keyof typeof SCALES

interface Key {
  tonic: string
  mode: Mode
  // Notes and chords from outside the scale, like the major V in a minor key.
  extraNotes?: string[]
  extraChords?: string[]
}

// The pad chord sounding at step i: the last pad cell on at or before it.
function chordAt(v: Variation, i: number): Chord | null {
  for (let n = 0; n < STEPS; n++) {
    const cell = v.cells.pad[(i - n + STEPS) % STEPS]
    if (cell.on) return v.chords[cell.value]
  }
  return null
}

// The melody note at step i, moved toward the jazz chord's colors: within a
// whole step, to the nearest note of its voicing (9ths, 13ths, #11s) or its
// root, which the voicing leaves to the bass.
function colorTone(v: Variation, i: number) {
  const note = v.cells.melody[i].value
  const c = chordAt(v, i)
  if (!c) return note
  const colors = [c.root, ...jazzChord(v, c).notes.map(n => n % 12)]
  for (const d of [0, 1, -1, 2, -2]) {
    if (colors.includes((note + d) % 12)) return note + d
  }
  return note
}

// The melody as a jazz player might bend it: notes on the beat land on the
// chord's colors, the off-beat note right before a chord change becomes a
// chromatic approach a half step under where the melody lands next, and
// other off-beat notes pass through as written.
export function jazzMelody(v: Variation, i: number) {
  const next = (i + 1) % STEPS
  if (i % 2 === 1 && next % 4 === 0 && v.cells.melody[next].on) return colorTone(v, next) - 1
  if (i % 2 === 0) return colorTone(v, i)
  return v.cells.melody[i].value
}

// --- Tracks and variations -----------------------------------------------

export type TrackId = 'kick' | 'snare' | 'hat' | 'bass' | 'pad' | 'melody'

export interface Track {
  id: TrackId
  name: string
  group: 'drums' | 'bass' | 'pad' | 'melody'
  kind: 'drum' | 'note' | 'chord'
  // The lowest and highest MIDI note a note cell can move to.
  range?: [number, number]
}

export const TRACKS: Track[] = [
  { id: 'kick', name: 'kick', group: 'drums', kind: 'drum' },
  { id: 'snare', name: 'snare', group: 'drums', kind: 'drum' },
  { id: 'hat', name: 'hat', group: 'drums', kind: 'drum' },
  { id: 'bass', name: 'bass', group: 'bass', kind: 'note', range: [28, 60] },
  { id: 'pad', name: 'pad', group: 'pad', kind: 'chord' },
  { id: 'melody', name: 'melody', group: 'melody', kind: 'note', range: [57, 88] },
]

export interface Cell {
  on: boolean
  // A MIDI note for note tracks, an index into the variation's chords for
  // the pad, unused for drums.
  value: number
}

export interface Variation {
  name: string
  // Shown under the picker, e.g. "D minor".
  key: string
  random: boolean
  // Pitch classes a scrolled note moves through.
  scale: number[]
  // Just the key's own seven, which the jazz extensions come from.
  diatonic: number[]
  // The chords a scrolled pad cell cycles through.
  chords: Chord[]
  // How each pitch class is spelled in this key.
  spelling: string[]
  cells: Record<TrackId, Cell[]>
}

export const noteName = (v: Variation, note: number) => `${v.spelling[note % 12]}${Math.floor(note / 12) - 1}`

function keyParts({ tonic, mode, extraNotes = [], extraChords = [] }: Key) {
  const root = pitchClass(tonic)
  const flats = tonic.includes('b') || (mode === 'major' ? ['F'] : ['D', 'G', 'C', 'F']).includes(tonic)
  const spelling = [...(flats ? FLATS : SHARPS)]
  for (const name of extraNotes) spelling[pitchClass(name)] = name
  const scale = SCALES[mode].map(i => (root + i) % 12)
  const triads = scale.map((pc, d) => spelling[pc] + TRIADS[mode][d])
  return {
    key: `${tonic} ${mode}`,
    scale: [...scale, ...extraNotes.map(pitchClass)],
    diatonic: scale,
    chords: [...triads, ...extraChords].map(chord),
    spelling,
  }
}

// "x . . x" → drum cells.
function hits(text: string): Cell[] {
  return text.trim().split(/\s+/).map(c => ({ on: c === 'x', value: 0 }))
}

// "A2 . C3" → note cells. A "." is off and keeps the note before it (the
// first note, at the start), so turning it on starts from a sensible pitch.
function notes(text: string): Cell[] {
  const tokens = text.trim().split(/\s+/)
  let last = parseNote(tokens.find(t => t !== '.')!)
  return tokens.map((t) => {
    if (t !== '.') last = parseNote(t)
    return { on: t !== '.', value: last }
  })
}

function chordCells(text: string, chords: Chord[]): Cell[] {
  const tokens = text.trim().split(/\s+/)
  let last = 0
  return tokens.map((t) => {
    if (t !== '.') last = chords.findIndex(c => c.name === t)
    return { on: t !== '.', value: last }
  })
}

function written(name: string, key: Key, parts: Record<TrackId, string>): Variation {
  const k = keyParts(key)
  return {
    name,
    random: false,
    ...k,
    cells: {
      kick: hits(parts.kick),
      snare: hits(parts.snare),
      hat: hits(parts.hat),
      bass: notes(parts.bass),
      pad: chordCells(parts.pad, k.chords),
      melody: notes(parts.melody),
    },
  }
}

// --- The random variation ------------------------------------------------

const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)]
const chance = (p: number) => Math.random() < p

// A minor and C major share every note, so the random tune never jumps key
// against the others.
const RANDOM_KEYS: Key[] = [{ tonic: 'A', mode: 'minor' }, { tonic: 'C', mode: 'major' }]

// Scale degrees (0 = the tonic chord), one chord per half bar.
const PROGRESSIONS: Record<Mode, number[][]> = {
  major: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 4, 3], [5, 3, 0, 4], [0, 3, 0, 4]],
  minor: [[0, 5, 2, 6], [0, 6, 5, 6], [0, 3, 5, 4], [0, 2, 6, 5], [0, 5, 3, 4]],
}

// A bass figure for one chord: r root, o octave up, . rest.
const BASS_FIGURES = ['r . r .', 'r r o r', 'r o r o', 'r . . o', 'r r r o']

const HAT_PATTERNS = [
  '. x . x . x . x . x . x . x . x',
  'x x x x x x x x x x x x x x x x',
  'x . x . x . x . x . x . x . x .',
  '. x x x . x x x . x x x . x x x',
]

// A new loop: a random key, progression, drum pattern, bass figure and a
// melody that walks between chord tones on the beat and scale notes off it.
function generate(): Variation {
  const key = pick(RANDOM_KEYS)
  const k = keyParts(key)
  const progression = pick(PROGRESSIONS[key.mode])

  const kick = Array.from({ length: STEPS }, (_, i) =>
    ({ on: i % 8 === 0 || chance(i % 2 === 0 ? 0.3 : 0.12), value: 0 }))
  const snare = Array.from({ length: STEPS }, (_, i) =>
    ({ on: (i % 4 === 2 && chance(0.9)) || (i % 4 !== 2 && chance(0.06)), value: 0 }))
  const hat = hits(pick(HAT_PATTERNS))

  const figure = pick(BASS_FIGURES).split(' ')
  const bass: Cell[] = []
  const pad: Cell[] = []
  const melody: Cell[] = []
  let last = 60 + k.scale[0] + (k.scale[0] < 7 ? 12 : 0)

  progression.forEach((degree) => {
    const chordTones = k.chords[degree].notes.map(n => n % 12)
    const root = 36 + k.scale[degree]
    for (let n = 0; n < 4; n++) {
      const f = figure[n]
      bass.push({ on: f !== '.', value: f === 'o' ? root + 12 : root })
      pad.push({ on: n === 0, value: degree })

      // A new note close to the last, from chord tones on the beat.
      const allowed = n % 2 === 0 ? chordTones : k.scale
      const near: number[] = []
      for (let note = last - 5; note <= last + 5; note++) {
        if (note !== last && note >= 65 && note <= 86 && allowed.includes(note % 12)) near.push(note)
      }
      if (near.length) last = pick(near)
      melody.push({ on: n === 0 || chance(0.6), value: last })
    }
  })

  return {
    name: 'Random',
    random: true,
    ...k,
    cells: { kick, snare, hat, bass, pad, melody },
  }
}

// PLACEHOLDER(refine): the tunes.
export const variations = reactive<Variation[]>([
  // The original: Am F C G.
  written('Overworld', { tonic: 'A', mode: 'minor' }, {
    kick: 'x . . . x . . x x . . . x . . .',
    snare: '. . x . . . x . . . x . . . x x',
    hat: '. x . x . x . x . x . x . x . x',
    bass: 'A2 A3 A2 A3 F2 F3 F2 F3 C3 C4 C3 C4 G2 G3 G2 G3',
    pad: 'Am . . . F . . . C . . . G . . .',
    melody: 'E5 . C5 A4 F5 . E5 C5 G5 . E5 C5 D5 . B4 D5',
  }),
  // Four on the floor and an arpeggio. The E major chord brings in G#, the
  // one note from outside A minor.
  written('Chase', { tonic: 'A', mode: 'minor', extraNotes: ['G#'], extraChords: ['E'] }, {
    kick: 'x . x . x . x . x . x . x . x x',
    snare: '. . x . . . x . . . x . . . x .',
    hat: 'x x x x x x x x x x x x x x x x',
    bass: 'A2 A2 A3 A2 F2 F2 F3 F2 G2 G2 G3 G2 E2 E2 E3 G#2',
    pad: 'Am . . . F . . . G . . . E . . .',
    melody: 'A4 C5 E5 C5 A4 C5 F5 C5 G4 B4 D5 B4 G#4 B4 E5 B4',
  }),
  // Sparse and low, also landing on E major.
  written('Cave', { tonic: 'A', mode: 'minor', extraNotes: ['G#'], extraChords: ['E'] }, {
    kick: 'x . . . . . . . x . . x . . . .',
    snare: '. . . . . . . . . . . . x . . .',
    hat: '. . x . . . x . . . x . . . x .',
    bass: 'A2 . . . . . . . F2 . . . . . E2 .',
    pad: 'Am . . . . . . . F . . . . . E .',
    melody: 'E5 . . C5 . . B4 . A4 . . C5 . . B4 G#4',
  }),
  // C major, A minor's relative major: the same notes, so it's bright
  // without a key change. C G Am F.
  written('Victory', { tonic: 'C', mode: 'major' }, {
    kick: 'x . . x . . x . x . . x . . x .',
    snare: '. . x . . . x . . . x . . . x .',
    hat: '. x . x . x . x . x . x . x x x',
    bass: 'C3 C4 C3 C4 G2 G3 G2 G3 A2 A3 A2 A3 F2 F3 F2 G3',
    pad: 'C . . . G . . . Am . . . F . . .',
    melody: 'E5 G5 C6 . D6 . B5 G5 C6 . A5 E5 F5 A5 G5 .',
  }),
  generate(),
])

export const muted = reactive<Record<TrackId, boolean>>({
  kick: false, snare: false, hat: false, bass: false, pad: false, melody: false,
})

// Move a note cell up or down the variation's scale, or a chord cell through
// its chords.
export function nudge(v: Variation, track: Track, cell: Cell, dir: 1 | -1) {
  if (track.kind === 'chord') {
    cell.value = (cell.value + dir + v.chords.length) % v.chords.length
  }
  else if (track.kind === 'note') {
    const [lo, hi] = track.range!
    let note = cell.value + dir
    while (!v.scale.includes(note % 12)) note += dir
    if (note >= lo && note <= hi) cell.value = note
  }
}

// --- Instruments ---------------------------------------------------------

// The NES's pulse channel: a square wave with a narrower duty cycle. Built
// from its Fourier series, cosine terms only.
function pulse(duty: number, harmonics = 64) {
  const real = new Float32Array(harmonics)
  const imag = new Float32Array(harmonics)
  for (let n = 1; n < harmonics; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty)
  return new PeriodicWave(ctx, { real, imag })
}

const PULSE_25 = pulse(0.25)
const PULSE_12 = pulse(0.125)

// The NES's noise channel: random ±1, each held for a few samples, so it's
// grittier than smooth white noise.
const noise = (() => {
  const hold = 3
  const buffer = new AudioBuffer({ length: ctx.sampleRate, sampleRate: ctx.sampleRate })
  const data = buffer.getChannelData(0)
  let v = 1
  for (let i = 0; i < data.length; i++) {
    if (i % hold === 0) v = Math.random() < 0.5 ? -1 : 1
    data[i] = v
  }
  return buffer
})()

// A gain that jumps to `peak` at `t` and decays toward 0.
function hitEnvelope(t: number, peak: number, decay: number) {
  const amp = new GainNode(ctx, { gain: 0 })
  amp.gain.setValueAtTime(peak, t)
  amp.gain.exponentialRampToValueAtTime(0.001, t + decay)
  return amp
}

// A held note: a near-instant attack, a dip to `sustain`, and a short release.
function noteEnvelope(t: number, hold: number, peak: number, sustain: number, attack = 0.004) {
  const amp = new GainNode(ctx, { gain: 0 })
  amp.gain.setValueAtTime(0, t)
  amp.gain.linearRampToValueAtTime(peak, t + attack)
  amp.gain.setTargetAtTime(peak * sustain, t + attack, 0.08)
  amp.gain.setTargetAtTime(0, t + hold, 0.02)
  return amp
}

function playNoise(t: number, peak: number, decay: number, highpass: number, into: AudioNode) {
  const src = new AudioBufferSourceNode(ctx, { buffer: noise })
  const filter = new BiquadFilterNode(ctx, { type: 'highpass', frequency: highpass })
  src.connect(filter).connect(hitEnvelope(t, peak, decay)).connect(into)
  src.start(t, Math.random() * 0.5)
  src.stop(t + decay)
}

function playOsc(
  t: number,
  end: number,
  frequency: number,
  wave: OscillatorType | PeriodicWave,
  amp: GainNode,
  into: AudioNode,
) {
  const osc = new OscillatorNode(ctx, { frequency })
  if (wave instanceof PeriodicWave) osc.setPeriodicWave(wave)
  else osc.type = wave
  osc.connect(amp).connect(into)
  osc.start(t)
  osc.stop(end)
  return osc
}

// The kick: a triangle whose pitch drops fast, like the NES triangle channel.
function kick(t: number, into: AudioNode) {
  const osc = playOsc(t, t + 0.2, 160, 'triangle', hitEnvelope(t, LEVEL.kick, 0.18), into)
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12)
}

function snare(t: number, into: AudioNode) {
  playNoise(t, LEVEL.snare, 0.14, 1200, into)
  const osc = playOsc(t, t + 0.08, 220, PULSE_25, hitEnvelope(t, LEVEL.snare * 0.4, 0.07), into)
  osc.frequency.exponentialRampToValueAtTime(110, t + 0.06)
}

function hat(t: number, into: AudioNode) {
  playNoise(t, LEVEL.hat, 0.035, 7000, into)
}

function bass(t: number, hold: number, note: number, into: AudioNode) {
  playOsc(t, t + hold + 0.1, mtof(note), 'triangle', noteEnvelope(t, hold, LEVEL.bass, 0.8), into)
}

// The pad: each chord tone on a thin pulse, two copies detuned a little,
// through a lowpass, with a slower attack.
function pad(t: number, hold: number, chord: Chord, into: AudioNode) {
  const filter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 1800, Q: 0.5 })
  filter.connect(into)
  // Four-note jazz voicings play each note a little softer.
  const level = (LEVEL.pad * 3) / chord.notes.length
  for (const note of chord.notes) {
    for (const cents of [-7, 7]) {
      const amp = noteEnvelope(t, hold, level, 0.7, 0.06)
      const osc = playOsc(t, t + hold + 0.15, mtof(note), PULSE_12, amp, filter)
      osc.detune.value = cents
    }
  }
}

// The melody: a 25% pulse with a little vibrato that fades in.
function melody(t: number, hold: number, note: number, into: AudioNode) {
  const osc = playOsc(t, t + hold + 0.1, mtof(note), PULSE_25, noteEnvelope(t, hold, LEVEL.melody, 0.6), into)
  const lfo = new OscillatorNode(ctx, { frequency: 6 })
  const depth = new GainNode(ctx, { gain: 0 })
  depth.gain.setValueAtTime(0, t + 0.15)
  depth.gain.linearRampToValueAtTime(18, t + 0.4)
  lfo.connect(depth).connect(osc.detune)
  lfo.start(t)
  lfo.stop(t + hold + 0.1)
}

// Jazz pad: an FM electric piano. A sine modulates another sine at the same
// pitch; the modulation starts strong for the bell-like attack and fades,
// leaving a soft, round tone that decays like a struck tine.
function keys(t: number, hold: number, c: Chord, into: AudioNode) {
  const level = (LEVEL.keys * 3) / c.notes.length
  for (const note of c.notes) {
    const f = mtof(note)
    const end = t + hold + 0.3
    const amp = new GainNode(ctx, { gain: 0 })
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(level, t + 0.004)
    amp.gain.setTargetAtTime(0, t + 0.004, 0.5)
    amp.gain.setTargetAtTime(0, t + hold, 0.06)
    const osc = playOsc(t, end, f, 'sine', amp, into)
    const mod = new OscillatorNode(ctx, { frequency: f })
    const index = new GainNode(ctx, { gain: f * 1.4 })
    index.gain.setTargetAtTime(f * 0.15, t, 0.12)
    mod.connect(index).connect(osc.frequency)
    mod.start(t)
    mod.stop(end)
  }
}

// Jazz melody: a vibraphone. A sine plus its fourth harmonic (the bar's
// bright overtone, which dies first), a mallet-fast attack, a long ring, and
// the motor's tremolo.
function vibes(t: number, hold: number, note: number, into: AudioNode) {
  const f = mtof(note)
  const end = t + hold + 0.6
  const tremolo = new GainNode(ctx, { gain: 0.8 })
  const lfo = new OscillatorNode(ctx, { frequency: 5.5 })
  const depth = new GainNode(ctx, { gain: 0.2 })
  lfo.connect(depth).connect(tremolo.gain)
  tremolo.connect(into)
  lfo.start(t)
  lfo.stop(end)

  const amp = new GainNode(ctx, { gain: 0 })
  amp.gain.setValueAtTime(0, t)
  amp.gain.linearRampToValueAtTime(LEVEL.vibes, t + 0.002)
  amp.gain.setTargetAtTime(0, t + 0.002, 0.7)
  amp.gain.setTargetAtTime(0, t + hold + 0.1, 0.15)
  playOsc(t, end, f, 'sine', amp, tremolo)
  playOsc(t, t + 0.3, f * 4, 'sine', hitEnvelope(t, LEVEL.vibes * 0.25, 0.25), tremolo)
}

// --- Scheduler -----------------------------------------------------------

// How many steps until this row's next on cell, so a note holds until the
// next one starts. Wraps around the loop.
function stepsToNext(cells: Cell[], from: number) {
  for (let n = 1; n <= STEPS; n++) {
    if (cells[(from + n) % STEPS].on) return n
  }
  return STEPS
}

export function createSequencer(bpm: Ref<number>) {
  let timer: ReturnType<typeof setInterval> | undefined
  let bus: GainNode | null = null
  let gains = new Map<TrackId, GainNode>()
  let step = 0
  let next = 0
  let loops = 0
  // Steps scheduled but not yet heard, so the grid can follow the audio clock.
  const queue: { step: number; time: number; variation: Variation }[] = []

  // The variation being scheduled, and the one picked to play from the top
  // of the next loop.
  const selected = ref(0)
  const pending = ref<number | null>(null)
  // Every SHUFFLE_LOOPS loops, switch to a different variation at random.
  const shuffle = ref(false)
  // Jazz mode: jazz voicings comped on an electric piano, the melody bent
  // toward them on a vibraphone, and everything swung.
  const jazz = ref(false)

  const stepLength = () => 60 / bpm.value / 2
  // With swing, each off-beat step is pushed late.
  const swing = (i: number) => (jazz.value && i % 2 === 1 ? (2 * SWING - 1) * stepLength() : 0)
  // Seconds from step i to n steps later, swing included.
  const span = (i: number, n: number) => n * stepLength() + swing(i + n) - swing(i)

  // The random variation is new every time it comes up.
  function apply(i: number) {
    if (variations[i].random) variations[i] = generate()
    selected.value = i
  }

  // While playing, the switch waits for the top of the loop.
  function select(i: number) {
    if (timer) pending.value = i
    else apply(i)
  }

  function atLoopStart() {
    loops++
    if (pending.value !== null) {
      apply(pending.value)
      pending.value = null
      loops = 0
    }
    else if (shuffle.value && loops >= SHUFFLE_LOOPS) {
      const others = variations.map((_, i) => i).filter(i => i !== selected.value)
      apply(pick(others))
      loops = 0
    }
  }

  function schedule(i: number, t: number) {
    const v = variations[selected.value]
    for (const track of TRACKS) {
      const cells = v.cells[track.id]
      const cell = cells[i]
      if (!cell.on) continue
      const out = gains.get(track.id)!
      const steps = stepsToNext(cells, i)
      const hold = span(i, steps) * GATE
      if (track.id === 'kick') kick(t, out)
      else if (track.id === 'snare') snare(t, out)
      else if (track.id === 'hat') hat(t, out)
      else if (track.id === 'bass') bass(t, hold, cell.value, out)
      else if (track.id === 'pad' && jazz.value) comp(i, t, steps, jazzChord(v, v.chords[cell.value]), out)
      else if (track.id === 'pad') pad(t, hold, v.chords[cell.value], out)
      else if (jazz.value) vibes(t, hold, jazzMelody(v, i), out)
      else melody(t, hold, cell.value, out)
    }
  }

  // Short stabs on the COMP steps of each half bar the chord lasts.
  function comp(i: number, t: number, steps: number, c: Chord, out: AudioNode) {
    for (let n = 0; n < steps; n++) {
      if (COMP.includes(n % 4)) keys(t + span(i, n), stepLength() * STAB, c, out)
    }
  }

  function tick() {
    while (next < ctx.currentTime + LOOKAHEAD) {
      if (step === 0) atLoopStart()
      const t = next + swing(step)
      schedule(step, t)
      queue.push({ step, time: t, variation: variations[selected.value] })
      next += stepLength()
      step = (step + 1) % STEPS
    }
  }

  function start(into: AudioNode) {
    if (timer) return
    // A fresh bus each run, so stopping can fade the whole loop at once,
    // held pad notes included.
    bus = new GainNode(ctx, { gain: BUS })
    bus.connect(into)
    gains = new Map(TRACKS.map(t => [t.id, new GainNode(ctx, { gain: muted[t.id] ? 0 : 1 })]))
    for (const g of gains.values()) g.connect(bus)
    step = 0
    // The first loop start isn't a switch.
    loops = -1
    next = ctx.currentTime + 0.05
    queue.length = 0
    tick()
    timer = setInterval(tick, TICK)
  }

  function stop() {
    if (!timer) return
    clearInterval(timer)
    timer = undefined
    queue.length = 0
    if (pending.value !== null) apply(pending.value)
    pending.value = null
    const old = bus!
    const t = ctx.currentTime
    old.gain.cancelScheduledValues(t)
    old.gain.setValueAtTime(old.gain.value, t)
    old.gain.linearRampToValueAtTime(0, t + CUT)
    setTimeout(() => old.disconnect(), CUT * 1000 + 50)
    bus = null
  }

  // Mutes fade in a few ms, so held notes go quiet too.
  function setMuted(id: TrackId, value: boolean) {
    muted[id] = value
    gains.get(id)?.gain.setTargetAtTime(value ? 0 : 1, ctx.currentTime, 0.01)
  }

  // The step sounding now and its variation, or null when stopped.
  function current() {
    while (queue.length > 1 && queue[1].time <= ctx.currentTime) queue.shift()
    return queue.length && queue[0].time <= ctx.currentTime ? queue[0] : null
  }

  return { start, stop, select, setMuted, current, selected, pending, shuffle, jazz }
}
