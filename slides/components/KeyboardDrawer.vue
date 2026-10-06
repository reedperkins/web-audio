<script setup lang="ts">
import { computed, onUnmounted, ref, useTemplateRef } from 'vue'
import { connectOnScreen, held, inputs, pressKey, releaseKey } from '../audio/input'
import { vNoFocus } from '../audio/useDemo'
import type Keyboard from './Keyboard.vue'

// The backup keyboard: a tab at the bottom of the slide that pulls up an
// on-screen keyboard. Open, it counts as a connected MIDI device and plays
// through the same input; closing it is like unplugging one. The tab's dot
// shows whether any input is connected.
const open = ref(false)
const keyboard = useTemplateRef<InstanceType<typeof Keyboard>>('keyboard')
const connected = computed(() => inputs.value.length > 0)

function toggle() {
  if (open.value) keyboard.value?.upAll()
  open.value = !open.value
  connectOnScreen(open.value)
}
onUnmounted(() => connectOnScreen(false))
</script>

<template>
  <div class="drawer" :class="{ open }">
    <button v-no-focus class="tab" :title="open ? 'Hide keyboard' : 'Show keyboard'" @click="toggle">
      <span class="dot" :class="{ connected }" />
      Keyboard
      <span class="arrow">{{ open ? '▾' : '▴' }}</span>
    </button>
    <div class="panel">
      <Keyboard ref="keyboard" :down="held" @press="pressKey" @release="releaseKey" />
    </div>
  </div>
</template>

<style scoped>
.drawer {
  --tab-h: 1.6rem;
  position: absolute;
  left: 50%;
  bottom: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  translate: -50% calc(100% - var(--tab-h));
  transition: translate 0.25s ease;
}

.drawer.open {
  translate: -50% 0;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  height: var(--tab-h);
  padding: 0 0.8em;
  border: 1px solid var(--wire);
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 0.7rem;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.tab:hover,
.open .tab {
  opacity: 1;
}

.dot {
  width: 0.55em;
  height: 0.55em;
  border-radius: 50%;
  border: 1.5px solid var(--wire);
}

.dot.connected {
  border-color: var(--signal);
  background: var(--signal);
}

.arrow {
  font-size: 0.8em;
}

.panel {
  width: 520px;
  height: 92px;
  padding: 0.5rem 0.6rem 0.6rem;
  border: 1px solid var(--wire);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: var(--surface);
}

.open .panel {
  box-shadow: 0 -4px 16px color-mix(in srgb, var(--ink) 12%, transparent);
}
</style>
