# The Talisman — Karen, Nairobi

A four-page static site: **Home · Menu · Art & Events · Our Story**.
No build step, no dependencies, no framework. Open the files or serve the folder.

```bash
python3 -m http.server 8787      # → http://localhost:8787
```

---

## Structure

```
Talisman/
├── index.html          Home
├── menu.html           Our Food — summary + in-page PDF menu viewer
├── events.html         Art & Events — the programme, the art, music & DJs, private hire
├── our-story.html      Origins, timeline, values
├── vercel.json         Cache + security headers
└── assets/
    ├── css/talisman.css    Design system + every component (one file, numbered sections)
    ├── js/talisman.js      Every interaction (one file, no dependencies)
    ├── img/                Web-optimised photography
    └── menus/              Main / Beverages / Bar PDFs
```

**Home** — hero · about · food & beverages · parallax break band · three-box row
(Our Food / Our Story / Art & Events) · families · gallery · contact.

---

## Design system

Everything derives from tokens at the top of `talisman.css`.

| Token | Value | Use |
|---|---|---|
| `--paper` | `#FBF8F1` | Page ground |
| `--cream` | `#F5F1E8` | Alternating band |
| `--sand` | `#EDE7D9` | Panels |
| `--linen` | `#E2D9C6` | Hairlines |
| `--ink` | `#1B1614` | Headings — 16.1:1 |
| `--ink-2` | `#4A443C` | Body — 8.4:1 |
| `--ink-3` | `#6F6656` | Meta — 5.3:1 |
| `--wine` | `#6B222A` | Primary action — 10.6:1 |
| `--gold` | `#C99A5B` | **Ornament only on light** |
| `--night` | `#171310` | Footer, scrims |

**Gold is 2.4:1 on paper** — never use it for text on a light background, only rules,
dividers and numerals. On `--night` it reaches 7.1:1 and is used freely.

**Type** — Cormorant Garamond (display) + Karla (body), all fluid `clamp()` values.
**Spacing** — 4/8pt rhythm, plus `--gutter` and `--section`.

---

## Navigation

Floating glass pill. Over a dark hero it is translucent dark; past the hero it inverts to
frosted near-white (`.is-solid`). The switch point is computed from the actual hero height,
so it needs no per-page configuration.

Menu is a dropdown (Food / Beverages) that deep-links into the PDF viewer tabs via
`menu.html#food` and `menu.html#beverages`. Current page is marked with `aria-current`
**and** a gold diamond — never colour alone. Below 1080px everything collapses into a
full-screen sheet with a focus trap.

---

## Interactions (`talisman.js`)

All progressive enhancement — the site is fully readable with JavaScript off.

Scroll reveals · hero/band parallax · pointer tilt · menu scrollspy · form validation ·
in-page PDF viewer · nav dropdown · gallery carousel.

**Reveal safety net:** hiding is gated on a `.js` class set inline in `<head>`; if
`talisman.js` never boots, a 2.5s timer removes it and everything becomes visible. A broken
asset can never leave the page blank. Everything collapses under `prefers-reduced-motion`.

---

## The menus

PDFs in `assets/menus/` — Main, Beverages (wine, coffee, cocktails, alcohol-free) and Bar.
The viewer embeds them in an iframe and detects browsers that refuse inline PDFs (notably
iOS Safari), swapping in a direct link rather than showing an empty frame.

**Replace these with the kitchen's real PDFs — keep the filenames and nothing else changes.**

---

## Content that still needs the client

1. **All dishes and KSh prices in the PDFs are invented.** Written in the brand's voice
   around the known signatures, but not real. Do not publish as-is.
2. **The Our Story timeline** is deliberately undated so it reads true without asserting
   specific history.
3. `hello@` / `events@` addresses are assumed — confirm them.

**Photography:** originals live in `assets/April|June|March Shoot 2026/` and are
**git-ignored** — 2.2GB of 20–33MP camera files that must never be deployed. Only the
resized derivatives in `assets/img/` ship. Every photo is used at most twice.

Two uploads have **text burned in** (`garden-bowl.png` — Easter hours; `live-music.png` —
a dated poster) and are deliberately unused: baked-in text goes stale and can't reflow.

**Still missing:** a photograph of children in the garden, and a daytime wide shot of the
garden. Both are asserted in the copy but not shown.

---

## Deployment

GitHub: `kevinwekesa254/talisman` → Vercel project **talisman-karen**, which deploys
`main` automatically on every push. `vercel.json` sets a one-year immutable cache on
images, hourly revalidation on CSS/JS, `application/pdf` on the menus, and three security
headers.

> Note: the older `talisman1` Vercel project is linked to a **different** repo
> (`kevinwekesa254/talisman1`, manual uploads) and is not this site.

---

## WordPress conversion (not yet done)

Every page is the same shell, so the split is mechanical:

| Static | WordPress |
|---|---|
| Everything down to `<main>` | `header.php` |
| `.site-footer` + closing tags | `footer.php` |
| `index.html` `<main>` | `front-page.php` |
| the rest | `page-*.php` |
| `assets/` | `wp_enqueue_*` in `functions.php` |

- Replace the hard-coded nav with `wp_nav_menu()`; alias `.current-menu-item` onto the
  existing `[aria-current="page"]` rules so the gold diamond survives.
- `assets/…` → `<?php echo get_template_directory_uri(); ?>/assets/…` is the only
  find-and-replace needed in the body markup.
- Both forms simulate success in JS — point them at Contact Form 7 or an `admin-ajax`
  endpoint, keeping the existing markup and validation. Add a nonce/honeypot there.
