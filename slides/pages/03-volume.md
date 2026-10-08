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

```js {all}
function setVolume(value) {
  volume.gain.value = value
}
```

::aside::

<StepNote :at="0"><code>gain</code> is an <code>AudioParam</code>: a value on the audio clock that you can schedule, or drive with another signal.</StepNote>
<StepNote :at="0"><code>gain.value</code> is a <code>number</code>; setting it direclty jumps straight there. Drag fast and you can hear the steps.</StepNote>

::demo::

<VolumeDemo hold jump :max-gain="0.2" />

<style>
/* The code is short; leave room under it for the chain. */
.slidev-layout.has-aside {
  grid-template-columns: minmax(36rem, max-content) minmax(12rem, 1fr);
}
</style>

---
layout: code
---

# Automating parameters

````md magic-move {lines: true}
```js {all|3}
function setVolume(value) {
  const now = ctx.currentTime
  volume.gain.setTargetAtTime(value, now, 0.05)
}
```

```js {1-2|3|5|all}
const lfo = new OscillatorNode(ctx)
lfo.frequency.value = 2
const lfoDepth = new GainNode(ctx, { gain: 0.05 })
setVolume(0.15)
lfo.connect(lfoDepth).connect(volume.gain)
lfo.start()
```
````

::aside::

<StepNote :at="0">Same knob, but schedule the change instead of jumping.</StepNote>
<StepNote :at="1">Glide to the new value, starting now. No clicks.</StepNote>
<StepNote :at="2">An LFO: an oscillator too slow to hear.</StepNote>
<StepNote :at="3"><code>lfoDepth</code> scales its ±1 swing down to ±0.05.</StepNote>
<StepNote :at="4">A node connected to a param adds to it: 0.15&nbsp;±&nbsp;0.05.</StepNote>

::demo::

<VolumeDemo hold :max-gain="0.2" :lfo-at="2" />
