# Slides Plan

The task list for the deck in `slides/`, which holds the slides, the audio engine and every demo. Agents write the code; Reed reviews and revises.

- **What each slide says and plays:** `TALK_PLAN.md` (sections, slide code, "Demos by slide", "Say:" lines)
- **How to work through this plan:** `TALK_PLAN.md` → "How agents work through the plan"
- **Rules for writing code:** the root `CLAUDE.md` and `slides/CLAUDE.md`

The two-app version of this plan, and the demo app's plan it replaced, are in `workbench/archive/two-app/` (gitignored).

---

## Tech decisions

- **Stack:** Slidev in `slides/`, with its own `package.json`. Vue components with Composition API and `<script setup>`, TypeScript.
- **What Slidev gives us:** code stepping (```` ```js {1|2-3|all} ````), Magic Move (```` ````md magic-move ````) for code changing between steps, layouts with named slots, a scaling 16:9 stage, and `o` overview / `g` goto.
- **Slide code:** inline fenced code blocks, written to teach (see `TALK_PLAN.md` → "Slide code"). It describes what the demo does; the engine doesn't have to run it.
- **Sections:** `slides.md` holds the headmatter plus one `src:` import per section in `pages/`.
- **Theme:** `theme/` holds the tokens (see `TALK_PLAN.md` → "Theme"). `style.css` imports it and maps the tokens onto Slidev's own CSS variables. Code highlighting is set in the Shiki config (`setup/shiki.ts`).
- **No presenter mode, no console use.** Reed is the only one running the deck.

### Folders

- `audio/`: the engine and plain audio modules (`audio.ts`, `useDemo.ts`, `envelope.ts`, `synth.ts`, `mtof.ts`, `input.ts`, `sequencer.ts`, `presets.ts`). No Vue components here.
- `components/`: building blocks with no audio inside (`PlayButton`, `Slider`, `Timeline`, `WaveSum`, `SignalChain`, `Scope`, `AdsrEditor`, `Keyboard`, …) and one demo component per slide (`BeepDemo`, `ClockDemo`, …), which combine the engine and the building blocks. Slidev auto-imports everything here.
- `layouts/`, `pages/`, `public/`, `setup/`, `theme/`: as now.

### The audio engine

One `AudioContext` for the whole deck, created once in `audio/audio.ts`: `master` gain (1.0) → `analyser` → `destination`. Loudness is set on the laptop or PA, so the clipping demo actually clips. Audio nodes stay out of Vue's deep reactivity (`shallowRef` / `markRaw`).

- **Unlocking:** Chrome starts the context suspended. Every play handler awaits `unlock()` (which calls `ctx.resume()`) before scheduling. My first click on the cold-open slide does this.
- **Dev global:** in dev mode only (`import.meta.env.DEV`), expose `globalThis.__talkAudio` (context, master, analyser) for the signal check.

### The `useDemo()` contract

Every demo component uses `useDemo()` for its lifecycle:

```ts
const { ctx, out } = useDemo({
  enter() { /* start listeners, anything that should run while the slide is showing */ },
  leave() { /* stop sound, remove listeners */ },
})
```

- `enter` and `leave` run on Slidev's slide enter/leave hooks, not on mount/unmount: Slidev mounts slides before you reach them and keeps them mounted after you leave. Check sli.dev for the current hook names.
- `out` is a per-demo `GainNode` connected to `master`. Demos connect to `out`, never straight to `master` or `ctx.destination`. On leave, `out` fades to 0 over about 20 ms and is disconnected (and rebuilt on the next enter), so anything still sounding stops even if the demo's own cleanup misses it.
- A demo can opt out of the fade on leave (`keepPlaying: true`) for the cold-open loop, if Reed wants it under the title slide.
- Also provides a `noFocus` helper so buttons and sliders don't keep focus after a pointer click.

### The shared synth

From section 4 on, the slides share one instrument (`audio/synth.ts`):

- Reactive settings: `wave`, `env` (A/D/S/R) and `filter` (cutoff, resonance, envelope amount). The ADSR editor, presets, wave picker, filter controls and instrument presets all edit these.
- Each voice is osc → lowpass filter → amp. The filter starts wide open (amount 0), so it can't be heard until 5e changes it.
- A `voices` map with `noteOn(note, velocity)` / `noteOff(note)`. The slides show teaching versions of `Voice` and `noteOn`/`noteOff`; the engine's can differ.
- It plays into the current slide's `out`, so leaving a slide still silences held notes.
- `audio/input.ts`: MIDI and the on-screen keyboard, always listening, always playing the synth. A reactive list of recent MIDI messages feeds the raw-MIDI slide. No QWERTY input: Slidev uses letter keys as shortcuts.

### Gotchas

1. **Slides mount early and stay mounted.** Never make sound or start timers on mount. Sound starts from a click or from `enter`. The overview (`o`) also renders every slide as a thumbnail.
2. **Focused controls block navigation.** Slidev turns off its shortcuts while an `<a>`, `<button>` or `<input>` has focus, and a focused button gets pressed again by Space. Use `noFocus` on every control, and test with the clicker.
3. **Going backward replays steps.** Anything tied to steps depends on the current step number, never on each click.
4. **Markdown separators can misread.** A slide's content can be read as the next slide's frontmatter. Keep heavy slides in components, and sections in their own files with `src:`.
5. **Canvas and SVG don't inherit CSS.** Canvas reads theme tokens with `getComputedStyle` on mount; SVG uses `currentColor` with `color: var(--ink)` set in CSS.
6. **One output path.** Everything goes through `out` → `master` → `analyser`, or the scope and the signal check won't see it.
7. **Permissions are per origin.** MIDI and mic permissions granted on the dev server don't carry over to the preview server. Grant them again when rehearsing from the build.

### Agent tools

Slidev includes an MCP server, configured in `.mcp.json`:

- **Tools:** `slidev-get-info`, `slidev-list-slides`, `slidev-get-slide`, `slidev-insert-slide`, `slidev-update-slide`, `slidev-move-slide`, `slidev-remove-slide`, and `slidev-goto-slide`, which moves every connected browser to a slide (pair it with a browser tool for screenshots).
- **CLI:** `slidev` (dev server), `slidev build` (static site), `slidev format` (tidy the markdown).

---

## Verification recipes

An agent can't hear audio, so every audio task has two checks: an automated one by the agent, and a short listening check by Reed.

- **Build:** `npm --prefix slides run build` passes with no new errors or warnings.
- **Visual:** with the dev server running, open the slide (`slidev-goto-slide`, or `http://localhost:3030/#/<n>`), take a screenshot, and check the console for errors.
- **Signal check:** after triggering a demo (clicks from browser automation count as user gestures), read `__talkAudio.analyser` with `getFloatTimeDomainData` and confirm the RMS is above silence. Also check it falls back to silence after the sound should have stopped.
- **Render check:** for audio functions (envelopes, scheduling, `mtof`), import the module in the dev-server page and render into an `OfflineAudioContext`. Then assert on the samples, e.g. "the peak is reached at the attack time" or "no sample jumps by more than X at note-off." No test framework needed.
- **Slide-leave check:** start a sound, go to the next slide, and confirm the signal check goes silent.
- **Navigation check:** click every control on the slide, then press → and confirm the deck advances.
- **Offline check:** serve the build, open slide 1 and wait a few seconds (Slidev fetches each slide's code after load, and section 6 preloads its clips), then turn on network emulation "Offline" and step through the deck. Chrome's Offline mode blocks localhost too, so don't reload while it's on. Separately, confirm no request leaves `localhost`.

---

## Phase 1: Scaffold (Must)

### [x] 1.1 Install Slidev in `slides/`
- **Goal:** an empty deck that runs.
- **Steps:** create `slides/package.json` with `@slidev/cli` and `@slidev/theme-default`, and scripts `dev` (`slidev`), `build` (`slidev build`), `format` (`slidev format`). Create `slides.md` with a title slide. Install manually; the interactive `npm init slidev` doesn't suit an agent.
- **Done when:** `npm --prefix slides run dev` serves the deck, and the build passes.
- **Commit:** "Scaffold Slidev deck"

### [x] 1.2 Offline config and preview
- **Depends on:** 1.1
- **Goal:** the deck build makes zero network requests, and one command serves it for rehearsal.
- **Steps:** headmatter with `routerMode: hash`, `fonts: { provider: none }`, a local favicon, a pinned `colorSchema`, and unused features turned off (`drawings`, `record`, `monaco`, `contextMenu`, `presenter`, …; check sli.dev for current names). Add a `preview` script that serves `dist/`.
- **Done when:** `npm --prefix slides run preview` serves the build; the offline check passes; searching `dist/` for `https://` finds only XML namespaces and comments.
- **Commit:** "Configure deck for offline use"

### [x] 1.3 Point the Slidev MCP server at `slides/`
- **Depends on:** 1.1
- **Goal:** agents can use the `slidev` MCP tools.
- **Steps:** the `slidev` entry in `.mcp.json` runs the Slidev installed in `slides/` against `slides/slides.md`. Ask Reed to restart Claude Code, then call `slidev-get-info` and `slidev-list-slides`. With the dev server running, confirm `slidev-goto-slide` moves the browser.
- **Done when:** all three tools work.
- **Commit:** "Point Slidev MCP server at slides folder"

### [x] 1.4 Section skeleton
- **Depends on:** 1.1
- **Goal:** the whole talk exists as placeholder slides, in order.
- **Steps:** `pages/00-cold-open.md` through `pages/08-close.md`, one per section in `TALK_PLAN.md`, each pulled into `slides.md` with `src:`.
- **Done when:** the overview shows every planned slide in order, and `slidev-list-slides` matches `TALK_PLAN.md`.
- **Commit:** "Add section skeleton"

---

## Phase 2: Foundations (Must)

### [x] 2.1 Layouts
- **Depends on:** 1.1
- **Goal:** the `statement` and `code` layouts, in plain styling. The `code` layout has a `::demo::` slot that renders under the code, alongside the existing `::aside::` notes column.
- **Placeholder OK:** type scale, spacing, proportions. Both layouts and their slots must exist.
- **Steps:** Vue components in `layouts/` with named slots. Readable from the back of a room: large type, code at a size where about 12 lines fill the code area. Colors and fonts only from theme tokens.
- **Done when:** a test slide in each layout, including one using `::demo::`, screenshots correctly.
- **Commit:** "Add slide layouts"

### [x] 2.2 Theme
- **Depends on:** 1.1
- **Goal:** `theme/` as described in `TALK_PLAN.md` → "Theme", loaded through `style.css`, with Slidev's own variables mapped to the tokens.
- **Placeholder OK:** the token values and the Shiki theme. The token names must match the list in `TALK_PLAN.md`.
- **Done when:** changing `--accent` in `theme.css` changes the slides; no hex colors or font names in the deck outside `theme/` and the Shiki config.
- **Commit:** "Add theme tokens to deck"

### [x] 2.3 Code stepping and `<StepNote>`
- **Depends on:** 2.1
- **Docs:** sli.dev "Line highlighting", Magic Move, click animations
- **Goal:** stepped highlights, a Magic Move step, and per-line notes.
- **Placeholder OK:** note text and styling. Stepping must keep code and notes in sync, including going backward.
- **Done when:** stepping forward and back moves the highlight and the notes together.
- **Commit:** "Add code stepping and step notes"

### [x] 2.4 Audio engine and `useDemo()`
- **Depends on:** 1.1
- **Docs:** MDN `AudioContext`, `resume()`, `GainNode`, `AnalyserNode`, autoplay policy; sli.dev slide hooks
- **Goal:** `audio/audio.ts` as in [The audio engine](#the-audio-engine) and `audio/useDemo.ts` as in [The `useDemo()` contract](#the-usedemo-contract). Build on the prototype in `audio/audio.ts` (currently master at 0.3, no analyser).
- **Done when:** importing the module twice gives the same context; the dev global exists in dev and not in the build; a probe demo logs enter/leave in the right order while navigating, and doesn't log enter for a neighbouring slide that's only preloaded; the slide-leave check passes for a demo whose `leave` does nothing.
- **Commit:** "Add audio engine and useDemo"

### [x] 2.5 Demo building blocks: `PlayButton` and `Slider`
- **Depends on:** 2.4
- **Goal:** `PlayButton` (generalized from the prototype `BeepButton`: emits `play`, shows a playing state) and `Slider` (`v-model`), both using `noFocus`.
- **Placeholder OK:** their look.
- **Done when:** the navigation check passes on a test slide with both.
- **Commit:** "Add play button and slider"

### [x] 2.6 Remove the demo-app links
- **Depends on:** 2.1
- **Goal:** no trace of the separate demo app in the deck.
- **Steps:** delete `components/DemoLink.vue`, the `demo`/`demoLabel` props from `layouts/code.vue`, and the `demo:`/`demoLabel:` frontmatter on every slide.
- **Done when:** `grep -rn "DemoLink\|demoLabel\|demo:" slides --exclude-dir=node_modules` finds nothing; the build passes.
- **Commit:** "Remove demo app links"

---

## Phase 3: Sections (Must)

Each slide's content and demo are in `TALK_PLAN.md` ("Demos by slide" and the section); follow them. Every task: slides use the layouts, code is inline, each demo uses `useDemo()` and plays the slide's code, and the navigation check passes.

**Placeholder OK for all:** on-screen text, how the code reads, and the look of every demo picture. Sound and lifecycle must be solid.

### [x] 3.1 Section 1: What is Web Audio?
- **Depends on:** 2.1
- **Goal:** 1a title, 1b the two points with a boxes-and-arrows graphic.
- **Done when:** screenshots look right.
- **Commit:** "Add intro section"

### [x] 3.2 Section 2: First sound
- **Depends on:** 2.3, 2.5
- **Docs:** MDN `OscillatorNode`, `AudioScheduledSourceNode.start()` / `stop()`, `currentTime`
- **Goal:** 2a `BeepDemo` (play button under the code; replaces the prototype `BeepButton`) and 2b `ClockDemo` with a `Timeline` of the four start times and a playhead that follows `ctx.currentTime`.
- **Done when:** screenshots (2b mid-arpeggio shows the playhead partway); signal check after each trigger.
- **Listen for:** a clean 1-second tone; an even four-note arpeggio.
- **Commit:** "Add first sound demos"

### [x] 3.3 Section 3: Volume
- **Depends on:** 3.2
- **Docs:** MDN `GainNode`, `AudioParam.setTargetAtTime`
- **Goal:** 3a `ClipDemo` with `WaveSum` (four sines, their sum past ±1, clipped flat tops, drawn from the math); 3b and 3c `VolumeDemo` with `SignalChain` (osc → gain → out), a play button and a volume `Slider` using `setTargetAtTime`; 3d an LFO step on the 3c slide (`lfoAt` prop): an LFO node with a checkbox above the gain node (`SignalChain`'s `<key>-above` slot), and the slider shows the live gain.
- **Done when:** screenshots; with the chord playing, the analyser shows samples beyond ±1 in 3a and within ±1 in 3b; on 3d the level swings at 2 Hz between gain 0.1 and 0.2 and holds steady when the checkbox is off.
- **Listen for:** obvious distortion in 3a, a clean chord in 3b; no zipper noise on the slider.
- **Commit:** "Add volume demos"

### [ ] 3.4 Envelope engine and the click
- **Depends on:** 3.2
- **Docs:** MDN `setValueAtTime`, `linearRampToValueAtTime`, `cancelScheduledValues`, `cancelAndHoldAtTime` (not Baseline; fine for Chrome)
- **Goal:** `audio/envelope.ts` with the slide's `noteOn` / `noteOff`, and 4a `ClickDemo` (instant vs. ramped tone, with a zoomed waveform of each).
- **Not a placeholder:** the envelope math.
- **Done when:** render check: peak at the attack time, settles at sustain, reaches zero after release, and releasing mid-attack causes no jump.
- **Listen for:** a click without the ramp; none with it.
- **Commit:** "Add envelope engine and click demo"
- **Status:** `audio/envelope.ts` exists (`env`, `noteOn`/`noteOff`, `envelopeAt`, the time scale). Left: `ClickDemo` and the render check.

### [ ] 3.5 Shared synth
- **Depends on:** 3.4
- **Docs:** MDN `AudioScheduledSourceNode` `ended` event, `AudioNode.disconnect()`
- **Goal:** `audio/mtof.ts` and `audio/synth.ts` as in [The shared synth](#the-shared-synth), with the slide's `Voice` class, and cleanup after release.
- **Not a placeholder:** voice lifecycle and cleanup.
- **Done when:** render check of `mtof` (69 → 440, 81 → 880); playing and releasing 50 notes leaves no voices behind; leaving a slide with notes held silences them.
- **Listen for:** chords sound clean; held notes don't cut off when others are released.
- **Commit:** "Add shared synth"
- **Status:** `audio/synth.ts` built (slide's `Voice`, `keyDown`/`keyUp`, `releaseAll`, subscribed with `onNote`). Silent until a slide calls `playInto(out)`; only 5c does so far. Left: playing on every slide from section 4 on, `wave`, and the 50-note check.

### [ ] 3.6 ADSR editor and presets
- **Depends on:** 3.5
- **Goal:** `AdsrEditor` (`v-model` on the synth's `env`; plays a note when a point is let go), 4b `AdsrDemo` (a hold-to-play button and the Enter key play a note through the envelope: key down = `noteOn`, key up = `noteOff`), the small curve on the code slide that highlights the segment for the current step, and the preset cards on the 4b slide (`AdsrPresets`; clicking one plays and loads a preset from `audio/presets.ts`).
- **Placeholder OK:** handle feel, curve drawing, labels, preset values. The `v-model` contract and play-on-release must work.
- **Done when:** a screenshot after a simulated drag shows the new shape, and the next note's envelope matches it.
- **Listen for:** each preset sounds clearly different (organ, pluck, stab, percussive, pad).
- **Commit:** "Add ADSR editor and presets"
- **Status:** editor, `AdsrDemo` (button + Enter) and `AdsrPresets` built. `env` lives in `audio/envelope.ts` until 3.5 adds `synth.ts`. Left: the small step-highlighting curve on the code slide, and the "next note matches" check done by measuring the note (so far only through the playhead and labels).

### [ ] 3.7 Input: MIDI and the on-screen keyboard
- **Depends on:** 3.5
- **Docs:** MDN Web MIDI API, `requestMIDIAccess()`, `midimessage`, `MIDIMessageEvent.data`, `statechange`
- **Goal:** `audio/input.ts` (note on/off including velocity-0 note-offs, hot-plugging, a reactive recent-messages list), a small MIDI status indicator, and an on-screen `Keyboard` available on every slide from section 4 on.
- **Placeholder OK:** status indicator and keyboard look. MIDI parsing must be solid.
- **Done when:** with no device, the indicator says so and nothing errors; a simulated message (call the handler directly) plays a note (signal check); the on-screen keyboard plays notes and passes the navigation check.
- **Listen for (with the real keyboard):** no noticeable delay; plugging in mid-talk works.
- **Commit:** "Add MIDI and on-screen keyboard input"
- **Status:** built ahead of 3.5: `audio/input.ts` (`receive`, velocity-0 note-offs, hot-plugging, held notes, `onNote` listeners for the synth), `MidiStatus`, `Keyboard`, and `KeyboardDrawer` (a pull tab in `global-top.vue`, shown from the first slide with `keyboard: true` in its frontmatter; while open it counts as a connected input, and closing it releases its notes). Left: the synth subscribing with `onNote`, then the signal checks.

### [ ] 3.8 Section 5: Keyboard demos
- **Depends on:** 3.6, 3.7
- **Goal:** 5a `MidiLog`, 5b `OctaveDemo`, 5c `VoicesDemo`, 5d `WaveDemo` (with a live `Scope` from the analyser, and the song presets, Zelda first).
- **Placeholder OK:** every picture, the song presets and melodies.
- **Done when:** screenshots after simulated notes show each picture updating; the scope shows four clearly different shapes in 5d.
- **Listen for:** the Zelda preset sounds recognizably "8-bit."
- **Commit:** "Add keyboard demos"
- **Status:** 5a `MidiLog` built (status line plus a table of the last message: bits, decimal and meaning per byte). 5b has `PitchGraph` (the `mtof` curve, notes 33–93, dots on each A so the labels double exactly (110 … 1760), live dot for held or hovered notes, Linear / Log switch that animates between the two) beside `OctaveKeys`, which is now the shared `Keyboard` (A3–A4, held notes light up, playable). `audio/mtof.ts` exists. 5c `VoicesDemo` built: chord buttons (a reharmonized Silent Night from `progression` in `audio/presets.ts`; a click holds 0.7 s, common tones held between chords), a Cycle button (one chord a second, legato, cut short when stopped) and a keyboard under the code, `VoiceList` (one box per voice, fading over the release) in the aside.

### [ ] 3.9 Section 8: Hub and close
- **Depends on:** 3.7
- **Goal:** `HubDemo` on the finale slide (the graph from `TALK_PLAN.md` → "The hub", with hover highlight, playing the shared synth), and the closing slide with the link and a QR code that works offline.
- **Placeholder OK:** everything visual about the hub (boxes and straight lines at the layout A positions, text labels instead of icons); the URL and QR code.
- **Done when:** a screenshot with a node hovered shows it and only its wires highlighted; a simulated note on the hub slide passes the signal check; the QR code scans to the right URL.
- **Listen for:** the Zelda riff plays cleanly on the hub slide.
- **Commit:** "Add hub and closing slides"

**End of Must:** the talk can be given. Run Freeze and rehearse (`TALK_PLAN.md`) once here even if you continue, as a safety net.

---

## Phase 4: Should

### [ ] 4.1 Section 0: Cold open sequencer
- **Depends on:** 3.5
- **Docs:** MDN "Advanced techniques: creating and sequencing audio" (lookahead scheduling)
- **Goal:** `audio/sequencer.ts` and `SequencerDemo`: a chiptune loop that starts on the first click, with a step grid and tempo control. Notes are scheduled a little ahead on the audio clock. The song buttons in 5d use the sequencer.
- **Placeholder OK:** the grid and control look, and the loop (a simple 8-step melody plus bass). Scheduler timing must be solid.
- **Done when:** render check of the scheduler timing at two tempos; changing the tempo mid-loop causes no gap or double note.
- **Listen for:** steady timing; tempo and note changes are audible right away.
- **Fallback if skipped:** the talk opens on the title slide.
- **Commit:** "Add cold open sequencer"
- **Status:** built, awaiting review. `audio/chiptune.ts` (pattern, instruments, lookahead scheduler) and `SequencerDemo` on slide 1; `audio/sequencer.ts` still plays the 5d songs. Checked: signal after Play, playhead follows the audio clock, 150 → 100 bpm mid-loop goes from 0.2 s to 0.3 s steps with no gap or double, scroll and mute work, silence after leaving.

### [ ] 4.2a Section 6a: Samples and the buffer view
- **Depends on:** 2.5
- **Docs:** MDN `decodeAudioData`, `AudioBuffer`, `AudioBufferSourceNode`
- **Goal:** the vendored clips in `public/samples/` (with `CREDITS.md`); `audio/samples.ts` (the clip list, loaded and decoded once, shared by section 6); `BufferView` (a waveform drawn from `getChannelData`, with a playhead); `BufferDemo` on 6a, which plays the slide's code and shows the buffer's channels, sample rate and length. Placeholder slides for 6b–6d.
- **Placeholder OK:** the waveform look; `hello.mp3` is a `say` voice until Reed records one.
- **Done when:** screenshot; signal check after Play; the playhead reaches the end as the sound ends; slide-leave check; the offline check passes with every clip loading.
- **Listen for:** the Apollo clip plays all the way through, clean.
- **Commit:** "Add vendored samples and buffer demo"

### [ ] 4.2b Section 6b: Mic
- **Depends on:** 4.2a
- **Docs:** MDN `getUserMedia`, `MediaStreamAudioSourceNode`, `MediaRecorder`, `decodeAudioData`
- **Goal:** `MicDemo`: a live, scrolling mic waveform; Record captures a few seconds into an `AudioBuffer` that joins the clip list and becomes `picked`, so 6c opens on it. The recording must be mono: `reverse()` flips channel 0 only, as the slide code does. The mic stops on leave.
- **Placeholder OK:** the scrolling waveform look.
- **Done when:** with mic permission denied, the slide says so and points at the backup clip; with a fake mic (Chrome's `--use-fake-device-for-media-stream`), the recording appears in the list and on 6c.
- **Listen for:** no feedback howl with speakers on (live monitoring is off by default); the recording plays back clearly.
- **Commit:** "Add mic demo"

### [ ] 4.2c Section 6c: Play it differently
- **Depends on:** 4.2a
- **Docs:** MDN `AudioBufferSourceNode` (`playbackRate`, `detune`, `loop`, `loopStart`, `loopEnd`, `start()`)
- **Goal:** `SamplerDemo`: clip picker, a big `BufferView` with loop handles, and Reverse, rate, detune and loop controls. The playhead follows the real position at any rate, reversed or looping.
- **Placeholder OK:** control look.
- **Done when:** screenshot; signal check; the playhead stays in step with the sound at rates 0.5 and 2 and with a loop; changing the rate mid-play doesn't restart the sound.
- **Listen for:** chipmunk and slow-mo both work; loops don't click at the seam (or note that they do).
- **Commit:** "Add sampler demo"

### [ ] 4.2d Section 6d: Pitch without speed
- **Depends on:** 4.2c
- **Docs:** MDN `AudioBufferSourceNode` (`detune`, `start(when, offset, duration)`), `AudioParam.setValueCurveAtTime`; the sequencer's lookahead scheduler (`audio/sequencer.ts`)
- **Goal:** `audio/grains.ts`, a granular player (80 ms grains at 50% overlap with a choice of window, each scaled so overlaps never sum past 1; scheduled ahead on the audio clock; pitch via each grain's `detune`, speed via how far the read position moves per grain). `StretchDemo`: the signal chain as nodes with the controls inside (clip picker, speed and pitch, `WindowShapes` window picker, scope), a preserve-pitch toggle (off: a plain looping buffer source), and `StretchView` (original and output lanes on one time scale, windows and their dashed sum, a drift line from each grain's read to its play, yellow output overlaps, a stacked one-row-per-grain layout, the sounding grain, zoom, pause and step by grain, drag to stretch). Three slides build it up with `StretchDemo`'s `stage`: chop (no fade, no overlap, speed only), fade (Hann, no overlap, speed only), overlap (everything; the engine's `overlap` setting). A fourth, "Grains in code", with the `grain()` code and step notes.
- **Placeholder OK:** grain size, zoom levels, the look.
- **Done when:** screenshot of both slides; signal check; render check: with preserve pitch on, speed 0.5 keeps a 440 Hz tone at 440 Hz and takes twice as long through the buffer, and +12 semitones at speed 1 doubles the pitch at the same pace; every window plays, none louder than the source, only rectangle jumps; chop buzzes, fade pumps (dashed sum dips to zero), overlap holds a steady level; dragging the view changes speed and redraws at once; slide-leave check.
- **Listen for:** speech stays intelligible at 0.5× and 1.5× with the pitch held; ±12 semitones at normal speed; rectangle clicks, sine ripples, Hann and triangle are smooth; the warble is there but mild.
- **Commit:** "Add pitch-without-speed demo"

### [x] 4.2e Section 6e: Sample pads
- **Depends on:** 4.2d, 3.7
- **Goal:** `PadsDemo`: dragging on the source waveform marks a region; "→ pad" copies it into a new buffer (`audio/pads.ts`) on the selected one of four pads (2×2 grid). Every key plays the selected pad chromatically (C4 as recorded, gated), pitched by `detune` or by the grain engine played once (`once` setting), with a labelled playhead per note; an empty pad falls back to the marked region. Plays from MIDI, the on-screen keys and pad clicks. Replaces the old "sampler keys" task.
- **Placeholder OK:** pad look, which keys map to which pads.
- **Done when:** screenshot; a copied pad holds exactly the selected samples; signal check from a pad click and an on-screen key; leaving the slide hands the keys back to the synth.
- **Listen for:** pads trigger without clicks at the start or end of the region.
- **Commit:** "Add sample pads"

### [ ] 4.3 Section 7: What's next clips
- **Depends on:** 2.5
- **Goal:** `ClipButton` on each "?" slide, playing a short clip from `public/`.
- **Placeholder OK:** the clips (labeled silence or tones).
- **Done when:** screenshot; each clip plays (signal check).
- **Commit:** "Add what's next clips"

### [ ] 4.4 Hub wire pulse
- **Depends on:** 3.9
- **Goal:** a pulse travels along the hub's wires with each note.
- **Placeholder OK:** the pulse animation.
- **Done when:** a screenshot during a note shows the pulse.
- **Commit:** "Add hub wire pulse"

### [x] 4.5 Envelope playhead
- **Depends on:** 3.6
- **Goal:** a playhead that moves along the ADSR curve as a note plays.
- **Placeholder OK:** its look. It must track the envelope phase correctly.
- **Done when:** a screenshot mid-note shows the playhead in the right phase.
- **Commit:** "Add envelope playhead"

### [ ] 4.6 Section 5e: Filter
- **Depends on:** 3.5, 3.8
- **Docs:** MDN `BiquadFilterNode` (constructor options, `frequency`, `detune`, `Q`; for `lowpass`, `Q` is resonance in dB), `getFrequencyResponse()`, `AudioParam.linearRampToValueAtTime`
- **Goal:** a per-voice lowpass in `audio/synth.ts` (osc → filter → amp), with reactive `filter` settings (cutoff, resonance, amount) and the slide's `filterOn` scheduling `filter.detune`. `FilterDemo` on a new 5e slide after 5d: the synth as graph nodes (wave → filter → ADSR → scope), cutoff and resonance sliders on the filter node, an amount slider from step 2, and the frequency-response curve over the last note's harmonics. Three code steps as in `TALK_PLAN.md` 5e; step 3 (LFO on the cutoff) is optional. Entering the slide switches the wave to sawtooth. The song presets in `audio/presets.ts` get filter values.
- **Not a placeholder:** the filter's place in the voice, the wide-open default (earlier slides must sound unchanged), cutoff changes without zipper noise (`setTargetAtTime` on held voices), and the filter envelope restarting cleanly on a retriggered note.
- **Placeholder OK:** the response curve and harmonics look, the default cutoff, resonance and amount, the song presets' filter values.
- **Done when:** screenshot on each step; signal check; render check: a 110 Hz saw through a 500 Hz cutoff has much less energy above 2 kHz than with the filter open, and with amount 3600 the detune peaks at the attack time and is back to 0 after attack + decay; with the defaults, a note on 5c renders the same as before the change; slide-leave check; navigation check.
- **Listen for:** the cutoff slider darkens the saw smoothly with no zipper noise; high resonance whistles but doesn't blow up the level; Pluck on a low note gives the synth-bass "wow"; earlier slides (5c, 5d) sound unchanged.
- **Commit:** "Add filter to synth and filter slide"
- **Status:** built, awaiting review. `audio/filter.ts` (settings, `filterOn`, per-voice `voiceFilter` used by the synth and the sequencer, the wah LFO, `responseDb`), `FilterResponse`, `FilterDemo`, slide 17. `Slider` gained a `format` prop. Song presets carry a filter, all wide open for now. Checked: render (envelope peaks at 3600 cents at the attack time, 0 after attack + decay; 500 Hz cutoff leaves about 1/8 the energy above 2 kHz; wide open at Nyquist is sample-identical to no filter), signal on all three steps, LFO swings the level at 3 Hz, slide-leave silence, navigation after clicking controls, 5c and 5d still play.

### [ ] 4.7 Filter node on the hub
- **Depends on:** 3.9, 4.6
- **Goal:** a Filter node in the hub between Oscillator and Envelope (see `TALK_PLAN.md` → "The hub"), with its wires, hover and (with 4.4) pulse. Its click target (5.3) is the 5e slide.
- **Placeholder OK:** its icon (`designs/hub/` has none for a filter yet) and position.
- **Done when:** screenshot with the Filter node hovered.
- **Commit:** "Add filter node to hub"

---

## Phase 5: Could

- [ ] **5.1 Look and feel:** fill in the theme tokens (`TODO` direction from Reed) and pick a matching Shiki theme; rough.js drawing and Excalifont labels; the hub icons from `designs/hub/`.
- [ ] **5.2 Hub picture on 1b:** replace the placeholder graphic with a static render of the hub.
- [ ] **5.3 Hub click:** clicking a hub node jumps to its section.
- [ ] **5.4 Transitions:** per-slide transitions where they help.
- [ ] **5.5 4-track recorder** on the mic slide.
- [ ] **5.6 Self-guided mode:** captions standing in for the spoken notes; a mic-permission explanation.
- [ ] **5.7 Hosting:** deploy the built deck (`TODO` Reed picks where; check `--base` if it's under a sub-path).
- [ ] **5.8 User uploads:** drop your own audio file on a section 6 waveform (`file.arrayBuffer()` → `decodeAudioData`).

---

## Progress log

Add a dated line when a task is approved: the task number, and anything worth remembering (surprises, decisions, things to revisit).

- 2026-10-05: dropped the separate demo app; demos now live on the slides. Prototype: `audio/audio.ts` and `components/BeepButton.vue` on the "One beep" slide.
- 2026-10-05: 1.1, 1.3, 1.4, 2.2, 2.3 approved (built before the plan changed). Sections already have slides with text and code; Phase 3 adds their demos.
- 2026-10-05: 1.2, 2.1, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3 approved. `useDemo()` returns `out` as a `shallowRef` (connect to `out.value`), since it's swapped for a fresh node on each leave. The code layout's notes column spans the full height and the demo sits under the code only, so tall notes can't push the demo off the slide. 2b has a note-length slider (starts clean at 0.1 s, overlaps up to the slide's 0.75 s) to lead into 3a. Slide 8 code splits out `const now`. Still overflowing, for their own tasks: slides 11 and 19 (long code lines), 15 (bottom). `grep "demo:"` from 2.6 now matches the `::demo::` slot.
- 2026-10-05: 4.5 approved (built with 3.6, ahead of the remaining Must tasks; the playhead dot shows the real level, so a release mid-attack drops from wherever the volume was). 3.4 and 3.6 partly done, see their status lines. The presets table slide is gone: the presets are cards under the ADSR editor on 4b, so later slides moved up one. Enter is the ADSR trigger key: Slidev only binds it in the overview, and it's not a letter key. Slide 11 fixed (wrapped the long lines, code at 1rem on that slide); still overflowing: slides 14 (bottom) and 18 (long code lines). Editor time axis uses a square-root scale (shared with the preset bars) so ms-short times stay grabbable.
- 2026-10-06: 4.2e approved. Four pads in a 2×2 grid; every key plays the selected pad chromatically (C4 as recorded, gated), by `detune` or by grains played once (the grain engine's new `once` setting); an empty pad falls back to the marked region. Pads mode (one pad per key) was tried and dropped. `BufferView` gained `selectable` (drag to mark a region) and `ClipPicker` an `inline` variant. With the on-screen keyboard open the slide hides its code and notes so the demo sits above the drawer. Committed together with 4.2a–4.2d, which pads build on; their boxes stay open until reviewed. Gotcha: every open tab of the deck hears a real MIDI keyboard, so two open windows double-trigger.
- 2026-10-06: 3d added (LFO on slide 8, click 3). The live gain is read from an `AnalyserNode` tapped after `depth` plus `volume.gain.value`, since a param's input can't be read from JS. The LFO line is split (`lfo.frequency.value = 2`) so the code stays as narrow as the earlier steps; a wider line squeezes the notes column past the slide edge. `SignalChain` has a `<key>-above` slot that sits outside the layout, so the demo reserves the room itself (`has-lfo` padding). The checkbox isn't reset on slide enter.
