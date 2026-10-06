<script setup lang="ts">
import { computed } from 'vue'
import QRCode from 'qrcode'

// Draws the QR code as an inline SVG from the bundled encoder, so it needs no
// network and takes its color from the theme.
const props = defineProps<{ url: string }>()

const qr = computed(() => {
  const { modules } = QRCode.create(props.url, { errorCorrectionLevel: 'M' })
  let d = ''
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(row, col)) d += `M${col} ${row}h1v1h-1z`
    }
  }
  return { size: modules.size, d }
})
</script>

<template>
  <svg
    class="qr-code"
    :viewBox="`-2 -2 ${qr.size + 4} ${qr.size + 4}`"
    shape-rendering="crispEdges"
    role="img"
    :aria-label="`QR code for ${url}`"
  >
    <rect x="-2" y="-2" :width="qr.size + 4" :height="qr.size + 4" class="qr-bg" />
    <path :d="qr.d" fill="currentColor" />
  </svg>
</template>

<style scoped>
.qr-code {
  color: var(--ink);
}

.qr-bg {
  fill: var(--bg);
}
</style>
