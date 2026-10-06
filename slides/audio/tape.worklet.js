// The tape for the chaos slide's looper (see tape.ts). Runs on the audio
// thread: copies its input from one frame to another into a Float32Array and
// posts it back. Frames, not seconds, so a take is exactly as long as asked.
//
// Messages in: { type: 'start', id, frame, max } starts a take at `frame`
// (at most `max` frames long), { type: 'stop', id, frame } ends it at `frame`
// (a frame already past trims what came after), { type: 'cancel', id } drops
// it. Takes can overlap, so the next can start where the last one stops.
// Message out: { id, samples } once a take's stop frame has gone by.

class TapeProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.takes = new Map()
    this.port.onmessage = ({ data }) => {
      const take = this.takes.get(data.id)
      if (data.type === 'start')
        this.takes.set(data.id, {
          start: data.frame,
          stop: data.frame + data.max,
          samples: new Float32Array(data.max),
        })
      else if (data.type === 'stop' && take) take.stop = Math.max(take.start, data.frame)
      else if (data.type === 'cancel') this.takes.delete(data.id)
    }
  }

  process(inputs) {
    // No channel when nothing upstream is playing: silence, but time still passes.
    const channel = inputs[0][0]
    const length = channel?.length ?? 128
    for (const [id, take] of this.takes) {
      const from = Math.max(take.start, currentFrame)
      const to = Math.min(take.stop, currentFrame + length)
      if (channel) for (let f = from; f < to; f++) take.samples[f - take.start] = channel[f - currentFrame]
      if (currentFrame + length >= take.stop) {
        const samples = take.samples.slice(0, take.stop - take.start)
        this.port.postMessage({ id, samples }, [samples.buffer])
        this.takes.delete(id)
      }
    }
    return true
  }
}

registerProcessor('tape', TapeProcessor)
