---
layout: statement
# PLACEHOLDER(refine): on-screen text for each idea
---

# Vocoder

Your voice, played through the synth we just built.

---
layout: statement
---

# Granular synthesis

Chop sound into tiny grains and scatter them.

---
layout: statement
---

# Game of Life

Music from emergent behavior.

---

# Prior art

<ul class="prior-art">
  <li><b>Pure Data</b>: visual patching for sound, open source</li>
  <li><b>Max/MSP</b>: the same idea, used by musicians and artists</li>
  <li><b>noisecraft.app</b>: patch synths together in your browser</li>
</ul>

<style>
.prior-art li {
  margin-bottom: 1rem;
}
</style>

---
layout: code
---

# One knob, a thousand oscillators

```js {1-2|4-7|8-9|10|12|17}
const spread = new ConstantSourceNode(ctx, { offset: 0 })
spread.start()

function swarm(note) {
  const amp = new GainNode(ctx, { gain: 1 / Math.sqrt(size) })
  for (let i = 0; i < size; i++) {
    const osc = new OscillatorNode(ctx, { type: 'sawtooth', frequency: mtof(note) })
    const offset = new GainNode(ctx, { gain: Math.random() * 2 - 1 })
    spread.connect(offset).connect(osc.detune)
    drift[i % drift.length].connect(osc.detune)
    osc.connect(amp)
    osc.start(ctx.currentTime + Math.random() / mtof(note))
  }
  amp.connect(ctx.destination)
}

knob.oninput = () => spread.offset.setTargetAtTime(cents, ctx.currentTime, 0.03)
```

::aside::

<StepNote :at="0">A source whose output is one number: its <code>offset</code>.</StepNote>
<StepNote :at="1">Every key is a swarm: dozens of saws on the same note.</StepNote>
<StepNote :at="2">Each oscillator's detune listens to <code>spread</code>, scaled by its own random amount.</StepNote>
<StepNote :at="3">Slow LFOs wobble them out of step.</StepNote>
<StepNote :at="4">A random start, so in unison they don't stack into one giant saw.</StepNote>
<StepNote :at="5">Turn one knob: every oscillator moves, at audio rate, no loop.</StepNote>

<style>
.slidev-layout {
  --slidev-code-font-size: 0.68rem;
}
</style>

---

# Chaos

<ChaosDemo />

<style>
.slidev-layout h1 {
  margin-bottom: 0.6rem;
}
</style>
