<script setup lang="ts" generic="T">
// Pick one of a few options, as a row of chips with an optional label:
//   <Segmented v-model="mode" label="pitch" :options="[{ value: 'rate', label: 'detune' }, …]" />
// `size="sm"` is for laying over a picture: thinner chips on the surface color.
withDefaults(defineProps<{ options: { value: T; label: string }[]; label?: string; size?: 'sm' | 'md' }>(), {
  size: 'md',
})
const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="segmented" :class="size" role="group" :aria-label="label">
    <span v-if="label" class="segmented-label">{{ label }}</span>
    <ToggleChip
      v-for="option in options"
      :key="option.label"
      class="segmented-option"
      :on="model === option.value"
      @click="model = option.value"
    >
      {{ option.label }}
    </ToggleChip>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): segmented control look */
.segmented {
  display: flex;
  align-items: center;
  gap: 0.25em;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.65rem;
}

.segmented-label {
  margin-right: 0.15em;
}

.segmented-option {
  padding: 0.15em 0.65em;
  font: inherit;
}

.sm .segmented-option {
  padding: 0 0.5em;
  border-width: 1px;
}

.sm .segmented-option:not(.on) {
  background: var(--surface);
}
</style>
