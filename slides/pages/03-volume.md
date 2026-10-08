---
layout: code
---

# Beward of clipping

```js {all}
const chord = [261.63, 329.63, 392, 523.25]
chord.forEach((frequency) => {
  const osc = new OscillatorNode(ctx, { frequency })
  osc.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 2)
})
```

::aside::

<StepNote :at="0">Each oscillator swings between −1 and +1. Add four together and the wave goes past ±1, but digital audio can't go beyond that, so the signal gets clipped: distortion.</StepNote>

::demo::

<ClipDemo />

---
layout: code
---

# Turn down for what?

````md magic-move {lines: true}
```js
const chord = [261.63, 329.63, 392, 523.25]
chord.forEach((frequency) => {
  const osc = new OscillatorNode(ctx, { frequency })
  osc.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 2)
})
```

```js {2-3,6|*}
const chord = [261.63, 329.63, 392, 523.25]
const volume = new GainNode(ctx, { gain: 0.2 })
volume.connect(ctx.destination)
chord.forEach((frequency) => {
  const osc = new OscillatorNode(ctx, { frequency })
  osc.connect(volume)
  osc.start()
  osc.stop(ctx.currentTime + 2)
})
```
````

::aside::

<StepNote :at="0">Before: every oscillator goes straight to the speakers.</StepNote>
<StepNote :at="1">After: they all go through one <code>GainNode</code> at 0.2. The chord fits back inside ±1.</StepNote>

::demo::

<VolumeDemo />

---
layout: code
---

# Automating parameters

````md magic-move {lines: true}
```js {all}
// A slider calls this as it moves
function setVolume(value) {
  const now = ctx.currentTime
  volume.gain.setTargetAtTime(value, now, 0.05)
}
```

```js
// An LFO: a slow sine wave turns the knob
const lfo = new OscillatorNode(ctx)
lfo.frequency.value = 2
const depth = new GainNode(ctx, { gain: 0.05 })
setVolume(0.15)
lfo.connect(depth).connect(volume.gain)
lfo.start()
```
````

::aside::

<StepNote :at="0"><code>gain</code> isn't a plain number. It's an <code>AudioParam</code>.</StepNote>
<StepNote :at="1">You can schedule an <code>AudioParam</code> and smooth it over time.</StepNote>
<StepNote :at="2">Glide toward the new value, starting now. No jumps, no clicks.</StepNote>
<StepNote :at="3">A node connected to an <code>AudioParam</code> adds to its value: 0.15 ± 0.05.</StepNote>

::demo::

<VolumeDemo hold :lfo-at="1" />
