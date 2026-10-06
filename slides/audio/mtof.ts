// MIDI note number → frequency in Hz. The code on the "Numbers → pitch" slide.
export const mtof = (note: number) => 440 * 2 ** ((note - 69) / 12)
