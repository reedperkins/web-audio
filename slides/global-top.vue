<script setup lang="ts">
import { computed } from 'vue'
import { useNav } from '@slidev/client'
import KeyboardDrawer from './components/KeyboardDrawer.vue'

// Drawn over every slide, inside the scaled stage. The backup keyboard shows
// only on slides with `keyboard: true` in their frontmatter.
const { currentSlideRoute } = useNav()
const showKeyboard = computed(() => !!currentSlideRoute.value?.meta?.slide?.frontmatter?.keyboard)
</script>

<template>
  <KeyboardDrawer v-if="showKeyboard" />
</template>
