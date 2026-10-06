<script setup lang="ts">
import { ref, watch } from 'vue'
import { unlock } from '../audio/audio'
import { useDemo } from '../audio/useDemo'

// Plays the "Turn it down" slide's code, and the slider runs the
// "AudioParams" slide's setVolume. With `hold`, the chord plays until the
// button is pressed again (time to move the slider) instead of for 2 s.
const props = defineProps<{ hold?: boolean }>()

const chord = [261.63, 329.63, 392, 523.25]
const level = ref(0.2)
const playing = ref(false)

let volume: GainNode | null = null
let oscs: OscillatorNode[] = []

const { ctx, out } = useDemo({ leave: stop })

async function toggle() {
  if (playing.value) return stop()
  await unlock()
  volume = new GainNode(ctx, { gain: level.value })
  volume.connect(out.value)
  oscs = chord.map((frequency) => {
    const osc = new OscillatorNode(ctx, { frequency })
    osc.connect(volume!)
    osc.start()
    if (!props.hold) osc.stop(ctx.currentTime + 2)
    return osc
  })
  const mine = oscs
  oscs[0].onended = () => { if (oscs === mine) playing.value = false }
  playing.value = true
}

// Fade instead of cutting off, so stopping doesn't click.
function stop() {
  if (!playing.value) return
  const t = ctx.currentTime
  volume?.gain.setTargetAtTime(0, t, 0.01)
  oscs.forEach(osc => osc.stop(t + 0.1))
  playing.value = false
}

function setVolume(value: number) {
  const now = ctx.currentTime
  volume?.gain.setTargetAtTime(value, now, 0.05)
}

watch(level, setVolume)
</script>

<template>
  <SignalChain class="volume-demo" :nodes="[
    { key: 'osc', label: 'osc ×4' },
    { key: 'gain', label: 'GainNode' },
    { key: 'out', label: 'speakers' },
  ]">
    <template #osc>
      <PlayButton :playing="playing" @play="toggle" />
    </template>
    <template #gain>
      <Slider v-model="level" class="gain" label="gain" />
    </template>
  </SignalChain>
</template>

<style scoped>
.volume-demo .gain {
  gap: 0.4em;
  font-size: 0.8rem;
}

.volume-demo .gain :deep(input) {
  width: 5rem;
}
</style>
