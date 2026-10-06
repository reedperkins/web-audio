<script setup lang="ts">
// Stepped code with an optional notes column (the `aside` slot) and an
// optional demo link in the corner.
//
//   ---
//   layout: code
//   demo: first-sound
//   ---
//   # Title
//   ```js {1|2|all}
//   ...
//   ```
//   ::aside::
//   <StepNote :at="1">...</StepNote>
defineProps<{ demo?: string; demoLabel?: string }>()
</script>

<template>
  <!-- PLACEHOLDER(refine): code layout proportions and spacing -->
  <div class="slidev-layout code-layout" :class="{ 'has-aside': $slots.aside }">
    <div class="code-main">
      <slot />
    </div>
    <aside v-if="$slots.aside" class="code-aside">
      <slot name="aside" />
    </aside>
    <div v-if="demo !== undefined" class="code-demo">
      <DemoLink :to="demo">{{ demoLabel ?? 'Try it' }}</DemoLink>
    </div>
  </div>
</template>

<style scoped>
.code-layout {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  column-gap: 2.5rem;
  align-content: start;
}

.code-layout.has-aside {
  grid-template-columns: 3fr 2fr;
}

.code-main :deep(h1) {
  margin-bottom: 1.5rem;
}

.code-main :deep(h1 + p) {
  margin-top: -0.75rem;
  color: var(--muted);
  opacity: 1;
}

.code-aside {
  padding-top: 5.25rem;
}

.code-demo {
  position: absolute;
  right: 3.5rem;
  bottom: 2rem;
}
</style>
