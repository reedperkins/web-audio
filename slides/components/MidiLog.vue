<script setup lang="ts">
import { computed } from 'vue'
import { clearMessages, messages, noteName } from '../audio/input'
import { useDemo } from '../audio/useDemo'

// 5a "MIDI comes in": the last message (`e.data`) as a table, one column per
// byte. The bits row is the frame itself: a status byte starts with 1 (then
// the message type and the channel, 4 bits each), a data byte with 0 (then a
// 7-bit value). Starts empty each time the slide opens.
useDemo({ enter: clearMessages })

const TYPES: Record<number, string> = {
  0x80: 'note off',
  0x90: 'note on',
  0xa0: 'key pressure',
  0xb0: 'control change',
  0xc0: 'program change',
  0xd0: 'pressure',
  0xe0: 'pitch bend',
}

function meanings([status = 0, a, b]: number[]) {
  const type = status & 0xf0
  if (status >= 0xf0 || !(type in TYPES)) return ['system', '', '']
  const what = type === 0x90 && b === 0 ? 'note off' : TYPES[type]
  if (type === 0x80 || type === 0x90 || type === 0xa0)
    return [`${what} · ch ${(status & 0x0f) + 1}`, `key ${noteName(a ?? 0)}`, type === 0xa0 ? 'pressure' : 'velocity']
  if (type === 0xb0) return [`${what} · ch ${(status & 0x0f) + 1}`, 'controller', 'value']
  if (type === 0xe0) return [`${what} · ch ${(status & 0x0f) + 1}`, 'fine', 'coarse']
  return [`${what} · ch ${(status & 0x0f) + 1}`, 'value', '']
}

const HEADERS = ['status', 'data 1', 'data 2']
// A blank 3-byte frame before the first message, so the table doesn't jump.
const EMPTY = [null, null, null]

const last = computed(() => messages.value[0])
const columns = computed(() => {
  const m = last.value
  if (!m) return EMPTY.map((_, i) => ({ header: HEADERS[i], value: null, bits: [], means: '' }))
  const means = meanings(m.data)
  return m.data.slice(0, 3).map((value, i) => ({
    header: HEADERS[i],
    value,
    bits: [...value.toString(2).padStart(8, '0')],
    means: means[i],
  }))
})
</script>

<template>
  <!-- PLACEHOLDER(refine): raw-MIDI display -->
  <div class="midi-log">
    <MidiStatus />
    <table :key="last?.id" class="frame" :class="{ empty: !last }">
      <thead>
        <tr>
          <th />
          <th v-for="col in columns" :key="col.header">{{ col.header }}</th>
        </tr>
      </thead>
      <tbody>
        <tr class="bits">
          <th>bits</th>
          <td v-for="(col, i) in columns" :key="i">
            <span
              v-for="(bit, b) in col.bits"
              :key="b"
              class="bit"
              :class="{ flag: b === 0, split: i > 0 && b === 0, nibble: i === 0 && b === 4 }"
            >{{ bit }}</span>
            <span v-if="!col.bits.length" class="blank">········</span>
          </td>
        </tr>
        <tr class="value">
          <th>decimal</th>
          <td v-for="(col, i) in columns" :key="i">{{ col.value ?? '–' }}</td>
        </tr>
        <tr class="means">
          <th>means</th>
          <td v-for="(col, i) in columns" :key="i">{{ col.means }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.midi-log {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.frame {
  width: auto;
  margin: 0;
  border-collapse: collapse;
  font-size: var(--size-small);
}

.frame tr {
  border: none;
}

.frame th,
.frame td {
  padding: 0.05em 1.1em 0.05em 0;
  border: none;
  line-height: 1.35;
  text-align: left;
  white-space: nowrap;
}

.frame thead th {
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--wire);
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.frame tbody th {
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 400;
}

.frame tbody tr:first-child > * {
  padding-top: 0.35em;
}

.bits td {
  font-family: var(--font-mono);
  font-size: 0.95rem;
}

.bit {
  display: inline-block;
  width: 0.95em;
  text-align: center;
  color: var(--ink);
}

/* The first bit says status (1) or data (0). */
.bit.flag {
  border-radius: 3px;
  background: var(--surface);
  color: var(--accent);
  font-weight: 700;
}

/* A data byte is that 0, then a 7-bit value. */
.bit.split {
  margin-right: 0.3em;
}

/* The status byte splits into type | channel. */
.bit.nibble {
  margin-left: 0.4em;
}

.blank {
  color: var(--wire);
  letter-spacing: 0.2em;
}

.value td {
  color: var(--accent);
  font-family: var(--font-mono);
  font-weight: 700;
}

.means td {
  color: var(--muted);
  font-size: 0.95rem;
}

.frame:not(.empty) .value td {
  animation: arrive 0.2s;
}

@keyframes arrive {
  from {
    opacity: 0.2;
  }
}
</style>
