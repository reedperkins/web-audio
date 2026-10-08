# Slides (Slidev deck)

The talk's slide deck, including the audio engine and every demo. Tasks are in
`plans/SLIDES_PLAN.md`; content is in `plans/TALK_PLAN.md`.

## Check the docs

Use the local `slidev` MCP server to read and edit slides
(list/get/insert/update/move/remove), and `slidev-goto-slide` plus a screenshot
to check a slide visually. Check https://sli.dev for features and config.

## Layout

- `slides.md`: headmatter plus one `src:` import per section in `pages/`
- `audio/`: the engine (`audio.ts`, `useDemo.ts`) and plain audio modules
  (envelope, synth, `mtof`, input, sequencer, presets). No Vue components.
- `components/`: building blocks with no audio inside (`PlayButton`, `Scope`,
  `AdsrEditor`, …) and one demo component per slide (`BeepDemo`, `ClockDemo`, …).
  Buttons are `ToggleChip` (or `PlayButton`, `Segmented`, `ShapePicker`), not
  hand-styled `<button>`s.
- `lib/`: plain drawing and formatting helpers (`fitCanvas`, `duration`)
- `layouts/`, `public/`, `setup/`, `theme/`: Slidev conventions

## Rules

- One `AudioContext` for the whole deck, from `audio/audio.ts`. Never create
  another.
- Every demo uses `useDemo()`: start in `enter`, clean up in `leave`. These run
  on slide enter/leave, not mount/unmount: Slidev mounts slides early and keeps
  them mounted. Never make sound or start timers on mount.
- Demos connect to `useDemo()`'s `out`, never to `master` or `ctx.destination`
  directly, so sound stops on leave and the analyser sees it.
- Keep audio nodes out of deep reactivity (`shallowRef` / `markRaw`).
- Slide code is inline in fenced code blocks, written to teach. It describes
  what the demo does, but the engine doesn't have to run it: engine code can be
  whatever it needs to be. Engine code that does reuse slide code connects to
  `out` instead of `ctx.destination`.
- Never let a link or control keep focus (use `noFocus`). Slidev turns off its
  shortcuts while an `<a>`, `<button>` or `<input>` has focus.
- Step-driven behavior depends on the current step number, never on each click.
- Size and style a building block through its props, its root element (a
  class on the component) or the CSS variables it documents
  (`--slider-width`, `--node-padding`, …). No `:deep()` into its insides.
- Colors and fonts come only from the tokens in `theme/`. Canvas code reads
  them with `getComputedStyle`; SVG uses `currentColor`. Code highlighting is
  set in the Shiki config.

## Commands

Run from this folder (or with `npm --prefix slides`):

- `npm run dev`: dev server
- `npm run build`: static build
- `npm run format`: `slidev format`
