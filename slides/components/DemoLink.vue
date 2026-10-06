<script setup lang="ts">
import { computed } from 'vue'

// Opens a demo route in the one reused tab named "demo". Only the hash
// changes, so the demo app never reloads and its audio keeps running.
const props = defineProps<{ to: string }>()

const base = import.meta.env.DEV ? 'http://localhost:5173/' : '/demos/'
const href = computed(() => `${base}#/${props.to.replace(/^[#/]+/, '')}`)

// Slidev ignores its shortcuts while a link has focus, so never keep it.
function blur(event: MouseEvent) {
  ;(event.currentTarget as HTMLElement).blur()
}
</script>

<template>
  <!-- PLACEHOLDER(refine): demo link look -->
  <a class="demo-link" :href="href" target="demo" @mousedown.prevent @click="blur">
    <span class="demo-link-icon">▶</span>
    <slot>Try it</slot>
  </a>
</template>

<style scoped>
.demo-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.35em 0.9em;
  border: 2px solid var(--accent);
  border-radius: 999px;
  color: var(--accent);
  font-family: var(--font-body);
  font-size: var(--size-small);
  font-weight: 600;
  text-decoration: none;
  border-bottom: 2px solid var(--accent) !important;
}

.demo-link:hover {
  background: var(--accent);
  color: var(--bg);
}

.demo-link-icon {
  font-size: 0.8em;
}
</style>
