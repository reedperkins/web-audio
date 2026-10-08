<script setup lang="ts">
import { vNoFocus } from '../audio/useDemo'

// A labeled range input: <Slider v-model="level" label="gain" />
// Size it from the parent with `--slider-width` (the track) and
// `--slider-value-width` (room for the readout, so it doesn't jump).
// `--slider-color` colors the track (default `--accent`).
// `format` replaces the readout's text, e.g. to show Hz for a log position.
const value = defineModel<number>({ required: true })
withDefaults(
  defineProps<{
    label?: string
    min?: number
    max?: number
    step?: number
    digits?: number
    format?: (value: number) => string
  }>(),
  {
    min: 0,
    max: 1,
    step: 0.01,
    // Decimal places shown in the readout.
    digits: 2,
  },
)
</script>

<template>
  <label class="slider">
    <span v-if="label" class="slider-label">{{ label }}</span>
    <input
      v-model.number="value"
      v-no-focus
      type="range"
      :min="min"
      :max="max"
      :step="step"
    >
    <output class="slider-value">{{ format ? format(value) : value.toFixed(digits) }}</output>
  </label>
</template>

<style scoped>
/* PLACEHOLDER(refine): slider look */
.slider {
  /* Slidev's default theme styles bare labels; undo it. */
  border: 0;
  background: none;
  display: inline-flex;
  align-items: center;
  gap: 0.6em;
  font-family: var(--font-mono);
  font-size: var(--size-small);
  color: var(--ink);
}

.slider-label {
  color: var(--muted);
}

input {
  width: var(--slider-width, 9em);
  accent-color: var(--slider-color, var(--accent));
  cursor: pointer;
}

.slider-value {
  min-width: var(--slider-value-width, 3ch);
  white-space: nowrap;
}
</style>
