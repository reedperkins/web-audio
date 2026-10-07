---
layout: code
---

# A file is a buffer

```js
const response = await fetch('/samples/small-step.mp3')
const data = await response.arrayBuffer()
const buffer = await ctx.decodeAudioData(data)

const source = new AudioBufferSourceNode(ctx, { buffer })
source.connect(ctx.destination)
source.start()
```

::demo::

<BufferDemo />

---
layout: code
---

# The mic

```js
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
const mic = new MediaStreamAudioSourceNode(ctx, { mediaStream: stream })
mic.connect(analyser) // to see it, not to the speakers
const recorder = new MediaRecorder(stream)
recorder.ondataavailable = async (e) => {
  const data = await e.data.arrayBuffer()
  const buffer = await ctx.decodeAudioData(data)
}
recorder.start() // then recorder.stop()
```

::demo::

<MicDemo />

<style>
.slidev-layout {
  --slidev-code-font-size: 0.9rem;
}
</style>

---
layout: code
---

# Play it differently

```js
buffer.getChannelData(0).reverse()
const source = new AudioBufferSourceNode(ctx, { buffer, loop: true })
source.playbackRate.value = 1.5
source.detune.value = -1200
source.loopStart = 0.5
source.loopEnd = 1.25
source.connect(ctx.destination)
source.start(0, offset)
```

::aside::

<ClipPicker />

::demo::

<SamplerDemo />

<style>
/* Code and clip picker side by side, the demo full width under both. */
.slidev-layout {
  --slidev-code-font-size: 0.9rem;
}

.slidev-layout :deep(.code-aside) {
  grid-row: 1;
}

.slidev-layout :deep(.code-demo) {
  grid-column: 1 / -1;
}
</style>

---
layout: code
---

# Chop it into grains

Play 80 ms grains end to end. Speed is only where each one starts reading.

::demo::

<StretchDemo stage="chop" />

---
layout: code
---

# Fade the edges

Fade each grain in and out: the clicks go, but now the level pumps.

::demo::

<StretchDemo stage="fade" />

---
layout: code
---

# Overlap the grains

Each fades in as the last fades out, so the level holds. Now pitch is a knob too.

::demo::

<StretchDemo stage="overlap" />

---
layout: code
---

# Grains in code

```js
function grain(time, offset) {
  const source = new AudioBufferSourceNode(ctx, { buffer, detune: cents })
  const env = new GainNode(ctx, { gain: 0 })
  env.gain.setValueCurveAtTime(fade, time, GRAIN)
  source.connect(env).connect(ctx.destination)
  source.start(time, offset, GRAIN * 2 ** (cents / 1200))
}

// every GRAIN / 2: grain(time, pos), then pos += speed * GRAIN / 2
```

---
layout: code
---

# Sample pads

```js
const { sampleRate } = buffer
const from = Math.round(start * sampleRate)
const to = Math.round(end * sampleRate)
const pad = new AudioBuffer({ length: to - from, sampleRate })
pad.copyToChannel(buffer.getChannelData(0).subarray(from, to), 0)

function noteOn(note) {
  const semitones = note - 60 // C4 plays it as recorded
  playGrains(pad, ctx.destination, { ...settings, semitones })
}
```

::demo::

<PadsDemo />

<style>
/* With the on-screen keyboard open, the code makes way so the demo sits
   above it. */
.slidev-layout {
  --slidev-code-font-size: 0.75rem;
}

.slidev-layout:has(.keys-open) :deep(.code-main > :not(h1)) {
  display: none;
}
</style>
