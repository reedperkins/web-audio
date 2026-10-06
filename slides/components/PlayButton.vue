<script setup lang="ts">
// Emits `play`. The parent says whether it's playing; the slot is the label.
// With `pauses`, playing shows a pause icon instead of stop.
defineProps<{ playing?: boolean; pauses?: boolean; disabled?: boolean }>()
defineEmits<{ play: [] }>()
</script>

<template>
  <ToggleChip action class="play-button" :on="playing" :disabled="disabled" @click="$emit('play')">
    <span class="play-button-icon">{{ playing ? (pauses ? '❚❚' : '■') : '▶' }}</span>
    <slot>Play</slot>
  </ToggleChip>
</template>

<style scoped>
/* PLACEHOLDER(refine): play button look */
.play-button {
  gap: 0.5em;
  padding: 0.35em 0.9em;
  font-size: var(--size-small);
}

.play-button-icon {
  font-size: 0.8em;
}
</style>
