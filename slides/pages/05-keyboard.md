---
layout: code
keyboard: true
---

# MIDI comes in

```js
const midi = await navigator.requestMIDIAccess()
midi.inputs.forEach((input) => {
  input.onmidimessage = (e) => console.log(e.data)
})
```

::demo::

<MidiLog />

---
layout: code
---

# Numbers → pitch

```js
const mtof = (note) => 440 * 2 ** ((note - 69) / 12)
```

<div class="pitch-row">
  <OctaveKeys class="octave" />
  <PitchGraph class="graph" />
</div>

<style>
.pitch-row {
  display: grid;
  grid-template-columns: 2fr 3fr;
  align-items: center;
  gap: 2.5rem;
  margin-top: 1.5rem;
}
.pitch-row > * {
  min-width: 0;
  width: 100%;
}
</style>

---
layout: code
---

# One voice per key

```js
class Voice {
  constructor(frequency) {
    this.osc = new OscillatorNode(ctx, { frequency })
    this.amp = new GainNode(ctx, { gain: 0 })
    this.osc.connect(this.amp).connect(ctx.destination)
    noteOn(this.amp.gain, ctx.currentTime)
    this.osc.start()
  }
  release() {
    const t = ctx.currentTime
    noteOff(this.amp.gain, t)
    this.osc.stop(t + env.release)
  }
}
```

---
layout: code
---

# Polyphony

```js
const voices = new Map()
function keyDown(note) {
  voices.set(note, new Voice(mtof(note)))
}
function keyUp(note) {
  voices.get(note)?.release()
  voices.delete(note)
}
```

::aside::

<VoiceList />

::demo::

<VoicesDemo />

---
layout: code
---

# Wave types

```js
const osc = new OscillatorNode(ctx, { type: wave, frequency })
```

::demo::

<WaveDemo />

---
layout: code
clicks: 2
---

# Carve it: filters

::demo::

<FilterDemo :env-at="1" :wah-at="2" />
