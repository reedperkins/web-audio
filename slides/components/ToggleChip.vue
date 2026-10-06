<script setup lang="ts">
import { vNoFocus } from '../audio/useDemo'

// A pill button: <ToggleChip :on="loop" @click="loop = !loop">loop</ToggleChip>
// `on` fills it with the accent. The `action` look starts in the accent and
// fills on hover too, for buttons that do something (play, record); the
// default look is quiet until it's on, for settings. Size and font come from
// the parent: set `font-size` or `font-family` on it with a class.
withDefaults(defineProps<{ on?: boolean; action?: boolean; disabled?: boolean }>(), {
  on: false,
  action: false,
  disabled: false,
})
</script>

<template>
  <button v-no-focus class="toggle-chip" :class="{ on, action }" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
/* PLACEHOLDER(refine): chip look
   Wrapped in :global() so a class from the parent overrides any of it. */
:global(.toggle-chip) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45em;
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

:global(.toggle-chip.action) {
  border-color: var(--accent);
  color: var(--accent);
}

:global(.toggle-chip:not(.action):hover:not(:disabled)) {
  border-color: var(--accent);
  color: var(--accent);
}

:global(.toggle-chip.on),
:global(.toggle-chip.action:hover:not(:disabled)) {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--bg);
}

:global(.toggle-chip:disabled) {
  border-color: var(--wire);
  background: none;
  color: var(--wire);
  cursor: default;
}
</style>
