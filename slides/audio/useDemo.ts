import { onSlideEnter, onSlideLeave, useSlideContext } from '@slidev/client'
import type { Directive } from 'vue'
import { onUnmounted, shallowRef } from 'vue'
import { ctx, master } from './audio'

interface DemoHooks {
  // Runs when the slide becomes the current one.
  enter?: () => void
  // Runs when the slide stops being the current one. Stop sound here.
  leave?: () => void
  // Skip the fade on leave, so sound keeps going on the next slides.
  keepPlaying?: boolean
}

const FADE = 0.02

// The lifecycle every demo uses. `enter` and `leave` follow slide navigation,
// not mount/unmount: Slidev mounts slides early and keeps them mounted.
//
// `out` is this demo's own GainNode into `master`. Connect to `out.value`.
// On leave it fades out and is swapped for a fresh, unconnected node, so
// anything still scheduled goes silent even if the demo's `leave` misses it.
export function useDemo(hooks: DemoHooks = {}) {
  const { $renderContext } = useSlideContext()
  const out = shallowRef(new GainNode(ctx))
  let active = false

  function enter() {
    if (active) return
    active = true
    out.value.connect(master)
    hooks.enter?.()
  }

  function leave() {
    if (!active) return
    active = false
    hooks.leave?.()
    if (hooks.keepPlaying) return
    const old = out.value
    const now = ctx.currentTime
    old.gain.cancelScheduledValues(now)
    old.gain.setValueAtTime(old.gain.value, now)
    old.gain.linearRampToValueAtTime(0, now + FADE)
    setTimeout(() => old.disconnect(), FADE * 1000 + 30)
    out.value = new GainNode(ctx)
  }

  // Overview thumbnails render the same slide; only the real one plays.
  if ($renderContext.value === 'slide') {
    onSlideEnter(enter)
    onSlideLeave(leave)
    onUnmounted(leave)
  }

  return { ctx, out }
}

// Slidev turns off its shortcuts while a button or input has focus, and Space
// re-presses a focused button. Drop focus as soon as the pointer lets go.
export const vNoFocus: Directive<HTMLElement> = {
  mounted(el) {
    const blur = () => el.blur()
    el.addEventListener('pointerup', blur)
    el.addEventListener('change', blur)
    el.addEventListener('pointercancel', blur)
  },
}
