# Demos (Vite + Vue SPA)

Every working demo for the talk, plus the hub. Tasks are in
`workbench/DEMOS_PLAN.md`; what each route shows is in `workbench/TALK_PLAN.md`.

## Layout

- `src/audio/`: the audio engine (`audio.ts`, `useDemo.ts`) and plain audio
  modules (envelope, voices, `mtof`, MIDI, sequencer, presets)
- `src/routes/`: one component per route
- `src/components/`: shared components (`Scope`, `AdsrEditor`, `Keyboard`, `Hub`, …)
- `App.vue`: the shell (header with Start toggle and MIDI status, route view,
  on-screen keyboard)

## Rules

- One `AudioContext` for the whole app, from `src/audio/audio.ts`. Never create
  another.
- Hash routing only (`createWebHashHistory`), and never reload the page. Deck
  links must change only the hash, so the context and its unlocked state survive.
- Every demo uses `useDemo()`: build in `enter`, clean up in `leave`. Route
  components are not kept alive, so leaving a route unmounts it.
- Demos connect to `useDemo()`'s `out`, never to `master` or `ctx.destination`
  directly, so sound stops on leave and the analyser sees it.
- Keep audio nodes out of deep reactivity (`shallowRef` / `markRaw`).
- Never let a control keep focus after a pointer click (use `noFocus`).
- Colors and fonts come only from the tokens in `src/theme/`. Canvas code reads
  them with `getComputedStyle`; SVG uses `currentColor`. `src/theme/` is a copy
  of `slides/theme/`; change both together (`diff -r src/theme ../slides/theme`
  should print nothing).

## Commands

Run from this folder (or with `npm --prefix demos`):

- `npm run dev`: dev server on port 5173
- `npm run build`: static build
