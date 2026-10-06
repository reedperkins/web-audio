// The one AudioContext for the whole deck: master → analyser → speakers.
// Demos never connect here directly; they get their own `out` from useDemo().
export const ctx = new AudioContext()

// Full scale on purpose, so the clipping demo really clips. Loudness is set on
// the laptop or PA.
export const master = new GainNode(ctx, { gain: 1 })
export const analyser = new AnalyserNode(ctx, { fftSize: 2048 })
master.connect(analyser).connect(ctx.destination)

// Chrome starts the context suspended until a user gesture. Every play
// handler awaits this before scheduling anything.
export async function unlock() {
  if (ctx.state === 'suspended') await ctx.resume()
}

declare global {
  // eslint-disable-next-line no-var
  var __talkAudio: { ctx: AudioContext; master: GainNode; analyser: AnalyserNode } | undefined
}

// For the signal check in dev; never in the build.
if (import.meta.env.DEV) globalThis.__talkAudio = { ctx, master, analyser }

// A hot update would create a second context. Reload the page instead.
if (import.meta.hot) import.meta.hot.decline()
