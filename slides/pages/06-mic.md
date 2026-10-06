---
layout: code
demo: mic
demoLabel: 6a · Record and play back
---

# Other sources

```js {1-4|5-6|7-8|all}
// Backwards: reverse the samples in each channel
for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
  buffer.getChannelData(ch).reverse()
}
// Chipmunk: play it 1.5 times as fast
const source = new AudioBufferSourceNode(ctx, { buffer, playbackRate: 1.5 })
source.connect(ctx.destination)
source.start()
```

::aside::

<StepNote :at="0">A recording is an <code>AudioBuffer</code>: arrays of samples. Flip them.</StepNote>
<StepNote :at="1">A buffer source plays it back, faster or slower.</StepNote>
<StepNote :at="2">Then it's a source like any other.</StepNote>
<StepNote :at="3">Sound from a file or a mic goes into the same graph. The graph doesn't care where it came from.</StepNote>
