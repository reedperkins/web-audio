---
# PLACEHOLDER(refine): on-screen text for each idea
---

# Where do we go from here?

<div class="next">
  <figure>
    <img src="/images/vocoder.jpg" alt="A vocoder plugin with a bar graph of 40 frequency bands">
    <figcaption><b>Vocoder</b>Your voice, played through the synth we just built.</figcaption>
  </figure>
  <figure>
    <img src="/images/granular.png" alt="A waveform editor with a drum loop sliced into numbered pieces">
    <figcaption><b>Granular synthesis</b>Chop sound into tiny grains and scatter them.</figcaption>
  </figure>
  <figure>
    <img src="/images/tone-of-life.png" alt="Tone of Life: a Game of Life grid with Start, Stop and Step buttons">
    <figcaption><b>Tone of Life</b>Music from emergent behavior.<a v-no-focus class="credit" href="https://matthewbilyeu.com/tone-of-life.html" target="_blank">by Matthew Bilyeu · matthewbilyeu.com</a></figcaption>
  </figure>
</div>

<style>
.next {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin-top: 2rem;
}

.next figure {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* The screenshots have different shapes; each fits a box of the same size. */
.next img {
  width: 100%;
  height: 14rem;
  object-fit: contain;
  object-position: left center;
}

.next figcaption {
  color: var(--muted);
  font-size: var(--size-small);
  line-height: 1.4;
}

.next .credit {
  display: block;
  margin-top: 0.4rem;
  border: 0;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.next figcaption b {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--ink);
  font-size: var(--size-body);
}
</style>

---

# Prior art

<div class="prior-art">
  <figure>
    <img src="/images/max.png" alt="A Max patch: 50 oscillators wired through mc objects to a speaker">
    <figcaption><b>Max <span>1985</span></b>Miller Puckette's patcher at IRCAM in Paris, named for Max Mathews. Cycling '74 added MSP for real-time audio in 1997.<a v-no-focus class="credit" href="https://cycling74.com" target="_blank">cycling74.com</a></figcaption>
  </figure>
  <figure>
    <img src="/images/pure-data.png" alt="A Pure Data patch: metro objects send beats to four oscillators wired to dac~">
    <figcaption><b>Pure Data <span>1996</span></b>Puckette started over, open source this time, after IRCAM wouldn't let his Max work be shared.<a v-no-focus class="credit" href="https://puredata.info" target="_blank">puredata.info</a></figcaption>
  </figure>
  <figure>
    <img src="/images/noisecraft.png" alt="A large NoiseCraft patch: sequencers, synth voices and a reverb wired together">
    <figcaption><b>NoiseCraft <span>2021</span></b>Maxime Chevalier-Boisvert's patcher in the browser, built on Web Audio and Web MIDI.<a v-no-focus class="credit" href="https://noisecraft.app" target="_blank">noisecraft.app</a></figcaption>
  </figure>
</div>

<style>
.prior-art {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin-top: 2rem;
}

.prior-art figure {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* The screenshots have different shapes; each fits a box of the same size. */
.prior-art img {
  width: 100%;
  height: 14rem;
  object-fit: contain;
  object-position: left center;
}

.prior-art figcaption {
  color: var(--muted);
  font-size: var(--size-small);
  line-height: 1.4;
}

.prior-art .credit {
  display: block;
  margin-top: 0.4rem;
  border: 0;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.prior-art figcaption b {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--ink);
  font-size: var(--size-body);
}

.prior-art figcaption span {
  margin-left: 0.4em;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--size-small);
  font-weight: 400;
}
</style>

---

# Prior artists

<div class="artists">
  <div>
    <img src="/images/jamie-lidell.png" alt="Jamie Lidell beatboxing into a mic behind a table of mixers and cables">
    <b>Jamie Lidell</b>
    <p>Live looping before it was cool.</p>
    <a v-no-focus class="credit" href="https://www.youtube.com/watch?v=NW-rskTv-kw" target="_blank">From The Basement · YouTube</a>
  </div>
  <div>
    <img src="/images/imogen-heap.png" alt="Imogen Heap raising a hand in a Mi.Mu glove, wired to a computer">
    <b>Imogen Heap</b>
    <p>Amazing vocoder work. Also did a really cool thing with gloves.</p>
    <a v-no-focus class="credit" href="https://www.youtube.com/watch?v=ci-yB6EgVW4" target="_blank">Dezeen · YouTube</a>
  </div>
</div>

<style>
.artists {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 3rem;
  margin-top: 2rem;
}

.artists img {
  display: block;
  width: 100%;
  aspect-ratio: 2 / 1;
  object-fit: cover;
  border-radius: 10px;
  margin-bottom: 1rem;
}

.artists b {
  display: block;
  color: var(--ink);
  font-size: var(--size-body);
}

.artists p {
  margin: 0.5rem 0 0;
  color: var(--muted);
  font-size: var(--size-small);
  line-height: 1.4;
}

.artists .credit {
  display: block;
  margin-top: 0.4rem;
  border: 0;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.7rem;
}
</style>

---

# Pontifications

<ol class="pontify">
  <li>Creating music involves expressing ourselves through an interface</li>
  <li>Software (+ hardware integration) lets us build basically any interface we want. This is an opportunity to think critically about the interfaces we design!</li>
  <li>AI can build the tools. We still design them, master them, and make the music.</li>
  <li>A whole instrument can ship as one HTML file. The Web Audio API makes that possible.</li>
</ol>

<style>
.pontify {
  margin-top: 2rem;
  padding-left: 1.5rem;
}

.pontify li {
  margin-bottom: 1.25rem;
  padding-left: 0.5rem;
  color: var(--ink);
  font-size: var(--size-body);
  line-height: 1.4;
}

.pontify li::marker {
  color: var(--accent);
  font-family: var(--font-mono);
  font-weight: 700;
}
</style>
