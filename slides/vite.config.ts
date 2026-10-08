import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: [
      // Swap out twoslash's client plugin for a quiet stub. Remove once a
      // Shiki release patches floating-vue 5.4 cleanly.
      {
        find: /^@shikijs\/vitepress-twoslash\/client$/,
        replacement: fileURLToPath(new URL('./lib/twoslash-client.ts', import.meta.url)),
      },
    ],
  },
  build: {
    // Slidev 53's bundled CSS comes out of UnoCSS's directive transform with
    // stray declarations at the top level, which lightningcss's minifier
    // rejects ("Invalid token in pseudo element"). Unminified, browsers just
    // skip the stray fragment. Re-enable once a Slidev release builds cleanly.
    cssMinify: false,
  },
})
