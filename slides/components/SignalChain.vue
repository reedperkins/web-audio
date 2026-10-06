<script setup lang="ts">
import type { StyleValue } from 'vue'

// Boxes joined by arrows, left to right. Each node can hold a control in the
// slot named after its key:
//   <SignalChain :nodes="[{ key: 'gain', label: 'GainNode' }, …]">
//     <template #gain><Slider v-model="level" /></template>
//   </SignalChain>
// A node's `style` sizes it (`{ width: '10rem' }`, `{ flex: 1 }`) or dims it.
// `stretch` makes every node as tall as the tallest, contents from the top,
// for nodes that hold whole panels. `--node-padding` sets the padding.
// A `<key>-above` slot draws a node above that one, with a wire down into it
// (e.g. an LFO into a param). It sits outside the layout, so leave room above.
defineProps<{ nodes: { key: string; label: string; style?: StyleValue }[]; stretch?: boolean }>()
</script>

<template>
  <div class="signal-chain" :class="{ stretch }">
    <template v-for="(node, i) in nodes" :key="node.key">
      <span v-if="i" class="wire">→</span>
      <div class="node" :style="node.style">
        <div class="node-label">{{ node.label }}</div>
        <slot :name="node.key" />
        <div v-if="$slots[`${node.key}-above`]" class="above">
          <div class="node">
            <slot :name="`${node.key}-above`" />
          </div>
          <span class="wire">↓</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): signal chain look */
.signal-chain {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.signal-chain.stretch {
  align-items: stretch;
}

.stretch > .wire {
  align-self: center;
}

.stretch > .node {
  justify-content: flex-start;
}

.node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: var(--node-padding, 0.5rem 1rem);
  border: 2px solid var(--ink);
  border-radius: 10px;
  background: var(--surface);
  position: relative;
  transition: opacity 0.2s;
}

.above {
  position: absolute;
  bottom: 100%;
  left: 50%;
  translate: -50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
}

.above > .node {
  padding: 0.3rem 0.8rem;
}

.above > .wire {
  line-height: 1;
}

.node-label {
  font-family: var(--font-mono);
  font-size: var(--size-small);
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
}

.wire {
  color: var(--accent);
  font-size: var(--size-body);
  font-weight: 700;
}
</style>
