<script setup lang="ts">
import { computed } from 'vue'
import { access, requestAudio, requestMic, requestMidi } from '../audio/permissions'

// Settings for the first slide: one chip each for audio, MIDI and the mic.
// A chip fills once Chrome allows it, and clicking one that isn't allowed yet
// asks. A blocked one can only be unblocked from Chrome's site settings (the
// icon left of the address bar); the chip follows along when that changes.

const words = { granted: 'on', prompt: 'off', denied: 'blocked', unknown: '?' }

const chips = computed(() => [
  {
    name: 'audio',
    on: access.audio === 'running',
    blocked: false,
    word: access.audio === 'running' ? 'on' : 'off',
    ask: requestAudio,
  },
  {
    name: 'MIDI',
    on: access.midi === 'granted',
    blocked: access.midi === 'denied',
    word: words[access.midi],
    ask: requestMidi,
  },
  {
    name: 'mic',
    on: access.mic === 'granted',
    blocked: access.mic === 'denied',
    word: words[access.mic],
    ask: requestMic,
  },
])
</script>

<template>
  <div class="permission-chips">
    <ToggleChip
      v-for="chip in chips"
      :key="chip.name"
      class="chip"
      :class="{ blocked: chip.blocked }"
      :on="chip.on"
      :disabled="chip.blocked"
      :title="chip.blocked ? 'Blocked: allow it in Chrome\'s site settings' : undefined"
      @click="chip.on || chip.ask()"
    >
      {{ chip.name }} <span class="word">{{ chip.word }}</span>
    </ToggleChip>
  </div>
</template>

<style scoped>
/* PLACEHOLDER(refine): settings chips look */
.permission-chips {
  display: flex;
  gap: 0.4rem;
}

.chip {
  font-size: 0.65rem;
}

.word {
  font-weight: 400;
  opacity: 0.8;
}

.chip.blocked {
  text-decoration: line-through;
}
</style>
