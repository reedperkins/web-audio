---
layout: statement
---

# Let's play it

---
# PLACEHOLDER(refine): closing URL, QR code and closing line, until hosting is decided
---

<div class="close">
  <div>
    <h1>Thanks!</h1>
    <p class="url">example.com/web-audio</p>
    <p class="who">Reed Perkins · Utah JS</p>
  </div>
  <QrCode url="https://example.com/web-audio" class="qr" />
</div>

<style>
.close {
  height: 100%;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 3rem;
}

.close h1 {
  font-size: var(--size-display);
}

.close .url {
  font-family: var(--font-mono);
  color: var(--accent);
}

.close .who {
  color: var(--muted);
  font-size: var(--size-small);
}

.qr {
  width: 16rem;
}
</style>
