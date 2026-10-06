<script setup lang="ts">
// The four built-in oscillator types, one period and a half each:
// <WaveShapes v-model="wave" @pick="preview" />
// `pick` fires on every click, even on the current one.
const model = defineModel<OscillatorType>({ required: true })
defineEmits<{ pick: [type: OscillatorType] }>()

// PLACEHOLDER(refine): wave shape visual
// Drawn in ShapePicker's 200 × 80 box.
const h = 80

function sine() {
  let d = ''
  for (let x = 0; x <= 200; x += 2) {
    const y = h / 2 - (h / 2) * Math.sin((x / 100) * Math.PI * 2)
    d += `${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)}`
  }
  return d
}

const options: { value: OscillatorType; label: string; d: string }[] = [
  { value: 'sine', label: "'sine'", d: sine() },
  { value: 'square', label: "'square'", d: `M0 ${h} V0 H50 V${h} H100 V0 H150 V${h} H200` },
  { value: 'sawtooth', label: "'sawtooth'", d: `M0 ${h} L66.7 0 V${h} L133.3 0 V${h} L200 0` },
  { value: 'triangle', label: "'triangle'", d: `M0 ${h / 2} L25 0 L75 ${h} L125 0 L175 ${h} L200 ${h / 2}` },
]
</script>

<template>
  <ShapePicker v-model="model" :options="options" axis="middle" trace="signal" @pick="$emit('pick', $event)" />
</template>
