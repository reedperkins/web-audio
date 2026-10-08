<script setup lang="ts" generic="T">
import { vNoFocus } from '../audio/useDemo'

// Shapes as buttons, two to a row (`--shape-columns`), the current one lit:
//   <ShapePicker v-model="wave" :options="[{ value, label, d }]" axis="middle" @pick="…" />
// Each `d` is drawn in a 200 × 80 box. `axis` puts the dashed zero line
// through the middle (a wave) or along the bottom (a fade). `pick` fires on
// every click, even on the current one. `trace` names the theme color the
// lit shape is drawn in.
withDefaults(
  defineProps<{
    options: { value: T; label: string; d: string }[]
    axis?: 'middle' | 'bottom'
    trace?: 'signal' | 'accent'
  }>(),
  { axis: 'middle', trace: 'signal' },
)
const model = defineModel<T>({ required: true })
const emit = defineEmits<{ pick: [value: T] }>()

const W = 200
const H = 80

function pick(value: T) {
  model.value = value
  emit('pick', value)
}
</script>

<template>
  <div class="shape-picker" :style="{ '--trace': `var(--${trace})` }">
    <button
      v-for="option in options"
      :key="option.label"
      v-no-focus
      class="shape"
      :class="{ on: model === option.value }"
      @click="pick(option.value)"
    >
      <svg :viewBox="`-6 -6 ${W + 12} ${H + 12}`" role="img" :aria-label="option.label">
        <line x1="0" :x2="W" :y1="axis === 'middle' ? H / 2 : H" :y2="axis === 'middle' ? H / 2 : H" class="axis" />
        <path :d="option.d" class="trace" />
      </svg>
      <span class="name">{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): shape picker look */
.shape-picker {
  display: grid;
  grid-template-columns: repeat(var(--shape-columns, 2), 1fr);
  gap: 0.4rem;
}

.shape {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: var(--shape-padding, 0.35rem 0.4rem 0.25rem);
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
  stroke: var(--trace);
}

.name {
  font-family: var(--font-mono);
  font-size: 0.6rem;
}
</style>
