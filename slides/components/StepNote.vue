<script setup lang="ts">
import { computed } from 'vue'
import { useSlideContext } from '@slidev/client'

// A note beside stepped code. It appears at step `at` and stays (dimmed) for
// later steps. It reads the current step, so going backward works too.
const props = defineProps<{ at: number }>()

const { $clicks } = useSlideContext()
const state = computed(() => {
  if ($clicks.value < props.at) return 'hidden'
  return $clicks.value === props.at ? 'current' : 'past'
})
</script>

<template>
  <div class="step-note" :class="state">
    <slot />
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): step note styling */
.step-note {
  margin-bottom: 0.9em;
  padding-left: 0.75em;
  border-left: 4px solid var(--wire);
  color: var(--muted);
  font-size: var(--size-small);
  line-height: 1.4;
  transition: opacity 0.2s, color 0.2s, border-color 0.2s;
}

.step-note.hidden {
  opacity: 0;
}

.step-note.current {
  border-left-color: var(--accent);
  color: var(--ink);
}
</style>
