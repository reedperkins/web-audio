<script setup lang="ts">
// Boxes joined by arrows, left to right. Each node can hold a control in the
// slot named after its key:
//   <SignalChain :nodes="[{ key: 'gain', label: 'GainNode' }, …]">
//     <template #gain><Slider v-model="level" /></template>
//   </SignalChain>
defineProps<{ nodes: { key: string; label: string }[] }>()
</script>

<template>
  <!-- PLACEHOLDER(refine): signal chain look -->
  <div class="signal-chain">
    <template v-for="(node, i) in nodes" :key="node.key">
      <span v-if="i" class="wire">→</span>
      <div class="node">
        <div class="node-label">{{ node.label }}</div>
        <slot :name="node.key" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.signal-chain {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border: 2px solid var(--ink);
  border-radius: 10px;
  background: var(--surface);
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
