<script setup lang="ts">
import { computed } from 'vue'
import type { WindowName } from '../audio/grains'
import { windows } from '../audio/grains'

// The grain fades as buttons, drawn from the curves the engine plays:
// <WindowShapes v-model="settings.window" />
// `names` shows only some of them (default: all four).
const props = defineProps<{ names?: WindowName[] }>()
const model = defineModel<WindowName>({ required: true })

// PLACEHOLDER(refine): window shape visual
// Drawn in ShapePicker's 200 × 80 box.
const w = 200
const h = 80
const all = Object.keys(windows) as WindowName[]

// Drawn at full height: the engine's scaling is about loudness, not shape.
function path(name: WindowName) {
  const curve = windows[name]
  const peak = Math.max(...curve)
  let d = `M0 ${h}`
  curve.forEach((v, i) => {
    d += ` L${((i / (curve.length - 1)) * w).toFixed(1)} ${(h - (v / peak) * h).toFixed(1)}`
  })
  return `${d} L${w} ${h}`
}

const options = computed(() => (props.names ?? all).map((name) => ({ value: name, label: name, d: path(name) })))
</script>

<template>
  <ShapePicker v-model="model" :options="options" axis="bottom" trace="accent" />
</template>
