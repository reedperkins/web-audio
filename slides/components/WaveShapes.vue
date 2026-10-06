<script setup lang="ts">
import { vNoFocus } from '../audio/useDemo'

// The four built-in oscillator types as buttons, one period and a half each:
// <WaveShapes v-model="wave" @pick="preview" />
// The current type lights up. `pick` fires on every click, even on the
// current one.
const model = defineModel<OscillatorType>({ required: true })
const emit = defineEmits<{ pick: [type: OscillatorType] }>()

// PLACEHOLDER(refine): wave shape visual
const w = 200
const h = 80
const shapes: { type: OscillatorType; d: string }[] = [
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

function pick(type: OscillatorType) {
  model.value = type
  emit('pick', type)
}
</script>

<template>
  <div class="wave-shapes">
    <button
      v-for="shape in shapes"
      :key="shape.type"
      v-no-focus
      class="shape"
      :class="{ on: model === shape.type }"
      @click="pick(shape.type)"
    >
      <svg :viewBox="`-6 -6 ${w + 12} ${h + 12}`" role="img" :aria-label="`${shape.type} wave`">
        <line x1="0" :y1="h / 2" :x2="w" :y2="h / 2" class="axis" />
        <path :d="shape.d" class="trace" />
      </svg>
      <span class="name">'{{ shape.type }}'</span>
    </button>
  </div>
</template>

<style scoped>
.wave-shapes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.4rem;
}

.shape {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.35rem 0.4rem 0.25rem;
  border: 2px solid var(--wire);
  border-radius: 0.5rem;
  background: none;
  color: var(--muted);
  cursor: pointer;
}

.shape:hover,
.shape.on {
  border-color: var(--accent);
  color: var(--ink);
}

.shape.on {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

svg {
  width: 100%;
}

.axis {
  stroke: var(--wire);
  stroke-width: 2;
  stroke-dasharray: 6 6;
}

.trace {
  fill: none;
  stroke: var(--wire);
  stroke-width: 8;
  stroke-linejoin: round;
}

.shape:hover .trace,
.shape.on .trace {
  stroke: var(--signal);
}

.name {
  font-family: var(--font-mono);
  font-size: 0.6rem;
}
</style>
