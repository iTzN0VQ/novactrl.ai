novactrl.ai

NovaCTRL's site: the landing page, the Store Front (/store/, with EEV Telemetry at /eev-telemetry/), Mobile tools (/tools/), AI / SI Skills (/skills/, with Diamond System Intelligence at /dsi/) and White papers (/papers/). Static site on GitHub Pages: plain HTML, CSS and vanilla JS, no build step, no third-party requests.

## Adding a white paper

Make a folder under `papers/` named for the paper (for example `papers/vacuum-decay/`) with an `index.html` copied from any page here. Put the paper inside `<main><article class="paper"><div class="wrap">…</div></article></main>`: a `<header>` with `<time datetime="YYYY-MM-DD">` and the `<h1>`, an optional `<p class="standfirst">` summary, then the text in `<div class="paper-body">`. Then add it to the top of the list in `papers/index.html` (the comment there shows the markup); the "No papers yet" line disappears on its own once the list has an entry. Images go in the paper's folder, resized and with metadata stripped.

The FAQ is the last section of the home page (index.html, `#faq`); every footer links to it. Each question is a `<details class="faq-item">` with its `<summary>` and a `<div class="faq-a">` answer.
