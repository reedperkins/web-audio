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
- **Slide code:** inline fenced code blocks, written to teach (see `TALK_PLAN.md` → "Slide code"). The demo on the slide runs the same code.
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

- Reactive settings: `wave` and `env` (A/D/S/R). The ADSR editor, presets, wave picker and instrument presets all edit these.
- A `voices` map with `noteOn(note, velocity)` / `noteOff(note)`. `Voice` and `noteOn`/`noteOff` are the code shown on the slides.
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
- **Offline check:** serve the build, turn on network emulation "Offline," reload, and confirm it works with no failed requests.

---

## Phase 1: Scaffold (Must)

### [x] 1.1 Install Slidev in `slides/`
- **Goal:** an empty deck that runs.
- **Steps:** create `slides/package.json` with `@slidev/cli` and `@slidev/theme-default`, and scripts `dev` (`slidev`), `build` (`slidev build`), `format` (`slidev format`). Create `slides.md` with a title slide. Install manually; the interactive `npm init slidev` doesn't suit an agent.
- **Done when:** `npm --prefix slides run dev` serves the deck, and the build passes.
- **Commit:** "Scaffold Slidev deck"

### [ ] 1.2 Offline config and preview
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

### [ ] 2.1 Layouts
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

### [ ] 2.4 Audio engine and `useDemo()`
- **Depends on:** 1.1
- **Docs:** MDN `AudioContext`, `resume()`, `GainNode`, `AnalyserNode`, autoplay policy; sli.dev slide hooks
- **Goal:** `audio/audio.ts` as in [The audio engine](#the-audio-engine) and `audio/useDemo.ts` as in [The `useDemo()` contract](#the-usedemo-contract). Build on the prototype in `audio/audio.ts` (currently master at 0.3, no analyser).
- **Done when:** importing the module twice gives the same context; the dev global exists in dev and not in the build; a probe demo logs enter/leave in the right order while navigating, and doesn't log enter for a neighbouring slide that's only preloaded; the slide-leave check passes for a demo whose `leave` does nothing.
- **Commit:** "Add audio engine and useDemo"

### [ ] 2.5 Demo building blocks: `PlayButton` and `Slider`
- **Depends on:** 2.4
- **Goal:** `PlayButton` (generalized from the prototype `BeepButton`: emits `play`, shows a playing state) and `Slider` (`v-model`), both using `noFocus`.
- **Placeholder OK:** their look.
- **Done when:** the navigation check passes on a test slide with both.
- **Commit:** "Add play button and slider"

### [ ] 2.6 Remove the demo-app links
- **Depends on:** 2.1
- **Goal:** no trace of the separate demo app in the deck.
- **Steps:** delete `components/DemoLink.vue`, the `demo`/`demoLabel` props from `layouts/code.vue`, and the `demo:`/`demoLabel:` frontmatter on every slide.
- **Done when:** `grep -rn "DemoLink\|demoLabel\|demo:" slides --exclude-dir=node_modules` finds nothing; the build passes.
- **Commit:** "Remove demo app links"

---

## Phase 3: Sections (Must)

Each slide's content and demo are in `TALK_PLAN.md` ("Demos by slide" and the section); follow them. Every task: slides use the layouts, code is inline, each demo uses `useDemo()` and plays the slide's code, and the navigation check passes.

**Placeholder OK for all:** on-screen text, how the code reads, and the look of every demo picture. Sound and lifecycle must be solid.

### [ ] 3.1 Section 1: What is Web Audio?
- **Depends on:** 2.1
- **Goal:** 1a title, 1b the two points with a boxes-and-arrows graphic.
- **Done when:** screenshots look right.
- **Commit:** "Add intro section"

### [ ] 3.2 Section 2: First sound
- **Depends on:** 2.3, 2.5
- **Docs:** MDN `OscillatorNode`, `AudioScheduledSourceNode.start()` / `stop()`, `currentTime`
- **Goal:** 2a `BeepDemo` (play button under the code; replaces the prototype `BeepButton`) and 2b `ClockDemo` with a `Timeline` of the four start times and a playhead that follows `ctx.currentTime`.
- **Done when:** screenshots (2b mid-arpeggio shows the playhead partway); signal check after each trigger.
- **Listen for:** a clean 1-second tone; an even four-note arpeggio.
- **Commit:** "Add first sound demos"

### [ ] 3.3 Section 3: Volume
- **Depends on:** 3.2
- **Docs:** MDN `GainNode`, `AudioParam.setTargetAtTime`
- **Goal:** 3a `ClipDemo` with `WaveSum` (four sines, their sum past ±1, clipped flat tops, drawn from the math); 3b and 3c `VolumeDemo` with `SignalChain` (osc → gain → out), a play button and a volume `Slider` using `setTargetAtTime`.
- **Done when:** screenshots; with the chord playing, the analyser shows samples beyond ±1 in 3a and within ±1 in 3b.
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

### [ ] 3.5 Shared synth
- **Depends on:** 3.4
- **Docs:** MDN `AudioScheduledSourceNode` `ended` event, `AudioNode.disconnect()`
- **Goal:** `audio/mtof.ts` and `audio/synth.ts` as in [The shared synth](#the-shared-synth), with the slide's `Voice` class, and cleanup after release.
- **Not a placeholder:** voice lifecycle and cleanup.
- **Done when:** render check of `mtof` (69 → 440, 81 → 880); playing and releasing 50 notes leaves no voices behind; leaving a slide with notes held silences them.
- **Listen for:** chords sound clean; held notes don't cut off when others are released.
- **Commit:** "Add shared synth"

### [ ] 3.6 ADSR editor and presets
- **Depends on:** 3.5
- **Goal:** `AdsrEditor` (`v-model` on the synth's `env`; plays a note when a point is let go), 4b `AdsrDemo`, the small curve on the code slide that highlights the segment for the current step, and 4c `PresetsDemo` (the table rows play and load presets from `audio/presets.ts`).
- **Placeholder OK:** handle feel, curve drawing, labels, preset values. The `v-model` contract and play-on-release must work.
- **Done when:** a screenshot after a simulated drag shows the new shape, and the next note's envelope matches it.
- **Listen for:** each preset sounds clearly different (organ, pluck, stab, percussive, pad).
- **Commit:** "Add ADSR editor and presets"

### [ ] 3.7 Input: MIDI and the on-screen keyboard
- **Depends on:** 3.5
- **Docs:** MDN Web MIDI API, `requestMIDIAccess()`, `midimessage`, `MIDIMessageEvent.data`, `statechange`
- **Goal:** `audio/input.ts` (note on/off including velocity-0 note-offs, hot-plugging, a reactive recent-messages list), a small MIDI status indicator, and an on-screen `Keyboard` available on every slide from section 4 on.
- **Placeholder OK:** status indicator and keyboard look. MIDI parsing must be solid.
- **Done when:** with no device, the indicator says so and nothing errors; a simulated message (call the handler directly) plays a note (signal check); the on-screen keyboard plays notes and passes the navigation check.
- **Listen for (with the real keyboard):** no noticeable delay; plugging in mid-talk works.
- **Commit:** "Add MIDI and on-screen keyboard input"

### [ ] 3.8 Section 5: Keyboard demos
- **Depends on:** 3.6, 3.7
- **Goal:** 5a `MidiLog`, 5b `OctaveDemo`, 5c `VoicesDemo`, 5d `WaveDemo` (with a live `Scope` from the analyser), 5e `InstrumentDemo` (Zelda first).
- **Placeholder OK:** every picture, the song presets and melodies.
- **Done when:** screenshots after simulated notes show each picture updating; the scope shows four clearly different shapes in 5d.
- **Listen for:** the Zelda preset sounds recognizably "8-bit."
- **Commit:** "Add keyboard demos"

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
- **Goal:** `audio/sequencer.ts` and `SequencerDemo`: a chiptune loop that starts on the first click, with a step grid and tempo control. Notes are scheduled a little ahead on the audio clock. The riff button in 5e reuses the sequencer.
- **Placeholder OK:** the grid and control look, and the loop (a simple 8-step melody plus bass). Scheduler timing must be solid.
- **Done when:** render check of the scheduler timing at two tempos; changing the tempo mid-loop causes no gap or double note.
- **Listen for:** steady timing; tempo and note changes are audible right away.
- **Fallback if skipped:** the talk opens on the title slide.
- **Commit:** "Add cold open sequencer"

### [ ] 4.2 Section 6: Mic
- **Depends on:** 2.5
- **Docs:** MDN `getUserMedia`, `MediaRecorder`, `decodeAudioData`, `AudioBufferSourceNode.playbackRate`
- **Goal:** `MicDemo`: record a few seconds, draw the waveform, play back with Reverse and Speed toggles; a pre-recorded backup clip in `public/`.
- **Placeholder OK:** the backup clip (a labeled generated tone until Reed records one) and the waveform look.
- **Done when:** the backup clip plays through the same controls; with mic permission denied, the slide explains it and offers the clip.
- **Listen for:** recording plays back clearly; reverse and speed both work.
- **Commit:** "Add mic demo"

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

### [ ] 4.5 Envelope playhead
- **Depends on:** 3.6
- **Goal:** a playhead that moves along the ADSR curve as a note plays.
- **Placeholder OK:** its look. It must track the envelope phase correctly.
- **Done when:** a screenshot mid-note shows the playhead in the right phase.
- **Commit:** "Add envelope playhead"

---

## Phase 5: Could

- [ ] **5.1 Look and feel:** fill in the theme tokens (`TODO` direction from Reed) and pick a matching Shiki theme; rough.js drawing and Excalifont labels; the hub icons from `designs/hub/`.
- [ ] **5.2 Hub picture on 1b:** replace the placeholder graphic with a static render of the hub.
- [ ] **5.3 Hub click:** clicking a hub node jumps to its section.
- [ ] **5.4 Transitions:** per-slide transitions where they help.
- [ ] **5.5 4-track recorder** on the mic slide.
- [ ] **5.6 Self-guided mode:** captions standing in for the spoken notes; a mic-permission explanation.
- [ ] **5.7 Hosting:** deploy the built deck (`TODO` Reed picks where; check `--base` if it's under a sub-path).

---

## Progress log

Add a dated line when a task is approved: the task number, and anything worth remembering (surprises, decisions, things to revisit).

- 2026-10-05: dropped the separate demo app; demos now live on the slides. Prototype: `audio/audio.ts` and `components/BeepButton.vue` on the "One beep" slide.
- 2026-10-05: 1.1, 1.3, 1.4, 2.2, 2.3 approved (built before the plan changed). Sections already have slides with text and code; Phase 3 adds their demos.
