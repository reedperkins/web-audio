<script setup lang="ts">
import { computed } from 'vue'

// One bar per note: when it starts and how long it lasts, on a shared time
// axis in seconds. `playhead` is seconds since the first note, or null.
// `span` fixes the axis length, so it doesn't rescale when `length` changes.
const props = defineProps<{
  starts: number[]
  length: number
  playhead: number | null
  span?: number
}>()

const W = 900
const ROW = 26
const GUTTER = 125 // room for the start labels left of the axis
const end = computed(() => props.span ?? Math.max(...props.starts) + props.length)
const x = (t: number) => (t / end.value) * W
const ticks = computed(() => {
  const out: number[] = []
  for (let t = 0; t <= end.value + 1e-9; t += 0.1) out.push(t)
  return out
})
</script>

<template>
  <!-- PLACEHOLDER(refine): timeline look -->
  <svg class="timeline" :viewBox="`-${GUTTER} -6 ${W + GUTTER + 24} ${starts.length * ROW + 40}`">
    <g v-for="(t, i) in starts" :key="i">
      <rect class="bar" :class="{ on: playhead !== null && playhead >= t && playhead < t + length }"
        :x="x(t)" :y="i * ROW" :width="x(length)" :height="ROW - 6" rx="4" />
      <text class="start" x="-12" :y="i * ROW + 15">now + {{ t.toFixed(1) }}</text>
    </g>
    <line class="axis" x1="0" :x2="W" :y1="starts.length * ROW + 2" :y2="starts.length * ROW + 2" />
    <g v-for="t in ticks" :key="t">
      <line class="axis" :x1="x(t)" :x2="x(t)" :y1="starts.length * ROW" :y2="starts.length * ROW + 6" />
      <text class="tick" :x="x(t)" :y="starts.length * ROW + 26">{{ t.toFixed(1) }}s</text>
    </g>
    <line v-if="playhead !== null" class="playhead"
      :x1="x(playhead)" :x2="x(playhead)" y1="-6" :y2="starts.length * ROW + 6" />
  </svg>
</template>

<style scoped>
.timeline {
  width: 100%;
  color: var(--ink);
}

.bar {
  fill: var(--surface);
  stroke: var(--wire);
  stroke-width: 1.5;
}

.bar.on {
  fill: var(--accent);
  stroke: var(--accent);
}

.start {
  fill: currentColor;
  text-anchor: end;
  font-family: var(--font-mono);
  font-size: 17px;
}

.axis {
  stroke: var(--wire);
  stroke-width: 1.5;
}

.tick {
  fill: var(--muted);
  font-family: var(--font-mono);
  font-size: 17px;
  text-anchor: middle;
}

.playhead {
  stroke: var(--signal);
  stroke-width: 3;
}
</style>
