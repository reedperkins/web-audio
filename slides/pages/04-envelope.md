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

<AdsrDemo class="adsr" />

<style>
.adsr {
  margin-top: 0.5rem;
}
</style>

---
layout: code
---

# An envelope is a scheduled gain

```js {1-3|5-11|12-15|all}
const env = {
  attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.4,
}

function noteOn(gain, t) {
  gain.cancelScheduledValues(t)
  gain.setValueAtTime(0, t)
  gain.linearRampToValueAtTime(1, t + env.attack)
  gain.linearRampToValueAtTime(env.sustain,
    t + env.attack + env.decay)
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

<style>
/* Leaves room for the notes column. */
.slidev-layout {
  --slidev-code-font-size: 1rem;
}
</style>
