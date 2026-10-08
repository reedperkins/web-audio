<div class="close">
  <div>
    <h1>Thanks!</h1>
    <p class="who">Reed Perkins · Utah JS</p>
  </div>
  <figure class="repo">
    <QrCode url="https://github.com/reedperkins/web-audio" class="qr" />
    <a v-no-focus class="url" href="https://github.com/reedperkins/web-audio" target="_blank">github.com/reedperkins/web-audio</a>
  </figure>
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

.close .who {
  color: var(--muted);
  font-size: var(--size-small);
}

.repo {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.qr {
  width: 16rem;
}

.repo .url {
  border: 0;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: var(--size-small);
}
</style>
