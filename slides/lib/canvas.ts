// Sizes a canvas's drawing buffer to its laid-out size, sharper than the
// screen (the slide is scaled), and hands back what drawing needs. Returns
// null while it has no size: Slidev lays out slides it isn't showing at zero.
export function fitCanvas(el: HTMLCanvasElement | undefined | null) {
  if (!el) return null
  const scale = devicePixelRatio * 2
  const w = Math.round(el.clientWidth * scale)
  const h = Math.round(el.clientHeight * scale)
  if (!w || !h) return null
  if (el.width !== w || el.height !== h) Object.assign(el, { width: w, height: h })
  const g = el.getContext('2d')!
  const style = getComputedStyle(el)
  // A theme token's value, e.g. color('--signal').
  const color = (token: string) => style.getPropertyValue(token).trim()
  g.clearRect(0, 0, w, h)
  return { g, w, h, scale, color }
}
