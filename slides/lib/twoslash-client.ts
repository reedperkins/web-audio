import FloatingVue from 'floating-vue'
import type { App } from 'vue'

// Stands in for `@shikijs/vitepress-twoslash/client`, which Slidev installs
// even with twoslash off (see vite.config.ts). Same FloatingVue install,
// minus its VMenu patch: that patch expects an older floating-vue and logs
// "Failed to patch FloatingVue" on every load. The deck has no twoslash
// popups, so nothing is lost.
export default {
  install(app: App, options: Record<string, unknown> = {}) {
    app.use(FloatingVue, { strategy: 'fixed', ...options })
  },
}
