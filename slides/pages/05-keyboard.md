---
layout: code
demo: keyboard
demoLabel: 5a · Raw MIDI
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

---
layout: code
demo: keyboard
demoLabel: 5b · Numbers → pitch
---

# Numbers → pitch

```js
const mtof = (note) => 440 * 2 ** ((note - 69) / 12)
```

<OctaveKeys class="octave" />

<style>
.octave {
  width: 70%;
  margin: 2rem auto 0;
  display: block;
}
</style>

---
layout: code
demo: keyboard
demoLabel: 5c · Polyphony
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
demo: keyboard
demoLabel: 5c · Polyphony
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

---
layout: code
demo: keyboard
demoLabel: 5d · Wave types
---

# Wave types

```js
const osc = new OscillatorNode(ctx, { type: 'square', frequency: 220 })
```

<WaveShapes class="mt-12" />

---
layout: code
demo: keyboard
demoLabel: 5e · Song presets
# PLACEHOLDER(refine): song presets and what each one plays
---

# Wave + envelope = an instrument

| Preset | Wave | Envelope | Plays |
|--------|------|----------|-------|
| Zelda | square | Organ | a Zelda riff |
| Electronic | sawtooth | Stab | TBD |
| TBD | triangle | Pluck | TBD |
