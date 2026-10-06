# Web Audio talk

A 20-minute Utah JS talk introducing the Web Audio API, built as one Slidev deck
in `slides/`. The demos run on the slides themselves: each demo is a Vue
component on the slide whose code it plays. Rules in `slides/CLAUDE.md`.

Target: latest Chrome only. The deck runs fully offline. Reed is the only one
who runs it: no presenter mode, and slide code doesn't need to run in the console.

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

- `slides/`: the deck, with its own `package.json`
- `designs/`: design references (e.g. `designs/hub/` for the hub)
- `plans/`: the plans
  - `plans/TALK_PLAN.md`: what each section says, shows and plays, and how
    agents work through the plan
  - `plans/SLIDES_PLAN.md`: the task list
- `workbench/` is gitignored: lessons, outlines, wireframes, and old plans in
  `workbench/archive/` (reference only). Search tools may skip it, so open
  these files by path. Never commit or copy anything from it into the deck.

## Commands

Run from `slides/` (or with `npm --prefix slides`):

- `npm run dev`: dev server (port 3030)
- `npm run build`: static build into `slides/dist/`

## Done means

The build passes, there are no console errors, and a screenshot of the slide
looks right. For audio work, the analyser shows a signal after a trigger and
silence after leaving the slide. Audio quality needs a human listening check, so
say what to listen for.

## Commits

- One short line, imperative mood (e.g. "Add ADSR editor component").
- No agent authorship or attribution: no `Co-Authored-By`, no "Generated with" lines.
