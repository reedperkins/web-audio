# Talk Plan

**Talk:** Web Audio at Utah JS · up to 40 min · JS devs plus some non-technical folks
**Concept:** "Build the machine." The talk is one Slidev deck, and the demos run on the slides themselves. Each section explains one part of a synth, shows the code, and plays it right there. At the end the whole machine is drawn as an audio graph (the hub) on a slide, and I play it.

This file covers what the talk says and shows, plus the process the build follows. The task list is `SLIDES_PLAN.md`.

The old two-app plans (a separate demo app opened from the deck) are in `workbench/archive/two-app/`, and older single-app plans are in `workbench/archive/` (both gitignored). Both are for reference only. Don't build from them.

Status: DRAFT. `TODO` marks places where I need to decide something.

---

## The deck

- **One app (`slides/`):** a Slidev deck with the audio engine and every demo inside it. One `AudioContext` for the whole talk.
- **Demos live on the slides.** Each demo is a Vue component placed on the slide whose code it runs. It owns both the sound and a picture of what's happening (a timeline, a waveform, a signal chain), so the two can't drift apart. Small demos sit under the code or in the notes column; big ones (ADSR editor, polyphony, mic, hub) get their own slide.
- **One synth, built up over the talk.** From section 4 on, the slides share one instrument: its envelope, wave type and voices. Settings dialed in on one slide carry forward, and the finale plays the same synth. Presets give a quick reset if a drag goes wrong mid-talk.
- **Always playable from section 4 on.** MIDI and the on-screen keyboard always play the shared synth, so any slide can be played without wiring anything up.
- **On stage:** one window, the deck. I unlock audio with my first click on the cold-open slide. No window switching.
- **Only for me.** I'm the only one who runs it. No presenter mode, and slide code doesn't have to run in the browser console.

### Theme

`slides/theme/` holds the tokens; nothing else defines colors or fonts.

- **Contents:** `theme.css` (every color, font and size as CSS custom properties) and `fonts/` (woff2 files, loaded with `@font-face` through relative `url()`s, so Vite bundles them and the build stays offline).
- **Role names, not color names:** `--bg`, `--surface`, `--ink`, `--muted`, `--accent`, `--signal` (scope trace), `--wire`, `--font-display`, `--font-body`, `--font-mono`, plus type sizes. A theme change only changes values.
- **No colors or fonts anywhere else.** Components use the tokens, never hex codes or font names. Canvas code reads them with `getComputedStyle`; SVG uses `currentColor`.
- **Starting point:** placeholder tokens (system fonts, grays plus one accent). The wireframes in `workbench/wireframes/` (patch panel, schematic, chiptune) are the candidate directions. `TODO` Reed picks one.

### Demos by slide

