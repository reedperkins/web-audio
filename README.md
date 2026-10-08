# Web Audio

**Build your musical dreams.** A Utah JS talk introducing the Web Audio API.

The talk is one [Slidev](https://sli.dev) deck, and the demos run on the slides
themselves: each slide shows a piece of code, and a Vue component on the same
slide plays it. Over the talk those pieces add up to a playable synth, a mic
sampler and a granular instrument.

## What's in the talk

1. **Cold open:** a live chiptune step sequencer
2. **What is Web Audio?** Audio graphs, and the audio thread
3. **First sound:** one oscillator, and scheduling on the audio clock
4. **Volume:** clipping, gain, and automating parameters
5. **Envelopes:** scheduling gain automation, and building ADSR
6. **Keyboard:** Web MIDI, note numbers to pitch, polyphony, wave shapes and filters
7. **Real audio:** the mic, buffers, granular synthesis, sample pads and a chaos synth
8. **What's next:** prior art, and where to go from here

## Running it

You need [Node.js](https://nodejs.org) (built with v24) and the latest Chrome.
Chrome is the only browser the deck targets.

```sh
cd slides
npm install
npm run dev        # dev server at http://localhost:3030
```

To run the built version, which works fully offline:

```sh
npm run build      # static site in slides/dist/
npm run preview    # serves it at http://localhost:4173
```

### Permissions and hardware

- **Audio:** Chrome keeps audio off until you click or press a key on the page.
  Your first click on the opening slide turns it on.
- **MIDI:** a MIDI keyboard is optional; the talk uses an Akai MPK Mini. Plug it
  in before you open the deck. Without one, the on-screen keyboard plays the
  same synth.
- **Microphone:** used on the mic slides. If it's blocked or missing, a backup
  clip stands in.

The chips at the top right of the first slide show whether audio, MIDI and the
mic are allowed, and clicking one asks for that permission.

## Project layout

```
slides/
  slides.md      headmatter, plus one import per section
  pages/         the slides, one file per section
  components/    Vue components: one demo per slide, plus the controls and pictures they use
  audio/         the audio engine: the one shared AudioContext and the synth, sampler and sequencer
  theme/         colors, fonts and sizes, as CSS variables
  public/        images and audio clips
plans/           the talk plan and task list
designs/         design references
```

Every demo shares one `AudioContext` (`slides/audio/audio.ts`). Demos start
when you arrive on their slide and go quiet when you leave it (see
`slides/audio/useDemo.ts`).

## Further reading

- [Web Audio API on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Web MIDI API on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)
- [Slidev](https://sli.dev)

## License

[MIT](LICENSE)
