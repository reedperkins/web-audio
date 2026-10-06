<script setup lang="ts">
// One octave and a bit of piano keys, from middle C (60) to the C above (72).
// PLACEHOLDER(refine): octave visual
const mtof = (note: number) => 440 * 2 ** ((note - 69) / 12)

const whiteNotes = [60, 62, 64, 65, 67, 69, 71, 72]
const blackNotes = [
  { note: 61, after: 0 },
  { note: 63, after: 1 },
  { note: 66, after: 3 },
  { note: 68, after: 4 },
  { note: 70, after: 5 },
]
const keyW = 70
const marked = new Set([60, 69, 72])
</script>

<template>
  <svg class="octave-keys" :viewBox="`-2 -2 ${whiteNotes.length * keyW + 4} 290`" role="img" aria-label="An octave of piano keys">
    <g v-for="(note, i) in whiteNotes" :key="note">
      <rect :x="i * keyW" y="0" :width="keyW" height="200" class="white" :class="{ marked: marked.has(note) }" />
      <text :x="i * keyW + keyW / 2" y="185" class="num">{{ note }}</text>
      <text v-if="marked.has(note)" :x="i * keyW + keyW / 2" y="240" class="hz">{{ Math.round(mtof(note)) }} Hz</text>
    </g>
    <rect
      v-for="key in blackNotes"
      :key="key.note"
      :x="(key.after + 1) * keyW - 22"
      y="0"
      width="44"
      height="120"
      class="black"
    />
    <text :x="(whiteNotes.length * keyW) / 2" y="282" class="caption">12 keys up = twice the frequency</text>
  </svg>
</template>

<style scoped>
.octave-keys {
  width: 100%;
}

.white {
  fill: var(--bg);
  stroke: var(--ink);
  stroke-width: 2;
}

.white.marked {
  fill: var(--surface);
  stroke: var(--accent);
  stroke-width: 4;
}

.black {
  fill: var(--ink);
}

.num {
  fill: var(--muted);
  font-family: var(--font-mono);
  font-size: 18px;
  text-anchor: middle;
}

.hz {
  fill: var(--accent);
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
  text-anchor: middle;
}

.caption {
  fill: var(--muted);
  font-family: var(--font-body);
  font-size: 18px;
  text-anchor: middle;
}
</style>
