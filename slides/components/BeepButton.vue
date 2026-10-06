<script setup lang="ts">
import { ctx, master, unlock } from '../audio/audio'

// Plays the "One beep" slide's code, routed through `master`.
async function beep() {
  await unlock()
  const osc = new OscillatorNode(ctx, { frequency: 440 })
  osc.connect(master)
  osc.start()
  osc.stop(ctx.currentTime + 1)
}
</script>

<template>
  <!-- PLACEHOLDER(refine): demo button look -->
  <button class="beep-button" @mousedown.prevent @click="beep">
    <span class="beep-button-icon">▶</span>
    Play
  </button>
</template>

<style scoped>
.beep-button {
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

.beep-button:hover {
  background: var(--accent);
  color: var(--bg);
}

.beep-button-icon {
  font-size: 0.8em;
}
</style>
