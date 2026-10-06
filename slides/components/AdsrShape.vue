<script setup lang="ts">
// A labeled ADSR outline: volume over the life of one note.
// PLACEHOLDER(refine): ADSR diagram look
const points = 'M20 200 L80 30 L150 110 L330 110 L420 200'
const labels = [
  { x: 50, text: 'A' },
  { x: 115, text: 'D' },
  { x: 240, text: 'S' },
  { x: 375, text: 'R' },
]
</script>

<template>
  <svg class="adsr-shape" viewBox="0 0 440 250" role="img" aria-label="Attack, decay, sustain, release">
    <line x1="20" y1="200" x2="430" y2="200" class="axis" />
    <line x1="20" y1="200" x2="20" y2="10" class="axis" />
    <line x1="330" y1="20" x2="330" y2="200" class="marker" />
    <text x="335" y="24" class="note">key up</text>
    <text x="24" y="24" class="note">key down</text>
    <path :d="points" class="trace" />
    <text v-for="label in labels" :key="label.text" :x="label.x" y="235" class="label">{{ label.text }}</text>
  </svg>
</template>

<style scoped>
.adsr-shape {
  width: 100%;
}

.axis {
  stroke: var(--muted);
  stroke-width: 2;
}

.marker {
  stroke: var(--wire);
  stroke-width: 2;
  stroke-dasharray: 6 6;
}

.trace {
  fill: none;
  stroke: var(--accent);
  stroke-width: 5;
  stroke-linejoin: round;
}

.label {
  fill: var(--ink);
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 700;
  text-anchor: middle;
}

.note {
  fill: var(--muted);
  font-family: var(--font-body);
  font-size: 15px;
}
</style>
