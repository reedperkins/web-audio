---
layout: code
---

# One beep

```js {1|2|3-4|all}
const osc = new OscillatorNode(ctx, { frequency: 440 })
osc.connect(ctx.destination)
osc.start()
osc.stop(ctx.currentTime + 1)
```

::aside::

<StepNote :at="0">A <b>source</b>: a tone at 440 Hz.</StepNote>
<StepNote :at="1">A <b>wire</b> to the <b>destination</b>: your speakers.</StepNote>
<StepNote :at="2">Start now. Stop one second from now.</StepNote>
<StepNote :at="3">A source, a destination, and a wire. That's a whole audio graph.</StepNote>

::demo::

<BeepDemo />

---
layout: code
---

# The audio clock

```js {1|2|3-5|6-7|all}
const notes = [261.63, 329.63, 392, 523.25]
const now = ctx.currentTime
notes.forEach((frequency, i) => {
  const osc = new OscillatorNode(ctx, { frequency })
  osc.connect(ctx.destination)
  osc.start(now + i * 0.1)
  osc.stop(now + i * 0.1 + 0.75)
})
```

::aside::

<StepNote :at="0">Four notes: a C major chord.</StepNote>
<StepNote :at="1"><code>ctx.currentTime</code> is the audio clock, in seconds.</StepNote>
<StepNote :at="2">One oscillator per note.</StepNote>
<StepNote :at="3">Each one starts 0.1 s after the last.</StepNote>
<StepNote :at="4">We hand the browser a schedule. Its clock plays it on time, even if JavaScript is busy.</StepNote>

::demo::

<ClockDemo />
