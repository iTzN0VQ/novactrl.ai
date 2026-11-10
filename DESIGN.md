# NovaCTRL design rules

The site and the app follow the same rules. Read this before changing either.

**The feel.** Apple-style simplicity with a modern edge: a white page, system type, big headers, generous space, one accent color. The page should look like a working tech made it, never like generic AI output.

**Motion.** Small and smooth. Use eased transitions of 0.2 to 0.35 s on color, opacity and transform only: a sliding indicator, a menu that fades and drops a few pixels, numbers that settle when they change. Nothing should animate in as you scroll. The one scroll effect is the home page logo's wet paint: its drips keep running as you scroll, and the drip off the end of the L in CTRL is the page's progress line, running down the right side of the screen with its bead where you are in the page. While it runs, the hero logo spans the whole column at every screen size, so the drip comes straight out of the L on a phone and on a desktop alike; the text leaves it a lane. CSS scroll timelines, no script. Everything turns off under prefers-reduced-motion.

**Color.** NovaCTRL's Inland filament colors are sprinkled in, never painted on (the values and their sources are at the top of css/site.css):
- ABS blue for anything you can press and for the low side.
- ABS silver for secondary text and quiet tints.
- ABS black and TPU black for text.
- Red only for the high side and warnings.

**Theme.** Always light: the white site, even when a phone or the Claude app is in dark mode. Every page sets `color-scheme: light`.

**Logos.** NovaCTRL, Store Front, Mobile Tools, AI / SI Skills, White Papers and EEV Telemetry each have a spray-paint logo, traced to SVG (assets/logo/). Use a logo as the title of its own page. Names inside a page, such as a skill like Diamond System Intelligence or a tool like the PT chart, stay in the regular system type.

**Navigation.** The global nav is the logo plus plain text links, in this order: Store Front, Tools, Skills, Papers. A page with sections gets an Apple-style local nav:
- the page name on the left;
- the sections or tools as plain text links, with a thin bar under the current one;
- one action on the right;
- on phones, the name opens the section list.

**Pages.** Each mobile tool has its own page under tools/, with tools/ itself as the index. Moving between pages uses the browser's view transitions: a short cross-fade, the headers held still, and the bar under the current tool gliding to the new one. Browsers without view transitions just load the page.

**Store Front.** The STORE FRONT logo centered as the title, like the Mobile tools and AI / SI Skills pages, then shelves of cards in the Apple Store's style: two-tone shelf titles, white cards with a soft shadow on the gray page, the whole card is the link and lifts 1% on hover. Product media fills the card's media area edge to edge (EEV Telemetry's card has its photo); a product with no media shows its logo. On phones a shelf with more than one card scrolls sideways.

**Photos.** Product renders from NovaCTRL only, never stock. They sit in the column with the cards' 18px corners, each a `<picture>` with WebP at 800, 1200 and 2000 px and a 1200 px JPEG, every bit of metadata stripped (assets/eev/, built by gen/build_eev_images.py). Set width and height, lazy-load anything below the first screen, and caption them with what the picture shows.

**FAQ.** One FAQ, at the bottom of the home page, with "What is a skill?" among the questions; every page's footer links to it. Answers state only what's true on the site today.

**Results.** Show results as type: a small label, a big number with a smaller unit, and a hairline above. Don't put them in tinted tiles.

**Don't use:**
- chip or pill rows as pickers;
- uppercase letter-spaced labels or eyebrows;
- cards with colored accent bars;
- glassmorphism beyond the one blurred nav;
- gradients, glows or emoji;
- count-up stats or scroll-triggered reveals;
- stock photos;
- slogan copy, and Inter or JetBrains Mono as the default faces.

**Copy.** Plain, specific, short sentences, in a technician's voice. Every number on the page must be true and sourced.
