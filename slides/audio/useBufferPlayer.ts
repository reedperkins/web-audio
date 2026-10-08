import type { ShallowRef } from 'vue'
import { ref } from 'vue'
import { ctx } from './audio'

// Plays a whole buffer at normal speed into `out`, with a playhead for
// BufferView. A source plays only once, so each play makes a new one.
// `pause` stops where it is and the next `play` carries on from there;
// `stop` (and reaching the end) goes back to the start.
// The caller stops it on slide leave.
export function useBufferPlayer(out: ShallowRef<GainNode>) {
  let source: AudioBufferSourceNode | null = null
  let startedAt = 0
  // Seconds into the buffer to start from on the next play.
  let offset = 0
  let frame = 0
  const playing = ref(false)
  // Seconds into the buffer, or null when stopped.
  const position = ref<number | null>(null)

  function follow() {
    position.value = ctx.currentTime - startedAt
    frame = requestAnimationFrame(follow)
  }

  function halt() {
    cancelAnimationFrame(frame)
    if (source) {
      source.onended = null
      source.stop()
      source = null
    }
    playing.value = false
  }

  function stop() {
    halt()
    offset = 0
    position.value = null
  }

  function pause() {
    if (!playing.value) return
    offset = ctx.currentTime - startedAt
    halt()
    position.value = offset
  }

  function play(buffer: AudioBuffer) {
    halt()
    if (offset >= buffer.duration) offset = 0
    source = new AudioBufferSourceNode(ctx, { buffer })
    source.connect(out.value)
    source.start(0, offset)
    startedAt = ctx.currentTime - offset
    source.onended = stop
    playing.value = true
    follow()
  }

  return { playing, position, play, pause, stop }
}
