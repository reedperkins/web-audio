# Web Audio talk

A 20-minute Utah JS talk introducing the Web Audio API, built as two apps:

- `slides/`: a Slidev deck. No audio code. Rules in `slides/CLAUDE.md`.
- `demos/`: a Vite + Vue SPA with every working demo and the hub. Rules in
  `demos/CLAUDE.md`.

Slides link to demo routes, which open in one reused browser tab. The apps share
no code; code on slides is written to teach and is never imported from `demos/`.
Target: latest Chrome only. Both apps run fully offline from one local server.

## Before writing code: check the docs

Check the current docs before writing or changing code. Don't rely on memory.

- **Web Audio and other browser APIs** (`AudioContext`, `AudioNode`, `AudioParam`,
  Web MIDI, `getUserMedia`, …): look them up with the `mdn` MCP server
  (`mcp__mdn__search`, then `mcp__mdn__get-doc`). Use current APIs only. If MDN
  marks something deprecated or experimental, don't use it without saying so.
  Skip compatibility checks, prefixes and fallbacks.
- **Vue:** check the Vue docs (index at https://vuejs.org/llms.txt; each page
  has a `.md` version). Use Composition API with `<script setup>`.
- **Slidev:** see `slides/CLAUDE.md`.

## Project layout

- `package.json`: root scripts only; each app has its own `package.json`
- `slides/`, `demos/`: the two apps
- `designs/`: design references (e.g. `designs/hub/` for the hub)
- `workbench/` is gitignored and holds the plans. Search tools may skip it, so
  open these files by path:
  - `workbench/TALK_PLAN.md`: what each section says and shows, the demo
    routes, and how agents work through the plans
  - `workbench/SLIDES_PLAN.md` and `workbench/DEMOS_PLAN.md`: the task lists
  - `workbench/archive/`: old plans, for reference only

  Never commit or copy anything from `workbench/` into the apps.

## Commands

- `npm run dev:slides`: Slidev dev server
- `npm run dev:demos`: demo app dev server (port 5173)
- `npm run build`: build both into `dist/` (deck at `/`, demos at `/demos/`)
- `npm run preview`: serve the build (rehearse from this)

## Done means

The build passes, there are no console errors, and a screenshot of the slide or
demo route looks right. For audio work, the analyser shows a signal after a
trigger. Audio quality needs a human listening check, so say what to listen for.

## Commits

- One short line, imperative mood (e.g. "Add ADSR editor component").
- No agent authorship or attribution: no `Co-Authored-By`, no "Generated with" lines.
