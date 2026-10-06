import type { ShallowRef } from 'vue'
import { ref } from 'vue'
import { ctx } from './audio'

// Plays a whole buffer once at normal speed into `out`, with a playhead for
// BufferView. A source plays only once, so each play makes a new one.
// The caller stops it on slide leave.
export function useBufferPlayer(out: ShallowRef<GainNode>) {
  let source: AudioBufferSourceNode | null = null
  let startedAt = 0
  let frame = 0
  const playing = ref(false)
  // Seconds into the buffer, or null when stopped.
  const position = ref<number | null>(null)

  function follow() {
    position.value = ctx.currentTime - startedAt
    frame = requestAnimationFrame(follow)
  }

  function stop() {
    cancelAnimationFrame(frame)
    if (source) {
      source.onended = null
      source.stop()
      source = null
    }
    playing.value = false
    position.value = null
  }

  function play(buffer: AudioBuffer) {
    stop()
    source = new AudioBufferSourceNode(ctx, { buffer })
    source.connect(out.value)
    source.start()
    startedAt = ctx.currentTime
    source.onended = stop
    playing.value = true
    follow()
  }

  return { playing, position, play, stop }
}
