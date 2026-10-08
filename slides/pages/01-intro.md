---
layout: cover
# PLACEHOLDER(refine): title slide text and layout
---

# Web Audio API

Build your musical dreams!

<div class="byline">Reed Perkins · Utah JS</div>

<style>
.byline {
  margin-top: 3rem;
  font-size: var(--size-small);
  color: var(--muted);
}
</style>

---

# What is Web Audio?

<ul class="idea">
  <li>A set of JS APIs for wiring up <b>audio graphs</b>: sources → processors → speakers.</li>
  <li>The browser runs the graph on its <b>own audio thread</b>, separate from your JavaScript.</li>
</ul>

<AudioGraph class="mt-12" />

<style>
.idea li {
  margin-bottom: 0.75rem;
  line-height: 1.4;
}
</style>
