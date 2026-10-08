import type { Ref } from 'vue'
import { reactive } from 'vue'
import { ctx } from './audio'
import { mtof } from './mtof'

// The cold open: a 16-step chiptune loop with drums, bass, pad and melody.
// Each step is an eighth note, so the loop is two bars, one chord per 4 steps.
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

// PLACEHOLDER(refine): levels, tune by ear. Worst case they sum to about 1.
const LEVEL = { kick: 0.9, snare: 0.45, hat: 0.2, bass: 0.55, pad: 0.1, melody: 0.28 }
const BUS = 0.32

// A natural minor, the key of the loop. Note and chord cells move through it.
const SCALE = [9, 11, 0, 2, 4, 5, 7]

export const CHORDS = [
  { name: 'Am', notes: [57, 60, 64] },
  { name: 'F', notes: [57, 60, 65] },
  { name: 'C', notes: [55, 60, 64] },
  { name: 'G', notes: [55, 59, 62] },
  { name: 'Dm', notes: [57, 62, 65] },
  { name: 'Em', notes: [55, 59, 64] },
]

export type TrackKind = 'drum' | 'note' | 'chord'

export interface Cell {
  on: boolean
  // A MIDI note for note tracks, an index into CHORDS for the pad, unused for drums.
  value: number
}

export interface Track {
  id: 'kick' | 'snare' | 'hat' | 'bass' | 'pad' | 'melody'
  name: string
  group: 'drums' | 'bass' | 'pad' | 'melody'
  kind: TrackKind
  // The lowest and highest MIDI note a note cell can move to.
  range?: [number, number]
  cells: Cell[]
  muted: boolean
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const noteName = (note: number) => `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`

// "x . . x" → drum cells.
function hits(text: string): Cell[] {
  return text.split(/\s+/).map(c => ({ on: c === 'x', value: 0 }))
}

// "A2 . C3" → note cells; a "." is off and keeps the note before it, so
// turning it on starts from a sensible pitch.
function notes(text: string): Cell[] {
  const cells: Cell[] = []
  let last = 0
  for (const token of text.split(/\s+/)) {
    if (token !== '.') {
      const [, letter, octave] = token.match(/^([A-G]#?)(\d)$/)!
      last = 12 * (Number(octave) + 1) + NOTE_NAMES.indexOf(letter)
    }
    cells.push({ on: token !== '.', value: last })
  }
  return cells.map(c => (c.value ? c : { ...c, value: last }))
}

function chords(text: string): Cell[] {
  const cells: Cell[] = []
  let last = 0
  for (const token of text.split(/\s+/)) {
    if (token !== '.') last = CHORDS.findIndex(c => c.name === token)
    cells.push({ on: token !== '.', value: last })
  }
  return cells
}

// PLACEHOLDER(refine): the loop. Am F C G, one chord per half bar.
export const tracks = reactive<Track[]>([
  { id: 'kick', name: 'kick', group: 'drums', kind: 'drum', muted: false,
    cells: hits('x . . . x . . x x . . . x . . .') },
  { id: 'snare', name: 'snare', group: 'drums', kind: 'drum', muted: false,
    cells: hits('. . x . . . x . . . x . . . x x') },
  { id: 'hat', name: 'hat', group: 'drums', kind: 'drum', muted: false,
    cells: hits('. x . x . x . x . x . x . x . x') },
  { id: 'bass', name: 'bass', group: 'bass', kind: 'note', range: [28, 57], muted: false,
    cells: notes('A2 A3 A2 A3 F2 F3 F2 F3 C3 C4 C3 C4 G2 G3 G2 G3') },
  { id: 'pad', name: 'pad', group: 'pad', kind: 'chord', muted: false,
    cells: chords('Am . . . F . . . C . . . G . . .') },
  { id: 'melody', name: 'melody', group: 'melody', kind: 'note', range: [57, 88], muted: false,
    cells: notes('E5 . C5 A4 F5 . E5 C5 G5 . E5 C5 D5 . B4 D5') },
])

// Move a note cell up or down the scale, or a chord cell through CHORDS.
export function nudge(track: Track, cell: Cell, dir: 1 | -1) {
  if (track.kind === 'chord') {
    cell.value = (cell.value + dir + CHORDS.length) % CHORDS.length
  }
  else if (track.kind === 'note') {
    const [lo, hi] = track.range!
    let note = cell.value + dir
    while (!SCALE.includes(((note % 12) + 12) % 12)) note += dir
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
function pad(t: number, hold: number, chord: number, into: AudioNode) {
  const filter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 1800, Q: 0.5 })
  filter.connect(into)
  for (const note of CHORDS[chord].notes) {
    for (const cents of [-7, 7]) {
      const amp = noteEnvelope(t, hold, LEVEL.pad, 0.7, 0.06)
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

// --- Scheduler -----------------------------------------------------------

// How many steps until this track's next on cell, so a note holds until the
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
  let gains = new Map<Track['id'], GainNode>()
  let step = 0
  let next = 0
  // Steps scheduled but not yet heard, so the grid can follow the audio clock.
  const queue: { step: number; time: number }[] = []

  const stepLength = () => 60 / bpm.value / 2

  function schedule(i: number, t: number) {
    for (const track of tracks) {
      const cell = track.cells[i]
      if (!cell.on) continue
      const out = gains.get(track.id)!
      const hold = stepsToNext(track.cells, i) * stepLength() * GATE
      if (track.id === 'kick') kick(t, out)
      else if (track.id === 'snare') snare(t, out)
      else if (track.id === 'hat') hat(t, out)
      else if (track.id === 'bass') bass(t, hold, cell.value, out)
      else if (track.id === 'pad') pad(t, hold, cell.value, out)
      else melody(t, hold, cell.value, out)
    }
  }

  function tick() {
    while (next < ctx.currentTime + LOOKAHEAD) {
      schedule(step, next)
      queue.push({ step, time: next })
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
    gains = new Map(tracks.map(t => [t.id, new GainNode(ctx, { gain: t.muted ? 0 : 1 })]))
    for (const g of gains.values()) g.connect(bus)
    step = 0
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
    const old = bus!
    const t = ctx.currentTime
    old.gain.cancelScheduledValues(t)
    old.gain.setValueAtTime(old.gain.value, t)
    old.gain.linearRampToValueAtTime(0, t + CUT)
    setTimeout(() => old.disconnect(), CUT * 1000 + 50)
    bus = null
  }

  // Mutes fade in a few ms, so held notes go quiet too.
  function setMuted(id: Track['id'], muted: boolean) {
    gains.get(id)?.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.01)
  }

  // The step that's sounding now, or null when stopped.
  function current() {
    while (queue.length > 1 && queue[1].time <= ctx.currentTime) queue.shift()
    return queue.length && queue[0].time <= ctx.currentTime ? queue[0].step : null
  }

  return { start, stop, setMuted, current, playing: () => !!timer }
}
