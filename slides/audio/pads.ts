import { ctx } from './audio'
import { fadeOut as glideOut } from './envelope'
import type { GrainSettings } from './grains'
import { playGrains } from './grains'

// The sample pads: a region copied out of a clip into its own buffer, then
// played as a hit. A hit is either one plain buffer source, where pitch and
// length move together (`detune`), or the grain engine, where every pitch
// lasts as long as the original.

// The slide's code: markers are in seconds, a buffer counts sample frames.
// `subarray` is only a view of the clip; `copyToChannel` copies it, so the
// pad keeps its sound whatever happens to the clip after.
export function copyRegion(buffer: AudioBuffer, start: number, end: number) {
  const { sampleRate } = buffer
  const from = Math.round(start * sampleRate)
  const to = Math.round(end * sampleRate)
  const pad = new AudioBuffer({ length: to - from, sampleRate })
  pad.copyToChannel(buffer.getChannelData(0).subarray(from, to), 0)
  return pad
}

export type PitchMode = 'rate' | 'grains'

// The settings the slide spreads into `playGrains`, with `semitones` per key.
export const settings: Omit<GrainSettings, 'semitones'> = { speed: 1, window: 'hann', once: true }

// PLACEHOLDER(refine): level per hit, tune by ear. Under full scale, so a few
// hits at once don't clip.
const LEVEL = 0.6
// A plain hit fades in and out this fast, so a region cut mid-wave doesn't
// click at either end.
const EDGE = 0.004
// Letting go of a held key (chromatic mode).
export const RELEASE = 0.06
// Choking a hit: the same pad or key again.
export const CUT = 0.015

export interface Hit {
  // Seconds into the pad, or null once it's over.
  position: () => number | null
  // Fade out over `fade` seconds and stop.
  stop: (fade: number) => void
}

export function hit(pad: AudioBuffer, into: AudioNode, semitones: number, velocity: number, mode: PitchMode): Hit {
  const amp = new GainNode(ctx, { gain: (LEVEL * velocity) / 127 })
  amp.connect(into)
  let stopped = false

  function fadeOut(fade: number) {
    const t = ctx.currentTime
    glideOut(amp.gain, t, fade)
    stopped = true
    return t + fade
  }

  if (mode === 'grains') {
    const player = playGrains(pad, amp, { ...settings, semitones })
    const end = () => (amp.disconnect(), (stopped = true))
    return {
      position() {
        if (stopped) return null
        if (player.finished()) return end(), null
        return Math.min(player.positionAt(), pad.duration)
      },
      stop(fade) {
        if (stopped) return
        const at = fadeOut(fade)
        setTimeout(() => (player.stop(), amp.disconnect()), (at - ctx.currentTime) * 1000 + 30)
      },
    }
  }

  const rate = 2 ** (semitones / 12)
  const length = pad.duration / rate
  const edge = Math.min(EDGE, length / 2)
  const start = ctx.currentTime
  const source = new AudioBufferSourceNode(ctx, { buffer: pad, detune: semitones * 100 })
  const env = new GainNode(ctx, { gain: 0 })
  env.gain.setValueAtTime(0, start)
  env.gain.linearRampToValueAtTime(1, start + edge)
  env.gain.setValueAtTime(1, start + length - edge)
  env.gain.linearRampToValueAtTime(0, start + length)
  source.connect(env).connect(amp)
  source.start(start)
  source.onended = () => {
    stopped = true
    amp.disconnect()
  }
  return {
    position() {
      if (stopped) return null
      const p = (ctx.currentTime - start) * rate
      return p < pad.duration ? p : null
    },
    stop(fade) {
      if (stopped) return
      source.stop(fadeOut(fade))
    },
  }
}
