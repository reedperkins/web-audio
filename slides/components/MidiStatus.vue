<script setup lang="ts">
import { computed } from 'vue'
import { inputs, midi } from '../audio/input'

// A dot and a line saying whether a MIDI keyboard is connected. Updates when
// one is plugged in or pulled out, or the on-screen keyboard is opened.
const connected = computed(() => inputs.value.length > 0)
const label = computed(() => {
  if (connected.value) return `${inputs.value.join(' + ')} connected`
  return {
    ready: 'No MIDI device connected',
    waiting: 'Asking for MIDI access…',
    denied: 'MIDI access blocked',
    unsupported: 'No Web MIDI in this browser',
  }[midi.status]
})
</script>

<template>
  <!-- PLACEHOLDER(refine): MIDI status look -->
  <div class="midi-status" :class="{ connected }">
    <span class="dot" />
    {{ label }}
  </div>
</template>

<style scoped>
.midi-status {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  color: var(--muted);
  font-size: var(--size-small);
}

.midi-status.connected {
  color: var(--ink);
}

.dot {
  width: 0.7em;
  height: 0.7em;
  border-radius: 50%;
  border: 2px solid var(--wire);
}

.connected .dot {
  border-color: var(--signal);
  background: var(--signal);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--signal) 25%, transparent);
}
</style>
