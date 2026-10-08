---
layout: code
keyboard: true
---

# MIDI-chlorians

```js
const midi = await navigator.requestMIDIAccess()
midi.inputs.forEach((input) => {
  input.onmidimessage = (e) => console.log(e.data)
})
```

::aside::

<img src="/images/midichlorians.jpg" alt="Qui-Gon takes a blood sample from Anakin's hand" class="midichlorians">

::demo::

<MidiLog />

<style>
.midichlorians {
  width: 100%;
  border-radius: 10px;
}
</style>

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

# Polyphony step 1

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

::aside::

<StepNote :at="0">Every voice gets its own oscillator. Source nodes are one-shot: make one, play it, throw it away. Calling <code>start()</code> again on a stopped oscillator throws an <code>InvalidStateError</code>.</StepNote>

---
layout: code
---

# Polyphony step 2

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
keyboard: true
---

# Surf's up!

```js
const osc = new OscillatorNode(ctx, { type: wave, frequency })
```

::demo::

<WaveDemo />

---
layout: code
keyboard: true
---

# Freq-y Friday

Filters shape sound in the frequency domain.

::demo::

<div class="freq">
  <FilterDemo :env-at="0" :wah-at="0" />
  <div class="freq-notes">
    <StepNote :at="0">A lowpass filter cuts the harmonics above its cutoff. Resonance boosts the ones right at it.</StepNote>
    <StepNote :at="0">An envelope or an LFO can move the cutoff while a note plays.</StepNote>
  </div>
</div>

<style>
/* The notes fill the empty space above the GainNode and destination. */
.freq {
  position: relative;
  /* Keep the graph's top margin (room for the LFO) inside, so the notes start at the top. */
  display: flow-root;
}

.freq-notes {
  position: absolute;
  top: 0;
  right: 0;
  width: 41%;
}

/* Center the graph in the space under the title. */
.code-layout {
  grid-template-rows: auto 1fr;
}

.code-layout :deep(.code-demo) {
  align-self: center;
}
</style>
