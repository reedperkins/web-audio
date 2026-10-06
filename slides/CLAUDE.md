# Slides (Slidev deck)

The talk's slide deck. Tasks are in `workbench/SLIDES_PLAN.md`; content is in
`workbench/TALK_PLAN.md`.

## Check the docs

Use the local `slidev` MCP server to read and edit slides
(list/get/insert/update/move/remove), and `slidev-goto-slide` plus a screenshot
to check a slide visually. Check https://sli.dev for features and config.

## Layout

- `slides.md`: headmatter plus one `src:` import per section in `pages/`
- `layouts/`, `components/`, `public/`: Slidev conventions

## Rules

- No audio code in the deck. Demos live in `demos/`; link to them with
  `<DemoLink to="route">`.
- Slide code is inline in fenced code blocks, written to teach. Keep it short and
  plain, but correct: it must run as shown when pasted into the demo app's dev
  console, where `ctx` and `master` exist.
- Never let a link or control keep focus. Slidev turns off its shortcuts while an
  `<a>`, `<button>` or `<input>` has focus.
- Step-driven behavior depends on the current step number, never on each click.
- Colors and fonts come only from the tokens in `theme/`. `theme/` is a copy of
  `demos/src/theme/`; change both together (`diff -r theme ../demos/src/theme`
  should print nothing). Code highlighting is set in the Shiki config.

## Commands

Run from this folder (or with `npm --prefix slides`):

- `npm run dev`: dev server
- `npm run build`: static build
- `npm run format`: `slidev format`
