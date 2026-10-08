import { ref } from 'vue'
import { ctx } from './audio'
import { env, fadeOut, noteOff, noteOn } from './envelope'
import { voiceFilter } from './filter'
import { onNote } from './input'
import { mtof } from './mtof'

// The shared synth. `Voice`, `keyDown` and `keyUp` are the code on the "One
// voice per key" and "Polyphony" slides, plus the filter from the "Carve it"
// slide (wide open until then), and voices connect to `bus` instead of
// `ctx.destination`.
//
// MIDI and the on-screen keyboard always play it, but it's silent until a
// slide points it at its `out` with `playInto`.

// PLACEHOLDER(refine): level per voice, tune by ear. Low enough that a
// six-note chord stays under full scale.
const VOICE_LEVEL = 0.14

const bus = new GainNode(ctx, { gain: VOICE_LEVEL })
let output: AudioNode | null = null

// Send the synth to a slide's `out`, or `null` to cut it off.
export function playInto(out: AudioNode | null) {
  if (output) bus.disconnect(output)
  output = out
  if (out) bus.connect(out)
}

// The synth's oscillator type. The wave picker and the songs set it; every
// new note reads it.
export const wave = ref<OscillatorType>('sine')

class Voice {
  osc: OscillatorNode
  amp: GainNode
  filter: ReturnType<typeof voiceFilter>
  constructor(frequency: number) {
    this.osc = new OscillatorNode(ctx, { type: wave.value, frequency })
    this.amp = new GainNode(ctx, { gain: 0 })
    this.filter = voiceFilter(frequency, ctx.currentTime, this.osc)
    this.osc.connect(this.filter.node).connect(this.amp).connect(bus)
    noteOn(this.amp.gain, ctx.currentTime)
    this.osc.start()
  }
  release() {
    const t = ctx.currentTime
    noteOff(this.amp.gain, t)
    this.filter.release(t)
    this.osc.stop(t + env.release)
  }
}

const voices = new Map<number, Voice>()
export function keyDown(note: number) {
  voices.set(note, new Voice(mtof(note)))
}
export function keyUp(note: number) {
  voices.get(note)?.release()
  voices.delete(note)
}

// Stop a voice fast, skipping the envelope's release. Still a short ramp, so
// it doesn't click.
const CUT = 0.03
export function cut(note: number) {
  const voice = voices.get(note)
  if (!voice) return
  const t = ctx.currentTime
  fadeOut(voice.amp.gain, t, CUT)
  voice.osc.stop(t + CUT)
  voices.delete(note)
}

export function releaseAll() {
  for (const note of [...voices.keys()]) keyUp(note)
}

onNote({
  noteOn(note) {
    if (!output) return
    // The same note from two places (a chord button and a key): restart it
    // rather than lose track of the first voice.
    keyUp(note)
    keyDown(note)
  },
  noteOff: keyUp,
})

// A hot update would subscribe a second synth. Reload the page instead.
if (import.meta.hot) import.meta.hot.decline()
