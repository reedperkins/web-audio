---
layout: code
---

# Scheduling gain automation

Thinking about instruments in terms of ADSR opens the door for emulation

<AdsrDemo class="adsr" />

<style>
.adsr {
  margin-top: 0.5rem;
}
</style>

---
layout: code
---

# Implementing ADSR

```js
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
  gain.setTargetAtTime(0, t, env.release / 5)
}
```

<style>
.slidev-layout {
  --slidev-code-font-size: 1rem;
}
</style>