| Section | Slide | Demo | Sound | Picture |
|---------|-------|------|-------|---------|
| 0 | Cold open | `SequencerDemo` | the loop starts on my first click (which also unlocks audio) | step grid plus tempo control, live and editable |
| 1 | What is Web Audio? | — | — | `AudioGraph` boxes and arrows |
| 2 | One beep | `BeepDemo` | one oscillator for 1 s | play button under the code |
| 2 | The audio clock | `ClockDemo` | four scheduled oscillators | timeline of the note start times, playhead following `ctx.currentTime` |
| 3 | Too loud | `ClipDemo` | four oscillators, no gain | four sines, their sum crossing ±1, and the clipped flat tops (drawn from the math) |
| 3 | Turn it down / AudioParams | `VolumeDemo` | oscillators → `GainNode` → out; on the LFO step a 2 Hz sine (× 0.05) into `gain` | signal chain osc → gain → out, with play button and a volume slider on the gain node (`setTargetAtTime`); on the LFO step an LFO node with an on/off checkbox above the gain node, and the slider follows the live gain |
| 4 | Click. | `ClickDemo` | an instant start/stop, and the same tone with a short ramp | zoomed waveform of the first few ms: a cliff vs. a ramp |
| 4 | Shape over time | `AdsrDemo` | plays a note when a handle or preset card is let go; hold the button or Enter to play | drag-and-drop ADSR editor with a playhead, plus a row of preset cards (A/D/S/R as bars); edits the shared synth's envelope |
| 4 | Scheduled gain | `AdsrDemo` (small) | play button | ADSR curve highlighting the segment that matches the current step |
| 5 | MIDI comes in | `MidiLog` | the shared synth | live list of incoming messages, bytes labeled |
| 5 | Numbers → pitch | `OctaveDemo` | the shared synth | `OctaveKeys` lights the pressed key and shows `mtof(n)` in Hz |
| 5 | One voice per key / Polyphony | `VoicesDemo` | the shared synth | one box per active voice, appearing on key down and fading on release |
| 5 | Wave types | `WaveDemo` | the shared synth; song buttons set wave + envelope and loop a melody through the sequencer | the synth as graph nodes (wave picker → ADSR → live scope) |
| 6 | A file is a buffer | `BufferDemo` | one decoded clip | the buffer's waveform with a playhead, plus its size |
| 6 | The mic | `MicDemo` | live mic, then a recording | scrolling live waveform; the recording's waveform once captured |
| 6 | Play it differently | `SamplerDemo` | any clip or the recording, through reverse / rate / detune / loop | big waveform that flips on reverse, with loop handles and a playhead moving at the playback rate |
| 6 | Pitch without speed ×3 (chop, fade, overlap) | `StretchDemo` (`stage`) | any clip through the grain engine, built up a slide at a time; plain on the last | the signal chain as nodes (clip picker, speed, then pitch and window picker, scope) and `StretchView`: the original and the stretched output, zoomable, with each grain's window, its drift from read to play, and the sounding grain |
| 6 | Grains in code | — | — | the `grain()` code with step notes |
| 6 | Sample pads | `PadsDemo` | regions copied onto pads, played from clicks, MIDI or the on-screen keys | the source waveform with selection markers, and the pads |
| 7 | What's next ×3 | `ClipButton` | a short clip from `public/` | statement slide plus a play button |
| 7 | One knob, a thousand oscillators | — | — | the swarm code, stepped |
| 7 | Chaos | `ChaosDemo` | keys play a detuned saw swarm (one `ConstantSourceNode` drives every oscillator's detune) or, toggled from a pad, a granular cloud of the take at the key's pitch; pads mangle the latest recording as grains; K1–K8 and the joystick bend it all, through a crusher and a limiter; a synced 4-track looper (pads' bank B, keys 1–4) prints it and plays it back | oscillator count, scope, and `MpkMini` mirroring the controller |
| 8 | Let's play it | `HubDemo` | the shared synth | the hub (see below) |

---

## Time budget

| # | Section | Min |
|---|---------|-----|
| 0 | Cold open | 1 |
| 1 | What is Web Audio? | 1.5 |
| 2 | First sound | 3 |
| 3 | Volume | 2.5 |
| 4 | Envelope | 3.5 |
| 5 | Keyboard | 4 |
| 6 | Other sources | 6 |
| 7 | What's next | 1.5 |
| 8 | Finale & close | 1 |
| | **Total** | **24** |

The talk can run up to 40 minutes, so there is room to grow. If something runs long, cut from section 6 or 7 first.

---

## The hub

- **Where:** the finale slide ("Let's play it"), full slide.
- **Layout:** layout A with icons from `designs/hub/` (frame H): Keyboard → Oscillator → Envelope → Volume → Speaker, with a scope tapped off the end. Mic is a second source that feeds the same chain. Three "?" nodes sit to the side.
- **No fog:** every node and wire is drawn at full strength from the start (see the rules in `designs/hub/README.md`).
- **Hover:** the node under the cursor and its wires are highlighted.
- **Click (optional):** jumps to that node's section in the deck.
- **"?" nodes:** drawn dashed, so they read as "not built today."
- **Live:** plays the shared synth from the MIDI keyboard or the on-screen keyboard. A pulse travels along the wires with each note.
- **Look:** rough.js with a fixed seed and Excalifont labels, to match the mockups. Bundle the font locally.

---

## Slide code

Code on slides is written to teach: short and plain, no imports, cleanup or error handling. The demo on the same slide runs that same code, so what's on screen is what plays. The one allowed difference: demos connect to their slide's output node instead of `ctx.destination`, so sound stops when I leave the slide. Shared pieces shown on slides (`noteOn`/`noteOff`, `Voice`, `mtof`) are the engine's real code.

---

## Sections

### 0. Cold open (about 1 min)

- **Demo (`SequencerDemo`):** a chiptune/retro loop. My first click starts it, which also unlocks audio. A small step sequencer with a few live controls (tempo, which notes play) that I change on the fly, to show it's a real system and not a recording.
- **Say:** "Everything you're hearing is being generated live in this browser tab. In 20 minutes we're going to build the pieces from nothing."
- **Needs:** a step grid, tempo control, and a scheduler that plans notes slightly ahead on the audio clock (`ctx.currentTime`), so tempo changes stay in time.
- `TODO` the loop itself: melody, bass, drums? How many tracks?
- `TODO` does the loop keep playing under the title slide, or stop when I move on?
- **Risk:** low. It doesn't depend on MIDI or the mic.

### 1. What is Web Audio? (about 1.5 min)

- **1a Title:** talk title, my name.
- **1b The idea:** two points, kept short.
  - Web Audio is a set of JS APIs for wiring up **audio graphs**: sources → processors → speakers.
  - The browser runs the graph on its own audio thread, separate from your JavaScript, and sends the result to your speakers.
- **Assets:** a simple boxes-and-arrows graphic. A static picture of the hub works.

### 2. First sound: Oscillator + Speaker (about 3 min)

- **2a One beep (`BeepDemo`):** the code, with a play button under it.
  ```js
  const osc = new OscillatorNode(ctx, { frequency: 440 })
  osc.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 1)
  ```
  - **Say:** "A source, a destination, and a wire. That's a whole audio graph."
- **2b The audio clock (`ClockDemo`):** a timeline of the four note start times, with a play button nearby and a playhead that follows the audio clock.
  ```js
  const now = ctx.currentTime
  notes.forEach((frequency, i) => {
    const osc = new OscillatorNode(ctx, { frequency })
    osc.connect(ctx.destination)
    osc.start(now + i * 0.1)
    osc.stop(now + i * 0.1 + 0.75)
  })
  ```
  - **Say:** "We hand the browser a schedule, and its audio clock plays it perfectly even if JavaScript is busy." Optional demo: freeze the main thread for 3 s and the timing still holds.

### 3. Volume (about 2.5 min)

- **3a The problem (`ClipDemo`):** a chord of four oscillators distorts. The picture shows the four waves, their sum going past the ±1 lines, and the flat tops where it clips. Play button nearby.
  - **Say:** "Each oscillator is full volume. Add four together and we go over the limit."
- **3b The fix (`VolumeDemo`):** put a `GainNode` in the chain. The picture is the signal chain osc → gain → out, with a play button and a volume slider on the gain node. The chord sounds clean.
  ```js
  const volume = new GainNode(ctx, { gain: 0.2 })
  osc.connect(volume).connect(ctx.destination)
  ```
- **3c A knob (`VolumeDemo`):** the same demo; the slider uses `setTargetAtTime`, so it moves smoothly without clicks.
  - **Say:** "Settings like `gain` aren't plain numbers. They're `AudioParam`s, which you can schedule and smooth over time."
- **3d An LFO (`VolumeDemo`, last step of the 3c slide):** the code morphs into a 2 Hz sine through a `GainNode` at 0.05, connected into `volume.gain`, with `setVolume(0.15)` setting the base. The gain swings between 0.1 and 0.2. An LFO node with a checkbox appears above the gain node, and the slider moves with the live gain.
  ```js
  const lfo = new OscillatorNode(ctx)
  lfo.frequency.value = 2
  const depth = new GainNode(ctx, { gain: 0.05 })
  setVolume(0.15)
  lfo.connect(depth).connect(volume.gain)
  lfo.start()
  ```
  - **Say:** "Connect a node into an `AudioParam` and its signal adds to the value. A slow sine wave turns the knob for you."
- **Note:** the master volume stays at 1.0 so the clipping is real. Loudness is set on the laptop or PA.

### 4. Envelope (about 3.5 min)

- **4a The click (`ClickDemo`):** a tone that starts and stops instantly makes an audible click; the same tone with a short ramp doesn't. A zoomed waveform shows the cliff vs. the ramp. (About 10 seconds.)
- **4b Shape over time (`AdsrDemo`):** a drag-and-drop ADSR editor. Each time you let go of a point it plays a note, and a playhead moves along the curve as it plays. It edits the shared synth's envelope.
  - **Say:** "What makes a piano sound different from an organ isn't only the tone. It's how the volume changes over time."
- **Presets (on the 4b slide, `AdsrPresets`):** the same oscillator, played through different envelope presets. A row of cards under the editor, each showing A, D and R as bars as long as the time and S as a bar as long as the level. Clicking a card plays it and loads it into the shared synth.

  | Preset | A | D | S | R | Feel |
  |--------|---|---|---|---|------|
  | Organ | 0.005 | 0 | 1.0 | 0.05 | on/off, like a switch |
  | Pluck | 0.005 | 0.3 | 0 | 0.2 | a plucked string |
  | Stab | 0.01 | 0.15 | 0.2 | 0.1 | a short brass/synth hit |
  | Percussive | 0.001 | 0.08 | 0 | 0.05 | a drum |
  | Pad | 0.8 | 0.5 | 0.7 | 1.5 | a slow swell |

  `TODO` tune these by ear. The numbers above are starting points.
- **Slide code** (the engine's real `noteOn`/`noteOff`; a small ADSR curve beside it highlights the segment for each step):
  ```js
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
  - **Say:** "An envelope is just a `GainNode` whose volume we schedule."
  - Note: `cancelAndHoldAtTime` works in Chrome but isn't supported in every browser yet (it's not Baseline). Fine for the talk.

### 5. Keyboard (about 4 min)

All of these play the shared synth.

- **5a MIDI comes in (`MidiLog`):** play the MIDI keyboard and show the last message on screen as it arrives, e.g. `[144, 60, 100]`: a table with each byte's bits, decimal value and meaning, under a "device connected" status line.
  ```js
  const midi = await navigator.requestMIDIAccess()
  midi.inputs.forEach((input) => {
    input.onmidimessage = (e) => console.log(e.data)
  })
  ```
  - **Say:** "Every key is just a number. Middle C is 60."
- **5b Numbers → pitch (`OctaveKeys` + `PitchGraph`):** the `mtof` one-liner. The octave picture (A3–A4, 220 → 440 Hz) lights the pressed key; beside it, the `mtof` curve shows the pressed note's frequency, with a Linear / Log switch that straightens the curve into a line.
  ```js
  const mtof = (note) => 440 * 2 ** ((note - 69) / 12)
  ```
  - **Say:** "Go up 12 keys and the frequency doubles. That's an octave. Math is music."
- **5c Polyphony (`VoicesDemo`):** each key creates its own oscillator + envelope "voice," so you can play chords. One box per active voice appears on key down and fades on release.
  ```js
  const voices = new Map()
  function noteOn(note) { voices.set(note, new Voice(mtof(note))) }
  function noteOff(note) { voices.get(note)?.release(); voices.delete(note) }
  ```
- **5d Wave types (`WaveDemo`):** sine, square, sawtooth, triangle. The synth drawn as its graph: the wave pictures pick the synth's wave, the ADSR editor sets the envelope, and a live scope shows the real shape.
  Songs on the same slide set the wave and envelope, then loop a melody through the sequencer: Zelda (square), Mountain King (sawtooth), Harry Potter (sine). Changes while a song plays are heard on the next notes.

- **Risk:** the MIDI device or permission fails → open the on-screen keyboard and keep going.

### 6. Other sources: files and the mic (about 6 min)

Every clip is vendored in `slides/public/samples/` (credits in `CREDITS.md` there), so the section runs offline. Clips: Apollo 11 "one small step" (speech), a CC0 drum loop, a Salamander piano C4 (CC BY, needs credit), and a backup "hello" recording for the mic. The buffers live in `audio/samples.ts`, shared by every slide in the section, so a mic recording made on 6b shows up in 6c's picker.

- **6a A file is a buffer (`BufferDemo`):** fetch and decode one clip, then play it. The picture is the `AudioBuffer` itself: its waveform, drawn from `getChannelData`, with a playhead, plus its size (channels, sample rate, sample count).
  ```js
  const response = await fetch('/samples/small-step.mp3')
  const data = await response.arrayBuffer()
  const buffer = await ctx.decodeAudioData(data)

  const source = new AudioBufferSourceNode(ctx, { buffer })
  source.connect(ctx.destination)
  source.start()
  ```
  - **Say:** "An MP3 decodes to plain arrays of numbers between −1 and 1. Six hundred thousand of them for this one."
- **6b The mic (`MicDemo`):** two strips, one above the other. **Live:** `getUserMedia` → `MediaStreamAudioSourceNode` → an analyser, drawn as a waveform scrolling by (`LiveWave`). **Recorded:** Record captures up to 5 s with `MediaRecorder`; `stop()` hands over one complete file, `decodeAudioData` turns it into an `AudioBuffer`, and it's drawn and playable below. The recording (mixed to mono) joins the clip list as "Your recording" and is picked, so 6c opens on it.
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
  - **Say:** "Live, there's no future to read from: you can't reverse it or speed it up. Record it, and it's a buffer like any other."
  - The mic never reaches the speakers (no monitoring), so there's no feedback on stage. It turns on only from the "Turn on mic" button, whose hint says Chrome will ask first, and it's switched off (tracks stopped) on leaving the slide.
  - **Risk:** the mic or permission fails → the slide says so, and the "hello" backup clip takes the recording's place below and on 6c.
- **6c Play it differently (`SamplerDemo`):** the clip picker (`ClipPicker`, including the recording) sits beside the code; under both, a big waveform and one row of controls. Each control changes something you can see:
  - **Reverse:** reverses the samples in the buffer; the waveform flips, and the loop flips with it so it stays on the same sound. A playing clip carries on from the mirrored spot.
  - **`playbackRate`:** the playhead speeds up or slows down, and the pitch moves with it. Changes apply live, without restarting.
  - **`detune`:** the same, in cents (−1200 is half speed).
  - **`loop`, `loopStart`, `loopEnd`:** handles dragged on the waveform, live while it plays. With looping off, the region shows faintly.
  - **`start(when, offset)`:** click the waveform to play from there. (With looping on, a click past the loop starts at `loopStart`: per the spec, `start()` past `loopEnd` would play on to the end without looping.)
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
  - The playhead follows the spec's playback algorithm (`audio/playhead.ts`), since the node doesn't report its position.
  - **Say:** "Sound from a file or a mic goes into the same graph. The graph doesn't care where it came from."
- **6d Pitch without speed, in three slides (`StretchDemo` with `stage`):** answers the question 6c raises: playback rate moves pitch and speed together, so how do apps change one without the other? **Grains:** pitch lives inside a short slice of sound, speed is how fast you move through the slices. Each slide fixes the problem the last one leaves, so the audience hears each problem before its fix. No code; a one-line subtitle on each, then the same layout:
  - **The signal chain as nodes**, controls inside, like 5d: `AudioBuffer` (clip picker) → `AudioBufferSourceNode` ("a new one for every grain") → `GainNode` (the window) → `destination` (live scope).
  - **`StretchView`:** two lanes on one time scale, labelled on the left. Bottom: the original. Top: the output (worked out from the same grains, so it redraws as you drag). Every grain's window is a filled bump (a gain from 0 to 1): over what it reads below, where it plays above, with a line joining the two starts. Stretched out, each grain falls a little further behind the last, so the lines lean more and more: the drift. The lane labels give the spacing ("grains 20 ms apart" below, "40 ms apart" above). A dashed line is the windows added up: the output's total gain. The sounding grain is highlighted in both lanes with lines at its start and stop, and a band between the lanes from what it reads to where it plays. **Zoom** (all / 2 s / 0.5 s) zooms both lanes together, centred on the playhead while playing; click to move when stopped. **Drag sideways to stretch** (it sets speed). Where grains overlap in the output (crossfading) is yellow; the original's label says how many grains read each bit of it ("each bit read 4×" at 0.5×: the same audio played again). A **lanes / stacked** switch redraws the grains one per row: a dashed outline over what each reads, a filled window where it plays, and an arrow between them that grows down the rows (the drift); the playheads cross 4 outlines but only 2 filled windows. **Play pauses** where it is; while paused, **‹ grain / grain ›** step one grain at a time, lighting it up in both lanes and playing just that grain.
  1. **Chop it into grains** (`stage="chop"`): 80 ms grains end to end, no fade (rectangle), speed only. At 0.5× the bottom-lane grains bunch up while the top lane stays evenly spaced: slower, same pitch… plus a buzz, a click at every seam.
     - **Say:** "Pitch lives inside a grain. Speed is how far apart grains start. But hear that buzz?"
  2. **Fade the edges** (`stage="fade"`): still end to end, each faded with Hann. The clicks go, but the level pumps 12.5 times a second; the dashed sum drops to zero between grains.
     - **Say:** "Fixed the clicks, broke the volume."
  3. **Overlap the grains** (`stage="overlap"`): overlapping by half, each fading in as the last fades out; the dashed sum goes flat. Now the pitch slider, the window picker and the **preserve pitch** toggle (off: one plain looping source, GainNode dimmed) appear. The windows are scaled so overlapping grains never add up past 1: they differ in their edges, not their loudness. Rectangle clicks; sine ripples in level (the dashed line scallops); triangle and Hann are smooth.
     - **Say:** "Pitch is how fast each grain plays. Speed is how far apart they start. That slight warble is the grains' waves not lining up where they overlap; real apps line them up more cleverly."
- **6d′ Grains in code:** the `grain()` function (the engine's real code), with step notes: one grain is a source and a gain; pitch is `detune` in cents; `fade` is the window; higher pitch reads more buffer in the same 80 ms; speed is only how far the read position moves.
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
- **6e Sample pads (`PadsDemo`):** drag across a clip to mark a region, then "→ pad" copies it onto the selected pad of four, in a 2×2 grid beside the clip (a new buffer, so it keeps its sound whatever happens to the clip). Every key (MIDI or on-screen) plays the selected pad chromatically, C4 as recorded, sounding while held; while the selected pad is empty the keys play the marked region straight from the clip. Clicking a pad selects it and plays it at C4. **detune** (a plain source: higher is shorter) or **grains** (6d's engine, played once: every key as long). One labelled playhead per held note, so the lengths show. With the on-screen keyboard open, the code and notes hide so the demo sits above it.
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
  - **Say:** "Chop a word, put it on a key, play it as a melody: same length on every note. This is the sampler."

- **Optional:** the toy 4-track recorder, only if there's time to build it.

### 7. What's next (about 1.5 min)

- **Demo (`ClipButton`):** one statement slide per idea, each with a play button for a short sound clip.
  - **Vocoder:** your voice + the synth we just built. (It ties back to sections 5 and 6.)
  - **Granular synthesis:** chopping sound into tiny grains and scattering them.
  - **Game of Life:** music from emergent behavior.
- `TODO` decide which of these get clips, and whether they're live or pre-recorded.
- **Slides:** prior art: Pure Data, Max/MSP, noisecraft.app.

### 8. Finale & close (about 1 min)

- **Demo (`HubDemo`):** the hub slide. Play the Zelda theme live on the machine we just built.
- **Slides:** a link or QR code to the site, plus thanks.
- `TODO` closing line.

---

## Self-guided mode (for later)

For people viewing the deck on their own after the talk:

- **No MIDI keyboard:** the on-screen keyboard is the main way to play.
- **Speaking notes as text:** a short caption on each slide that stands in for what I'd say out loud.
- **Mic:** explain why the mic permission is being requested before asking.
- **Hosting:** `TODO` decide where it lives (GitHub Pages, Netlify, etc.).

---

## How agents work through the plan

Agents write the code; Reed reviews and revises.

1. **Pick the task.** Take the first unchecked task in the lowest tier of `SLIDES_PLAN.md`. Don't start a task whose dependencies aren't checked.
2. **Read first.** Read the task, the matching section of this file, `slides/CLAUDE.md`, and the docs the task lists.
3. **One task per session.** Keep the change small enough to review in one sitting. If a task turns out bigger than expected, stop and propose splitting it.
4. **Verify** using the task's "Done when" and the plan's verification recipes.
5. **Don't commit.** Leave the changes for Reed to review, and end with a short report:
   - **Built:** what changed, and which files
   - **Verified:** what you checked and how
   - **Listen for:** what Reed should hear when trying it (audio tasks)
   - **Placeholders:** anything left rough on purpose, so it goes in the [refinement backlog](#refinement-backlog)
   - **Commit message:** one line, imperative, no attribution
   - **Open questions:** anything you guessed at
6. **After Reed approves:** check the task's box and add a line to the plan's progress log.

### Tiers

| Tier | Meaning |
|------|---------|
| **Must** | The talk doesn't work without these. |
| **Should** | Makes the talk noticeably better. |
| **Could** | Polish. |

Finish Must before starting Should. If time runs short, stop at the end of a tier and go to [Freeze and rehearse](#freeze-and-rehearse). That section isn't a tier: do it no matter how far the build got.

### Placeholders

Look, feel and content can start as placeholders: a basic working version that Reed refines later. Behavior and engine code can't: it has to be solid in the first version. Tasks marked **Placeholder OK** say what can stay rough.

**Fine as placeholders:**

- **Visual and interactive design:** hub layout, icons, hover look and pulse; ADSR editor handles and curve; demo pictures (timeline, wave sum, signal chain, voice boxes); scope colors; on-screen keyboard; play buttons and sliders; slide layouts; palette and fonts (system font, grays plus one accent color until decided); small visuals (raw-MIDI display, octave visual); sequencer UI.
- **Musical content:** envelope preset values (starting numbers above), song presets (Zelda only, as a rough riff), the cold-open loop (a simple 8-step melody plus bass), audio clips (silence or a generated tone, clearly labeled).
- **Words:** all on-screen text, drafted from this file. Reed rewrites it in Reed's own voice. Slide code must match what the demo runs, but its readability gets refined later.
- **QR code and URL:** until hosting is decided.

**Never placeholders:**

- The audio engine and slide lifecycle: one context, sound stops when a slide is left
- Envelope math: no clicks or jumps, correct release mid-attack
- Voice cleanup: no leftover voices
- MIDI parsing: velocity-0 note-offs, hot-plugging
- Sequencer timing: scheduling ahead on the audio clock
- Controls that never steal slide navigation (focus)
- The offline build and slide navigation

**Rules:**

1. **Make it work, keep it plain.** Functional and readable, but no polish passes and no design decisions made on Reed's behalf.
2. **Keep a stable interface.** A component's props and events are its contract (e.g. `<AdsrEditor v-model="env">`), so refining the look never touches the engine.
3. **Keep tunables in one place.** Preset values, colors, sizes and timings live in one data or config spot (e.g. `presets.ts`, CSS variables).
4. **Tag it.** Add a `PLACEHOLDER(refine): <what's rough>` comment at each placeholder, so `grep -rn "PLACEHOLDER(refine)" slides` lists them all.
5. **Report it.** List the placeholders in the task report, and add each one to the backlog below.

---

## Refinement backlog

Placeholders to refine with Reed, not by an agent alone. `grep -rn "PLACEHOLDER(refine)" slides --exclude-dir=node_modules` should match this list.

- [ ] Hub: layout, icons, hover look, pulse
- [ ] ADSR editor: handle feel, curve drawing, labels
- [ ] Envelope preset values (tune by ear)
- [ ] Song presets and melodies
- [ ] Cold-open loop and sequencer UI
- [ ] Demo pictures: timeline, wave sum, signal chain, click zoom, voice boxes
- [ ] Play buttons and sliders
- [ ] Scope look
- [ ] On-screen keyboard look
- [ ] MIDI status look
- [ ] Slide layouts: type scale, spacing, proportions
- [ ] On-screen text
- [ ] Slide code readability on a projector
- [ ] Small visuals: raw-MIDI display, octave visual
- [ ] Audio clips: "what's next" clips, backup mic clip
- [ ] Closing URL and QR code
- [ ] Sample pads: pad look and layout, hit level
- [ ] Chaos slide: levels, knob ranges and start positions, grain limits, layout, MPK mini look

---

## Assets

- [ ] Hub icons: Keyboard, Oscillator, Envelope, Volume, Speaker, Mic, Scope, "?" (see `designs/hub/`)
- [ ] Theme: palette, fonts and type sizes in the theme folder (see [Theme](#theme))
- [ ] Envelope preset values (tuned)
- [ ] Song presets + the melodies to play
- [ ] Sound clips for section 7
- [ ] Backup mic clip
- [ ] Backup screen recordings of each demo
- [ ] QR code / URL for the closing slide

---

## Freeze and rehearse

Do this no matter how far the build got. Plan for at least two days before the talk.

- [ ] **Freeze:** no new features from here; only fixes.
- [ ] **No placeholders left in the talk path:** every `PLACEHOLDER(refine)` tag used in the talk is either refined or accepted as-is.
- [ ] **Full run-through from the built deck with Wi-Fi off.** Note anything that misbehaves.
- [ ] **Time it** against the budget above. Cut from the latest tier first.
- [ ] **Clicker check:** the remote advances every slide, including right after using a demo's controls.
- [ ] **Backup recordings:** a short screen recording of each demo, in case something breaks on stage.
- [ ] **Venue check:** projector resolution, speakers, mic, MIDI keyboard, and the laptop's audio output and volume (the master gain is 1.0).
- [ ] **Day-of checklist:** laptop charged, notifications off, browser zoom at 100%, dev tools closed, deck open on the cold-open slide, MIDI connected and mic permission granted.
