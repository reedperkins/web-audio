<script setup lang="ts">
import type { Envelope } from '../audio/envelope'
import { timeToFraction } from '../audio/envelope'
import type { EnvelopePreset } from '../audio/presets'
import { vNoFocus } from '../audio/useDemo'

// A row of envelope presets, one card each: <AdsrPresets :presets :current @pick />
// Each card shows A, D and R as bars as long as the time (on the editor's
// scale) and S as a bar as long as the level. `current` lights up the match.
const props = defineProps<{ presets: EnvelopePreset[]; current: Envelope }>()
defineEmits<{ pick: [preset: EnvelopePreset] }>()

function bars(p: Envelope) {
  return [
    { key: 'A', fraction: timeToFraction('attack', p.attack) },
    { key: 'D', fraction: timeToFraction('decay', p.decay) },
    { key: 'S', fraction: p.sustain },
    { key: 'R', fraction: timeToFraction('release', p.release) },
  ]
}

const isCurrent = (p: Envelope) =>
  (['attack', 'decay', 'sustain', 'release'] as const).every(k => p[k] === props.current[k])
</script>

<template>
  <!-- PLACEHOLDER(refine): preset card look -->
  <div class="adsr-presets">
    <button
      v-for="preset in presets"
      :key="preset.name"
      v-no-focus
      class="preset"
      :class="{ current: isCurrent(preset) }"
      :title="preset.feel"
      @click="$emit('pick', preset)"
    >
      <span class="name">{{ preset.name }}</span>
      <span v-for="bar in bars(preset)" :key="bar.key" class="bar">
        <span class="bar-key">{{ bar.key }}</span>
        <span class="track"><span class="fill" :style="{ width: `${bar.fraction * 100}%` }" /></span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.adsr-presets {
  display: flex;
  gap: 0.6rem;
}

.preset {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  width: 6.5rem;
  padding: 0.4rem 0.6rem 0.5rem;
  border: 2px solid var(--wire);
  border-radius: 0.5rem;
  background: none;
  color: var(--ink);
  cursor: pointer;
}

.preset:hover,
.preset.current {
  border-color: var(--accent);
}

.preset.current {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.name {
  margin-bottom: 0.15rem;
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 600;
  text-align: left;
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.bar-key {
  width: 0.7em;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.6rem;
}

.track {
  flex: 1;
  height: 0.3rem;
  border-radius: 999px;
  background: var(--surface);
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
}
</style>
