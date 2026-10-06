<script setup lang="ts">
import { vNoFocus } from '../audio/useDemo'

// A labeled range input: <Slider v-model="level" label="gain" />
const value = defineModel<number>({ required: true })
withDefaults(defineProps<{ label?: string; min?: number; max?: number; step?: number }>(), {
  min: 0,
  max: 1,
  step: 0.01,
})
</script>

<template>
  <!-- PLACEHOLDER(refine): slider look -->
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
    <output class="slider-value">{{ value.toFixed(2) }}</output>
  </label>
</template>

<style scoped>
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
  width: 9em;
  accent-color: var(--accent);
  cursor: pointer;
}

.slider-value {
  min-width: 3ch;
}
</style>
