---
layout: code
keyboard: true
---

# MIDI comes in

```js {1|2-4|all}
const midi = await navigator.requestMIDIAccess()
midi.inputs.forEach((input) => {
  input.onmidimessage = (e) => console.log(e.data)
})
```

::aside::

<StepNote :at="0">Ask the browser for MIDI devices.</StepNote>
<StepNote :at="1">Log every message from every input.</StepNote>
<StepNote :at="2"><code>[144, 60, 100]</code>: note on, key 60, this hard. Every key is just a number. Middle C is 60.</StepNote>

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

```js {2-4|5-6|8-12|all}
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

<StepNote :at="0">A voice is an oscillator plus its own envelope.</StepNote>
<StepNote :at="1">Wire it up and start the envelope.</StepNote>
<StepNote :at="2">On release, fade out, then stop the oscillator.</StepNote>
<StepNote :at="3">The <code>noteOn</code> and <code>noteOff</code> from the envelope slide.</StepNote>

---
layout: code
---

# Polyphony

```js {1|2-4|5-8|all}
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

<StepNote :at="0">One voice for each key that's down.</StepNote>
<StepNote :at="1">Key down: a new voice at that key's pitch.</StepNote>
<StepNote :at="2">Key up: release it and forget it.</StepNote>
<StepNote :at="3">Press three keys, get three voices: a chord.</StepNote>
<VoiceList />

::demo::

<VoicesDemo />

---
layout: code
---

# Wave types

```js
const osc = new OscillatorNode(ctx, { type: 'square', frequency: 220 })
```

<WaveShapes class="mt-12" />

---
layout: code
# PLACEHOLDER(refine): song presets and what each one plays
---

# Wave + envelope = an instrument

| Preset | Wave | Envelope | Plays |
|--------|------|----------|-------|
| Zelda | square | Organ | a Zelda riff |
| Electronic | sawtooth | Stab | TBD |
| TBD | triangle | Pluck | TBD |
