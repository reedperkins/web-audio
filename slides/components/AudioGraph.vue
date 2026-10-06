<script setup lang="ts">
// Boxes and arrows: sources → processors → speakers.
// PLACEHOLDER(refine): swap for a static render of the hub (SLIDES_PLAN 5.2).
const nodes = [
  { x: 0, label: 'Source', sub: 'oscillator, mic, file' },
  { x: 290, label: 'Processor', sub: 'volume, envelope, filter' },
  { x: 580, label: 'Speakers', sub: 'ctx.destination' },
]
</script>

<template>
  <svg class="audio-graph" viewBox="-4 -4 828 128" role="img" aria-label="Source to processor to speakers">
    <defs>
      <marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M0 0L10 5L0 10z" class="arrow-head" />
      </marker>
    </defs>
    <g v-for="node in nodes" :key="node.label">
      <rect :x="node.x" y="0" width="240" height="120" rx="14" class="box" />
      <text :x="node.x + 120" y="56" class="label">{{ node.label }}</text>
      <text :x="node.x + 120" y="88" class="sub">{{ node.sub }}</text>
    </g>
    <line x1="244" y1="60" x2="284" y2="60" class="wire" marker-end="url(#graph-arrow)" />
    <line x1="534" y1="60" x2="574" y2="60" class="wire" marker-end="url(#graph-arrow)" />
  </svg>
</template>

<style scoped>
.audio-graph {
  width: 100%;
}

.box {
  fill: var(--surface);
  stroke: var(--ink);
  stroke-width: 3;
}

.label {
  fill: var(--ink);
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 700;
  text-anchor: middle;
}

.sub {
  fill: var(--muted);
  font-family: var(--font-mono);
  font-size: 17px;
  text-anchor: middle;
}

.wire {
  stroke: var(--accent);
  stroke-width: 4;
}

.arrow-head {
  fill: var(--accent);
}
</style>
