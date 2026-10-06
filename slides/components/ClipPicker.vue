<script setup lang="ts">
import type { Sample } from '../audio/samples'
import { picked, samples } from '../audio/samples'

// Picks section 6's clip (`picked` in audio/samples.ts), one button per clip.
// `variant`: 'stack' (a label over a column of buttons), 'compact' (no label,
// buttons fit to the width, for inside a signal-chain node) or 'inline' (the
// label and small buttons in one row).
withDefaults(defineProps<{ variant?: 'stack' | 'compact' | 'inline' }>(), { variant: 'stack' })
const pick = (s: Sample) => (picked.value = s)
</script>

<template>
  <div class="clip-picker" :class="variant">
    <span v-if="variant !== 'compact'" class="clip-picker-label">buffer</span>
    <ToggleChip v-for="s in samples" :key="s.id" class="clip-picker-chip" :on="s === picked" @click="pick(s)">
      {{ s.name }}
    </ToggleChip>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): clip picker look */
.clip-picker {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.45rem;
}

.clip-picker.compact {
  align-items: stretch;
  gap: 0.3rem;
}

.clip-picker.compact .clip-picker-chip {
  padding: 0.2em 0.5em;
  font-size: 0.6rem;
}

.clip-picker.inline {
  flex-direction: row;
  align-items: center;
  gap: 0.35rem;
}

.clip-picker.inline .clip-picker-label {
  font-size: 0.75rem;
}

.clip-picker.inline .clip-picker-chip {
  padding: 0.2em 0.65em;
  font-size: 0.65rem;
}

.clip-picker-label {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--size-small);
}
</style>
