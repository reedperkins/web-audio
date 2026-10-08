import { ctx } from './audio'
import { env, noteOff, noteOn } from './envelope'
import { voiceFilter } from './filter'
import { mtof } from './mtof'
import { wave } from './synth'

// Plays a list of notes on the audio clock, looping until stopped. A timer
// wakes every TICK ms and schedules the notes that start in the next
// LOOKAHEAD seconds. The timing comes from ctx.currentTime, not the timer,
// and each note reads the synth's wave and envelope when it's scheduled, so a
// change is heard within LOOKAHEAD.
const TICK = 25
const LOOKAHEAD = 0.1
// How much of each note's length the key is held before its release.
// PLACEHOLDER(refine): gate, tune by ear
const GATE = 0.85
// Stopping skips the release, but still ramps so it doesn't click.
const CUT = 0.03

// A note number, or null for a rest. Lengths are in beats.
export interface Step {
  note: number | null
  beats: number
}

interface Voice {
  osc: OscillatorNode
  amp: GainNode
}

export function playSequence(steps: Step[], bpm: number, into: AudioNode) {
  const beat = 60 / bpm
  const live = new Set<Voice>()
  let i = 0
  let next = ctx.currentTime + 0.05

  function play(note: number, t: number, hold: number) {
    const frequency = mtof(note)
    const osc = new OscillatorNode(ctx, { type: wave.value, frequency })
    const amp = new GainNode(ctx, { gain: 0 })
    const filter = voiceFilter(frequency, t, osc)
    osc.connect(filter.node).connect(amp).connect(into)
    noteOn(amp.gain, t)
    noteOff(amp.gain, t + hold)
    filter.release(t + hold)
    osc.start(t)
    osc.stop(t + hold + env.release)
    const voice = { osc, amp }
    live.add(voice)
    osc.onended = () => {
      amp.disconnect()
      live.delete(voice)
    }
  }

  function tick() {
    while (next < ctx.currentTime + LOOKAHEAD) {
      const { note, beats } = steps[i]
      const length = beats * beat
      if (note !== null) play(note, next, length * GATE)
      next += length
      i = (i + 1) % steps.length
    }
  }

  tick()
  const timer = setInterval(tick, TICK)

  return function stop() {
    clearInterval(timer)
    const t = ctx.currentTime
    for (const { osc, amp } of live) {
      amp.gain.cancelAndHoldAtTime(t)
      amp.gain.linearRampToValueAtTime(0, t + CUT)
      osc.stop(t + CUT)
    }
  }
}
