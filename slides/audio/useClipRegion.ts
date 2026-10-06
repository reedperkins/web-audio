import type { Ref } from 'vue'
import { computed, reactive } from 'vue'
import type { Sample } from './samples'

// A stretch of a clip, in seconds.
export interface LoopRegion {
  start: number
  end: number
}

// A region per clip, for `v-model:loop` on BufferView: each clip keeps its
// own, and a clip not marked yet starts on its second quarter.
export function useClipRegion(clip: Ref<Sample>) {
  const regions = reactive(new Map<string, LoopRegion>())
  return computed<LoopRegion>({
    get() {
      const duration = clip.value.buffer?.duration ?? 1
      return regions.get(clip.value.id) ?? { start: duration / 4, end: duration / 2 }
    },
    set: (value) => regions.set(clip.value.id, value),
  })
}
