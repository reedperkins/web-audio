<script setup lang="ts">
import { computed } from 'vue'
import { useNav } from '@slidev/client'
import KeyboardDrawer from './components/KeyboardDrawer.vue'

// Drawn over every slide, inside the scaled stage. The backup keyboard shows
// from the first slide with `keyboard: true` in its frontmatter onward.
const { slides, currentSlideNo } = useNav()
const firstKeyboardSlide = computed(() =>
  slides.value.find((s) => s.meta?.slide?.frontmatter?.keyboard)?.no ?? Infinity,
)
</script>

<template>
  <KeyboardDrawer v-if="currentSlideNo >= firstKeyboardSlide" />
</template>
