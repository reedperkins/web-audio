<script setup lang="ts">
// The four built-in oscillator types, one period-and-a-half each.
// PLACEHOLDER(refine): wave shape visual
const w = 200
const h = 80
const shapes = [
  { type: 'sine', d: sine() },
  { type: 'square', d: `M0 ${h} V0 H50 V${h} H100 V0 H150 V${h} H200` },
  { type: 'sawtooth', d: `M0 ${h} L66.7 0 V${h} L133.3 0 V${h} L200 0` },
  { type: 'triangle', d: `M0 ${h / 2} L25 0 L75 ${h} L125 0 L175 ${h} L200 ${h / 2}` },
]

function sine() {
  let d = ''
  for (let x = 0; x <= w; x += 2) {
    const y = h / 2 - (h / 2) * Math.sin((x / 100) * Math.PI * 2)
    d += `${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)}`
  }
  return d
}
</script>

<template>
  <div class="wave-shapes">
    <figure v-for="shape in shapes" :key="shape.type">
      <svg :viewBox="`-4 -4 ${w + 8} ${h + 8}`" role="img" :aria-label="`${shape.type} wave`">
        <line x1="0" :y1="h / 2" :x2="w" :y2="h / 2" class="axis" />
        <path :d="shape.d" class="trace" />
      </svg>
      <figcaption>'{{ shape.type }}'</figcaption>
    </figure>
  </div>
</template>

<style scoped>
.wave-shapes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
}

figure {
  margin: 0;
  text-align: center;
}

svg {
  width: 100%;
}

.axis {
  stroke: var(--wire);
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
}

.trace {
  fill: none;
  stroke: var(--signal);
  stroke-width: 4;
  stroke-linejoin: round;
}

figcaption {
  margin-top: 0.5rem;
  font-family: var(--font-mono);
  font-size: var(--size-small);
  color: var(--ink);
}
</style>
