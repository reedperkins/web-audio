<script setup lang="ts">
// One big idea in a few words, with an optional demo link underneath.
defineProps<{ demo?: string; demoLabel?: string }>()
</script>

<template>
  <!-- PLACEHOLDER(refine): statement layout type scale and spacing -->
  <div class="slidev-layout statement-layout">
    <div class="statement-body">
      <slot />
    </div>
    <div v-if="demo !== undefined" class="statement-demo">
      <DemoLink :to="demo">{{ demoLabel ?? 'Try it' }}</DemoLink>
    </div>
  </div>
</template>

<style scoped>
.statement-layout {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2.5rem;
  text-align: center;
}

.statement-body :deep(h1) {
  font-size: var(--size-display);
  line-height: 1.1;
  margin: 0;
}

.statement-body :deep(p) {
  margin-top: 1.25rem;
  color: var(--muted);
  opacity: 1;
}
</style>
