<script setup lang="ts">
// Two periods of a sine wave, with its period and amplitude marked:
// <SineDiagram />
// Size it from the parent with `width` on the root; the height follows.

// PLACEHOLDER(refine): sine diagram look
// Drawn in a 280 × 180 box. The wave starts at X0, crosses the midline at MID
// and peaks AMP above it.
const X0 = 44
const PERIOD = 116
const MID = 112
const AMP = 58

let d = ''
for (let x = 0; x <= PERIOD * 2; x += 2) {
  const y = MID - AMP * Math.sin((x / PERIOD) * Math.PI * 2)
  d += `${x === 0 ? 'M' : 'L'}${X0 + x} ${y.toFixed(1)}`
}

const peak1 = X0 + PERIOD / 4
const peak2 = peak1 + PERIOD
const top = MID - AMP
const bracket = top - 16
</script>

<template>
  <svg class="sine-diagram" viewBox="0 0 280 180" role="img" aria-label="A sine wave with its period and amplitude marked">
    <line class="guide" :x1="X0 - 12" :y1="MID" x2="280" :y2="MID" />
    <line class="guide" :x1="X0 - 12" :y1="top" :x2="peak1" :y2="top" />

    <path class="wave" :d="d" />

    <!-- Period: peak to peak. -->
    <path class="marker" :d="`M${peak1} ${bracket + 7} V${bracket} H${peak2} V${bracket + 7}`" />
    <text class="label" :x="(peak1 + peak2) / 2" :y="bracket - 8" text-anchor="middle">period</text>

    <!-- Amplitude: midline to peak. -->
    <path class="marker" :d="`M${X0 - 12} ${MID} V${top}`" marker-start="url(#sine-arrow)" marker-end="url(#sine-arrow)" />
    <text class="label" text-anchor="middle" :transform="`translate(${X0 - 26} ${MID - AMP / 2}) rotate(-90)`">amplitude</text>

    <defs>
      <marker id="sine-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path class="arrowhead" d="M0 0 L10 5 L0 10 z" />
      </marker>
    </defs>
  </svg>
</template>

<style scoped>
.sine-diagram {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.wave {
  color: var(--signal);
  fill: none;
  stroke: currentColor;
  stroke-width: 3.5;
  stroke-linejoin: round;
}

.guide {
  color: var(--wire);
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
}

.marker {
  color: var(--accent);
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
}

.arrowhead {
  color: var(--accent);
  fill: currentColor;
}

.label {
  color: var(--ink);
  fill: currentColor;
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 600;
}
</style>
