# Talisman — Karen, Nairobi

A four-page static site for Talisman: **Home · Our Story · Menu · Events**.
Built light-theme, mobile-first, with a floating glass navigation, and structured so it
converts into a classic WordPress theme with almost no re-authoring.

---

## Run it

```bash
cd "Websites/Talisman"
python3 -m http.server 8787
# → http://localhost:8787
```

No build step, no dependencies. Open the HTML files directly if you prefer.

---

## Structure

```
Talisman/
├── index.html          Home — hero, ticker, 5 "chapters", reservation form
├── our-story.html      Origin story, timeline, values, quote
├── menu.html           8 menu sections + sticky scrollspy category nav
├── events.html         Live nights, spaces, weddings, process, enquiry form
├── assets/
│   ├── css/talisman.css    Design system + all components (one file, sectioned 1–19)
│   ├── js/talisman.js      All interactions (one file, no dependencies)
│   └── img/                12 photographs + logo
└── README.md
```

---

## Design system

Everything derives from tokens at the top of `talisman.css`. Change a token, the whole
site follows.

### Colour

| Token | Value | Use |
|---|---|---|
| `--paper` | `#FBF8F1` | Page ground |
| `--cream` | `#F5F1E8` | Alternating band |
| `--sand` | `#EDE7D9` | Panels, cards |
| `--linen` | `#E2D9C6` | Hairlines, dividers |
| `--ink` | `#1B1614` | Headings — 16.1:1 on paper |
| `--ink-2` | `#4A443C` | Body — 8.4:1 |
| `--ink-3` | `#6F6656` | Eyebrows, meta — 5.3:1 |
| `--wine` | `#6B222A` | Primary action — 10.6:1 |
| `--gold` | `#C99A5B` | **Ornament only on light** |
| `--night` | `#171310` | Footer, image scrims |

**One rule worth keeping:** gold is only 2.4:1 on paper, so it is never used for text on a
light background — only rules, dividers, ornaments and numerals. On `--night` it reaches
7.1:1 and is used freely. Every text pair in the site passes WCAG AA.

### Type

**Cormorant Garamond** (display) + **Karla** (body) — carried over from the reference site.
All sizes are fluid `clamp()` values on a single scale (`--t-display` → `--t-eyebrow`),
so nothing needs media queries to resize.

### Spacing

4/8pt rhythm (`--s-1` … `--s-10`), plus `--gutter` and `--section` for page rhythm.

---

## The floating nav

A pill that inverts as you scroll:

- **Over a dark hero** — translucent dark glass, `backdrop-filter: blur(16px)`, cream text.
- **After scrolling past the hero** (`.is-solid`) — frosted near-white glass, ink text, soft shadow.

The JS computes the switch point from the actual hero/pagehead height, so it works on
every page without per-page configuration. Any page without a dark hero can just get
`class="nav nav--light"` and it starts solid.

Current page is marked with `aria-current="page"` **and** a small gold diamond — never
colour alone.

Below 1080px the links collapse into a hamburger that opens a full-screen cream sheet
with a focus trap, Escape-to-close, and staggered link entrances.

---

## Interactions (`talisman.js`)

All progressive enhancement — the site is fully readable with JavaScript off.

| Feature | Notes |
|---|---|
| Scroll reveals | IntersectionObserver, 70ms stagger within a group. Anything above the fold at load reveals instantly. |
| Hero + band parallax | rAF-batched on a single shared scroll listener. |
| Pointer tilt | Image cards only, `pointer: fine` only. |
| Menu scrollspy | Highlights the active category in the sticky pill nav. |
| Form validation | Validates on blur, re-validates live once dirty, focuses the first bad field on submit. |

**Reveal safety net:** hiding is gated on a `.js` class set by a small inline script in
`<head>`. If `talisman.js` fails to load, a 2.5s timer removes the class and everything
becomes visible. A broken asset can never leave the page blank.

Everything collapses under `prefers-reduced-motion: reduce`.

---

## Accessibility

- Skip link, visible focus rings (never removed), logical heading order.
- All form inputs have **visible** labels, helper text, inline errors with `role="alert"`, and correct `inputmode`/`autocomplete`.
- Touch targets ≥44px; buttons go full-width under 560px.
- Nav sheet is a real `role="dialog"` with `aria-modal`, focus trap and Escape.
- Landscape phones get a special hero rule so `100svh` doesn't swallow the screen.
- `menu.html` has a print stylesheet — it prints as a clean menu with no chrome.

---

## Content that still needs the client

Two things are written as **plausible placeholder copy** and should be replaced before
launch. Everything else is either from the reference site or safely generic.

1. **`menu.html` — all dishes, descriptions and prices.** Written to match the brand's
   voice and the known signatures (in-house smoked salmon, feta & coriander samosas, the
   Dawa), but the dishes and the KSh prices are invented. Do not publish these as real.
