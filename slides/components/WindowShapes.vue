<script setup lang="ts">
import type { WindowName } from '../audio/grains'
import { windows } from '../audio/grains'
import { vNoFocus } from '../audio/useDemo'

// The grain fades as buttons, drawn from the curves the engine plays:
// <WindowShapes v-model="settings.window" />
// Like WaveShapes for oscillator types; the current one lights up. `names`
// shows only some of them (default: all four).
const props = defineProps<{ names?: WindowName[] }>()
const model = defineModel<WindowName>({ required: true })

// PLACEHOLDER(refine): window shape visual
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
</script>

<template>
  <div class="window-shapes">
    <button
      v-for="name in props.names ?? all"
      :key="name"
      v-no-focus
      class="shape"
      :class="{ on: model === name }"
      @click="model = name"
    >
      <svg :viewBox="`-6 -6 ${w + 12} ${h + 12}`" role="img" :aria-label="`${name} window`">
        <line x1="0" :y1="h" :x2="w" :y2="h" class="axis" />
        <path :d="path(name)" class="trace" />
      </svg>
      <span class="name">{{ name }}</span>
    </button>
  </div>
</template>

<style scoped>
.window-shapes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.4rem;
}

.shape {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.35rem 0.4rem 0.25rem;
  border: 2px solid var(--wire);
  border-radius: 0.5rem;
  background: none;
  color: var(--muted);
  cursor: pointer;
}

.shape:hover,
.shape.on {
  border-color: var(--accent);
  color: var(--ink);
}

.shape.on {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

svg {
  width: 100%;
}

.axis {
  stroke: var(--wire);
  stroke-width: 2;
  stroke-dasharray: 6 6;
}

.trace {
  fill: none;
  stroke: var(--wire);
  stroke-width: 8;
  stroke-linejoin: round;
}

.shape:hover .trace,
.shape.on .trace {
  stroke: var(--accent);
}

.name {
  font-family: var(--font-mono);
  font-size: 0.6rem;
}
</style>
