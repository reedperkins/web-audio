<script setup lang="ts">
import type { Sample } from '../audio/samples'
import { picked, samples } from '../audio/samples'
import { vNoFocus } from '../audio/useDemo'

// Picks section 6's clip (`picked` in audio/samples.ts), one button per clip.
// `compact` drops the label and fits the buttons to the width, for inside a
// signal-chain node; `inline` puts the label and small buttons in one row.
defineProps<{ compact?: boolean; inline?: boolean }>()
const pick = (s: Sample) => (picked.value = s)
</script>

<template>
  <div class="clip-picker" :class="{ compact, inline }">
    <span v-if="!compact" class="clip-picker-label">buffer</span>
    <button
      v-for="s in samples"
      :key="s.id"
      v-no-focus
      class="clip-picker-chip"
      :class="{ on: s === picked }"
      @click="pick(s)"
    >
      {{ s.name }}
    </button>
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

.clip-picker-chip {
  padding: 0.3em 0.8em;
  border: 2px solid var(--wire);
  border-radius: 999px;
  background: none;
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.clip-picker-chip.on {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--bg);
}
</style>
