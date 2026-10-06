<script setup lang="ts">
// Stepped code with an optional notes column (`::aside::`) and an optional
// demo under the code (`::demo::`).
//
//   ---
//   layout: code
//   ---
//   # Title
//   ```js {1|2|all}
//   ...
//   ```
//   ::aside::
//   <StepNote :at="1">...</StepNote>
//   ::demo::
//   <BeepDemo />
</script>

<template>
  <div class="slidev-layout code-layout" :class="{ 'has-aside': $slots.aside }">
    <div class="code-main">
      <slot />
    </div>
    <aside v-if="$slots.aside" class="code-aside">
      <slot name="aside" />
    </aside>
    <div v-if="$slots.demo" class="code-demo">
      <slot name="demo" />
    </div>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): code layout proportions and spacing */
.code-layout {
  display: grid;
  grid-template-columns: 1fr;
  column-gap: 2.5rem;
  align-content: start;
}

.code-layout.has-aside {
  grid-template-columns: max-content minmax(12rem, 1fr);
}

.code-main :deep(h1) {
  margin-bottom: 1.25rem;
}

.code-main :deep(h1 + p) {
  margin-top: -0.75rem;
  color: var(--muted);
  opacity: 1;
}

.code-main {
  grid-row: 1;
}

.code-aside {
  grid-row: 1 / span 2;
  grid-column: 2;
  padding-top: 5rem;
}

.code-demo {
  grid-row: 2;
  grid-column: 1;
  margin-top: 0.75rem;
  /* The code sets the column width; the demo fits inside it. */
  contain: inline-size;
}
</style>
