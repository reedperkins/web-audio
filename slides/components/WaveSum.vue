<script setup lang="ts">
import { computed } from 'vue'

// Drawn from the math, not recorded: each sine, their sum, the ±1 limit, and
// the flat tops where the sum gets clipped. `ms` is the window shown.
const props = withDefaults(defineProps<{ frequencies: number[]; ms?: number }>(), { ms: 12 })

const W = 600
const H = 150
const RANGE = 4 // the y axis spans ±RANGE
const N = 400
const y = (v: number) => H / 2 - (v / RANGE) * (H / 2)

function path(f: (t: number) => number) {
  let d = ''
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * props.ms / 1000
    d += `${i ? 'L' : 'M'}${((i / N) * W).toFixed(1)} ${y(f(t)).toFixed(1)}`
  }
  return d
}

const sine = (freq: number) => (t: number) => Math.sin(2 * Math.PI * freq * t)
const sum = (t: number) => props.frequencies.reduce((s, freq) => s + sine(freq)(t), 0)

const waves = computed(() => props.frequencies.map(freq => path(sine(freq))))
const total = computed(() => path(sum))
const clipped = computed(() => path(t => Math.max(-1, Math.min(1, sum(t)))))
</script>

<template>
  <!-- PLACEHOLDER(refine): wave sum look -->
  <svg class="wave-sum" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none">
    <rect class="limit-band" x="0" :y="y(1)" :width="W" :height="y(-1) - y(1)" />
    <path v-for="(d, i) in waves" :key="i" class="sine" :d="d" />
    <path class="sum" :d="total" />
    <path class="clipped" :d="clipped" />
    <line class="limit" x1="0" :x2="W" :y1="y(1)" :y2="y(1)" />
    <line class="limit" x1="0" :x2="W" :y1="y(-1)" :y2="y(-1)" />
    <text class="label" x="4" :y="y(1) - 4">+1</text>
    <text class="label" x="4" :y="y(-1) + 13">−1</text>
  </svg>
</template>

<style scoped>
.wave-sum {
  width: 100%;
  height: 9rem;
  color: var(--ink);
}

path {
  fill: none;
  vector-effect: non-scaling-stroke;
}

.limit-band {
  fill: var(--surface);
}

.sine {
  stroke: var(--wire);
  stroke-width: 1;
}

.sum {
  stroke: var(--ink);
  stroke-width: 2;
  stroke-dasharray: 4 3;
}

.clipped {
  stroke: var(--accent);
  stroke-width: 3;
}

.limit {
  stroke: var(--accent);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.label {
  fill: var(--muted);
  font-family: var(--font-mono);
  font-size: 12px;
}
</style>