2. **`our-story.html` — the timeline.** Deliberately written without dates or named
   people, so it reads true without asserting specific history. Add real dates when you have them.

Contact details (`+254 705 999 997`, `@talisman.nairobi`, Ngong Road/Karen, Tue–Sun
8:00–23:00) came from the reference site. `hello@` and `events@` addresses are assumed —
confirm them.

Images are the 12 photographs recovered from the reference build. Swap in the client's
library when you share it; filenames are descriptive so replacement is a drop-in.

---

## WordPress conversion

The markup was written for this. Every page is the same shell:

```
<head> … </head>
<body>
  inline boot script
  skip link
  .nav  +  .nav-sheet        ← header.php
  <main> … page content … </main>   ← page-*.php
  .site-footer               ← footer.php
  <script talisman.js>
</body>
```

### Mapping

| Static | WordPress |
|---|---|
| Everything down to `<main>` | `header.php` |
| `.site-footer` + closing tags | `footer.php` |
| `index.html` `<main>` | `front-page.php` |
| `our-story.html` `<main>` | `page-our-story.php` |
| `menu.html` `<main>` | `page-menu.php` |
| `events.html` `<main>` | `page-events.php` |
| `assets/` | `wp_enqueue_style` / `wp_enqueue_script` in `functions.php` |

### Notes for the conversion

- **Nav** — replace the hard-coded `<ul>` with `wp_nav_menu()` on a `primary` location. WordPress emits `.current-menu-item`; add that as an alias for the existing `[aria-current="page"]` rules so the gold diamond keeps working. The sheet uses the same menu with a different `walker`/class.
- **Asset paths** — `assets/…` becomes `<?php echo get_template_directory_uri(); ?>/assets/…`. That is the only find-and-replace needed in the body markup.
- **Menu items** — the best fit is a `dish` custom post type with a `menu_section` taxonomy and post meta for price/tags, looped into the existing `.dish` markup. Then the kitchen edits the menu without touching code, and the sticky category nav can be generated from the taxonomy terms.
- **Events** — a `live_night` CPT with a date field feeds the `.schedule` rows.
- **Forms** — both forms currently simulate success in JS. Point them at Contact Form 7 or WPForms, or an `admin-ajax`/REST endpoint; keep the existing markup and validation and just replace the `setTimeout` in section 7 of `talisman.js` with a real `fetch`. Add a honeypot/nonce at that point.
- **Fonts** — currently loaded from Google Fonts. For Kenyan visitors on slower connections, consider self-hosting the woff2 files in `assets/fonts/` and dropping the two `preconnect` links.
- No page uses a WordPress-hostile pattern: no build step, no CSS framework, no JS framework, no inline `<style>` blocks that would fight the theme.

---

## Update — the Menu page is now "Our Food"

`menu.html` no longer lists dishes inline. It is now:

1. **A short summary** of how the kitchen works, with a three-figure strip (05:30 / one fire / six sections).
2. **An in-page PDF viewer.** "View our menus" expands a panel with three tabs — Main Dishes, Beverages, Bar Menu — each embedding a PDF via an iframe. Nothing opens in a new tab.
3. **Three alternating image/text chapters** — Our Farmers, Sourced then slowly prepared, By the time it reaches your table.
4. **A full-bleed garden closing section.**

### The PDFs

Live in `assets/menus/`. They were generated from the dish copy that used to be inline, so no
content was lost:

| File | Contents |
|---|---|
| `talisman-main-menu.pdf` | Brunch, To Begin, From the Fire, Mains, From the Garden, Desserts |
| `talisman-beverages.pdf` | Coffee, Tea & Tisanes, Cold & Alcohol-Free, For the Children |
| `talisman-bar-menu.pdf` | Signature Cocktails, Classics, Wine, Beer & Spirits |

**Replace these with the kitchen's real PDFs** — keep the filenames and nothing else needs to change.
The viewer detects browsers that refuse inline PDFs (notably iOS Safari) and swaps in a direct link
rather than showing an empty frame.

### Image slots still needing real photographs

Four slots in `menu.html` are marked with `<!-- SLOT: ... -->` comments:

| Slot | Currently showing | Wants |
|---|---|---|
| `farmers` | `farm-brunch.jpg` | The farmers / farm photograph |
| `smokehouse` | `dawa-martini.jpg` | The salmon-smoking photograph |
| `plated dish on table` | `hero-garden-brunch.jpg` | The dish-on-table photograph |
| `garden` | `cocktail-greens.jpg` | The wide garden photograph |

Because of these stand-ins, `farm-brunch.jpg` and `cocktail-greens.jpg` are each used **three**
times site-wide instead of the two-use maximum. Dropping in the four real photographs above
returns every image to two uses or fewer.
