<script setup lang="ts">
import { vNoFocus } from '../audio/useDemo'

// Emits `play`. The parent says whether it's playing; the slot is the label.
// With `pauses`, playing shows a pause icon instead of stop.
defineProps<{ playing?: boolean; pauses?: boolean }>()
defineEmits<{ play: [] }>()
</script>

<template>
  <button v-no-focus class="play-button" :class="{ playing }" @click="$emit('play')">
    <span class="play-button-icon">{{ playing ? (pauses ? '❚❚' : '■') : '▶' }}</span>
    <slot>Play</slot>
  </button>
</template>

<style scoped>
/* PLACEHOLDER(refine): play button look */
.play-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.35em 0.9em;
  border: 2px solid var(--accent);
  border-radius: 999px;
  background: none;
  color: var(--accent);
  font-family: var(--font-body);
  font-size: var(--size-small);
  font-weight: 600;
  cursor: pointer;
}

.play-button:hover:not(:disabled),
.play-button.playing {
  background: var(--accent);
  color: var(--bg);
}

.play-button:disabled {
  border-color: var(--wire);
  color: var(--wire);
  cursor: default;
}

.play-button-icon {
  font-size: 0.8em;
}
</style>
