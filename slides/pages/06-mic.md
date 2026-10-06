---
layout: code
---

# A file is a buffer

```js {1-3|5-7|all}
const response = await fetch('/samples/small-step.mp3')
const data = await response.arrayBuffer()
const buffer = await ctx.decodeAudioData(data)

const source = new AudioBufferSourceNode(ctx, { buffer })
source.connect(ctx.destination)
source.start()
```

::aside::

<StepNote :at="0">Decoding turns an MP3 into an <code>AudioBuffer</code>: plain arrays of numbers between −1 and 1.</StepNote>
<StepNote :at="1">A buffer source plays it. It plays once; make a new one for each play.</StepNote>
<StepNote :at="2">The picture is the buffer: every sample, squeezed to fit the slide.</StepNote>

::demo::

<BufferDemo />

---
layout: code
---

# The mic

```js {1-3|4-9|all}
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

::aside::

<StepNote :at="0">Live, the mic is a stream: there's no future to read from, so you can't reverse it or speed it up.</StepNote>
<StepNote :at="1">Record it, and it's a file, then a buffer like any other.</StepNote>
<StepNote :at="2">The browser always asks before a page can listen.</StepNote>

::demo::

<MicDemo />

<style>
/* The demo full width under the code and notes. */
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

# Play it differently

```js {1|2|3-4|5-6|8|all}
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

```js {1-7|2|3-4|6|9|all}
function grain(time, offset) {
  const source = new AudioBufferSourceNode(ctx, { buffer, detune: cents })
  const env = new GainNode(ctx, { gain: 0 })
  env.gain.setValueCurveAtTime(fade, time, GRAIN)
  source.connect(env).connect(ctx.destination)
  source.start(time, offset, GRAIN * 2 ** (cents / 1200))
}

// every GRAIN / 2: grain(time, pos), then pos += speed * GRAIN / 2
```

::aside::

<StepNote :at="0">One grain: a source and a gain, used once.</StepNote>
<StepNote :at="1">Pitch is <code>detune</code>, in cents: +1200 is an octave.</StepNote>
<StepNote :at="2"><code>fade</code> is the window: a curve up to 1 and back, like Hann (<code>sin²</code>).</StepNote>
<StepNote :at="3">Higher pitch reads more buffer in the same 80 ms.</StepNote>
<StepNote :at="4">Speed is only how far <code>pos</code> moves between grains.</StepNote>

<style>
.slidev-layout {
  --slidev-code-font-size: 0.8rem;
}
</style>

---
layout: code
---

# Sample pads

```js {1-3|4-5|7-10|all}
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

::aside::

<StepNote :at="0">Markers are in seconds; a buffer counts sample frames.</StepNote>
<StepNote :at="1"><code>subarray</code> is only a view. <code>copyToChannel</code> copies it, so the pad keeps its sound.</StepNote>
<StepNote :at="2">One pad on every key. With grains, every note lasts as long; with <code>detune</code>, higher notes end sooner.</StepNote>

::demo::

<PadsDemo />

<style>
/* The demo full width under the code and notes. With the on-screen keyboard
   open, the code and notes make way so the demo sits above it. */
.slidev-layout {
  --slidev-code-font-size: 0.75rem;
}

.slidev-layout:has(.keys-open) :deep(.code-main > :not(h1)),
.slidev-layout:has(.keys-open) :deep(.code-aside) {
  display: none;
}

.slidev-layout :deep(.code-aside) {
  grid-row: 1;
  padding-top: 3.5rem;
}

.slidev-layout :deep(.code-demo) {
  grid-column: 1 / -1;
}
</style>
