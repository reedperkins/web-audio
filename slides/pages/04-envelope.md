---
layout: statement
---

# Click.

A tone that starts and stops instantly makes a pop.

---
layout: code
---

# Shape over time

A piano and an organ can play the same note. What's different is how the volume changes over time.

<AdsrShape class="adsr" />

<style>
.adsr {
  width: 60%;
  margin: 1.5rem auto 0;
  display: block;
}
</style>

---
layout: code
---

# An envelope is a scheduled gain

```js {1|3-8|9-12|all}
const env = { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.4 }

function noteOn(gain, t) {
  gain.cancelScheduledValues(t)
  gain.setValueAtTime(0, t)
  gain.linearRampToValueAtTime(1, t + env.attack)
  gain.linearRampToValueAtTime(env.sustain, t + env.attack + env.decay)
}
function noteOff(gain, t) {
  gain.cancelAndHoldAtTime(t)
  gain.linearRampToValueAtTime(0, t + env.release)
}
```

::aside::

<StepNote :at="0">Four numbers: attack, decay, sustain, release.</StepNote>
<StepNote :at="1">Key down: ramp up to full, then down to the sustain level.</StepNote>
<StepNote :at="2">Key up: hold wherever we are, then ramp to silence.</StepNote>
<StepNote :at="3">An envelope is just a <code>GainNode</code> whose volume we schedule.</StepNote>

---
layout: code
# PLACEHOLDER(refine): envelope preset values, tune by ear (keep in sync with the demo's presets)
---

# Same oscillator, different envelopes

| Preset | Attack | Decay | Sustain | Release | Feels like |
|--------|-------:|------:|--------:|--------:|------------|
| Organ | 0.005 | 0 | 1.0 | 0.05 | a switch |
| Pluck | 0.005 | 0.3 | 0 | 0.2 | a plucked string |
| Stab | 0.01 | 0.15 | 0.2 | 0.1 | a short synth hit |
| Percussive | 0.001 | 0.08 | 0 | 0.05 | a drum |
| Pad | 0.8 | 0.5 | 0.7 | 1.5 | a slow swell |
