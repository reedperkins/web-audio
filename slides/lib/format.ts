// A duration for a label: milliseconds under a second, else seconds.
export const duration = (t: number) => (t < 1 ? `${Math.round(t * 1000)} ms` : `${t.toFixed(2)} s`)
