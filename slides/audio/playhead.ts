// Where an AudioBufferSourceNode is in its buffer. The node doesn't say, so
// this follows the spec's playback algorithm ("Playback of AudioBuffer
// Contents") in buffer seconds: same rate math, same loop rules.

export interface PlaybackParams {
  playbackRate: number
  detune: number
  loop: boolean
  loopStart: number
  loopEnd: number
}

export class Playhead {
  // Seconds into the buffer.
  time: number
  private offset: number
  private enteredLoop = false
  private started = false

  constructor(
    private duration: number,
    offset: number,
  ) {
    this.offset = offset
    this.time = offset
  }

  // Advance by `dt` seconds of context time, with the params that held during
  // it. Returns false once playback has run off the end of the buffer.
  advance(dt: number, p: PlaybackParams) {
    const rate = p.playbackRate * 2 ** (p.detune / 1200)
    let loopStart = 0
    let loopEnd = this.duration
    if (p.loop && p.loopStart >= 0 && p.loopEnd > 0 && p.loopStart < p.loopEnd) {
      loopStart = p.loopStart
      loopEnd = Math.min(p.loopEnd, this.duration)
    }
    if (!p.loop) this.enteredLoop = false

    if (!this.started) {
      // A start offset past the loop end begins at the loop end (and wraps).
      if (p.loop && this.offset >= loopEnd) this.offset = loopEnd
      this.time = this.offset
      this.started = true
    }

    if (p.loop) {
      if (!this.enteredLoop) {
        if (this.offset < loopEnd && this.time >= loopStart) this.enteredLoop = true
        if (this.offset >= loopEnd && this.time < loopEnd) this.enteredLoop = true
      }
      if (this.enteredLoop) this.time = wrap(this.time, loopStart, loopEnd)
    }
    if (this.time >= this.duration) return false

    this.time += dt * rate
    if (p.loop && this.enteredLoop) this.time = wrap(this.time, loopStart, loopEnd)
    return this.time < this.duration
  }
}

function wrap(t: number, start: number, end: number) {
  const length = end - start
  return start + ((((t - start) % length) + length) % length)
}
