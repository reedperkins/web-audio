// The one AudioContext for the whole deck. Every demo plays into `master`.
export const ctx = new AudioContext()

// Keeps full-scale oscillators from blasting the PA.
export const master = new GainNode(ctx, { gain: 0.3 })
master.connect(ctx.destination)

// Chrome starts the context suspended until a user gesture; call this from
// a click handler before playing.
export function unlock() {
  if (ctx.state === 'suspended') return ctx.resume()
}
