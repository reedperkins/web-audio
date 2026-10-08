<script setup lang="ts">
import { computed, ref } from 'vue'

// An upright fader for tight spots: <Fader v-model="volume" :max="1.5" :mark="1" />
// Drag anywhere on it; more is up. The fill shows the level and a tick marks
// `mark` (e.g. 100%). `format` is the hover text. Size it from the parent
// (height and width on its root); `--fader-color` colors the fill and cap
// (default `--accent`).
const value = defineModel<number>({ required: true })
const props = withDefaults(
  defineProps<{ min?: number; max?: number; mark?: number; format?: (value: number) => string }>(),
  { min: 0, max: 1 },
)

const el = ref<HTMLElement>()
const rail = ref<HTMLElement>()
const fraction = (v: number) => (v - props.min) / (props.max - props.min)
const level = computed(() => Math.min(1, Math.max(0, fraction(value.value))))

function set(e: PointerEvent) {
  const box = rail.value!.getBoundingClientRect()
  const f = Math.min(1, Math.max(0, (box.bottom - e.clientY) / box.height))
  value.value = props.min + f * (props.max - props.min)
}

function grab(e: PointerEvent) {
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  set(e)
}

function drag(e: PointerEvent) {
  if ((e.currentTarget as Element).hasPointerCapture(e.pointerId)) set(e)
}
</script>

<template>
  <div
    ref="el"
    class="fader"
    role="slider"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="value"
    :title="format ? format(value) : undefined"
    @pointerdown.prevent="grab"
    @pointermove="drag"
  >
    <!-- Inset, so the cap stays inside the fader at either end. -->
    <div ref="rail" class="fader-rail">
      <div class="fader-track">
        <div class="fader-fill" :style="{ height: `${level * 100}%` }" />
      </div>
      <div v-if="mark !== undefined" class="fader-mark" :style="{ bottom: `${fraction(mark) * 100}%` }" />
      <div class="fader-cap" :style="{ bottom: `${level * 100}%` }" />
    </div>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): fader look */
.fader {
  position: relative;
  width: 1rem;
  height: 100%;
  cursor: ns-resize;
  touch-action: none;
}

.fader-rail {
  position: absolute;
  inset: 0.2rem 0;
}

.fader-track {
  position: absolute;
  inset: 0 auto 0 50%;
  width: 4px;
  translate: -50%;
  border-radius: 2px;
  background: var(--wire);
  overflow: hidden;
}

.fader-fill {
  position: absolute;
  bottom: 0;
  width: 100%;
  background: var(--fader-color, var(--accent));
}

.fader-mark {
  position: absolute;
  left: 0.1rem;
  right: 0.1rem;
  height: 1px;
  background: var(--muted);
}

.fader-cap {
  position: absolute;
  left: 0;
  right: 0;
  height: 0.4rem;
  translate: 0 50%;
  border-radius: 2px;
  background: var(--fader-color, var(--accent));
  box-shadow: 0 0 0 1.5px var(--surface);
}
</style>
