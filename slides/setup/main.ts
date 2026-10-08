import { defineAppSetup } from '@slidev/types'
import { vNoFocus } from '../audio/useDemo'

// `v-no-focus` for slide Markdown, so links on slides don't keep focus.
export default defineAppSetup(({ app }) => {
  app.directive('no-focus', vNoFocus)
})
