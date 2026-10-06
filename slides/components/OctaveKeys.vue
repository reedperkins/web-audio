<script setup lang="ts">
import { held, pressKey, releaseKey } from '../audio/input'
import { mtof } from '../audio/mtof'

// One octave of piano keys, A3 (57) to concert A (69): 220 Hz to 440 Hz, so
// the doubling reads exactly. Middle C (60) is the third key. Same keys as the
// backup keyboard, so held notes light up and the keys play.
// PLACEHOLDER(refine): octave visual
const marked = [57, 69]
</script>

<template>
  <div class="octave-keys">
    <Keyboard
      class="keys"
      :from="57"
      :count="13"
      :marked="marked"
      :is-down="(n) => held.has(n)"
      @press="pressKey"
      @release="releaseKey"
    >
      <template #below="{ note }">
        <span v-if="marked.includes(note)" class="hz">{{ mtof(note) }} Hz</span>
      </template>
    </Keyboard>
    <p class="caption">12 keys up = twice the frequency</p>
  </div>
</template>

<style scoped>
.keys {
  height: 11rem;
  --key-label-size: 0.75rem;
}

.hz {
  margin-top: 0.5rem;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: var(--size-small);
  font-weight: 700;
  white-space: nowrap;
}

.caption {
  margin: 1rem 0 0;
  color: var(--muted);
  font-size: 0.9rem;
  text-align: center;
}
</style>
