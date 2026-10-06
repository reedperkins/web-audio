import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    // Slidev 53's bundled CSS comes out of UnoCSS's directive transform with
    // stray declarations at the top level, which lightningcss's minifier
    // rejects ("Invalid token in pseudo element"). Unminified, browsers just
    // skip the stray fragment. Re-enable once a Slidev release builds cleanly.
    cssMinify: false,
  },
})
