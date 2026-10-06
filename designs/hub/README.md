# Hub mockups

Design reference for the hub, the demo app's home page (`demos/`, route `#/`).
Open `hub-mockups.excalidraw` in [excalidraw.com](https://excalidraw.com)
(File → Open) to see every frame.

**Chosen direction:** layout A with icons (frame H).

| Frame | What it shows |
|-------|---------------|
| A | Layout traced from the original sketch, fully lit (`a-sketch-layout.png`) |
| B | Three-row snake (not chosen) |
| C | Layout A after section 3, fogged (no longer used: the hub has no fog) |
| D, E, F | Spiral, staircase, synth rack (not chosen) |
| G | Layout A after section 3, partly lit (`g-after-section-3.png`; no longer used) |
| H | Layout A with icons, fully lit (`h-icons-lit.png`): **the reference** |
| I | Icons in the G state (`i-icons-after-section-3.png`; no longer used) |

## Rules

- **No fog:** every node, icon and wire is drawn in ink, solid, from the start,
  as in frame H.
- **Hover:** the node under the cursor and its wires are highlighted.
- **Click:** a node opens its demo route.
- **"?" nodes:** drawn dashed, so they read as "not built today."
- **Icons:** each node has a hand-drawn icon plus a label: keyboard keys, sine,
  ADSR outline, fader, speaker cone, mic, scope trace. The Scope icon still
  looks too much like the Oscillator's sine.
- **Look:** draw with rough.js using a fixed seed, and label in Excalifont, so
  the hub matches these mockups.
