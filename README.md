# The Talisman — Karen, Nairobi

A static site: **Home · Menu · Beverages · Art & Events · Our Story**, plus legal,
thank-you and 404 pages, with an admin at `/admin` (bookings, customers,
page builder, team).

```bash
npm install
npm run dev      # site → http://localhost:8788   admin → http://localhost:8788/admin/
npm run build    # writes the public site to dist/ (what Vercel serves)
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

## Admin (`/admin`)

One place for the team: **Dashboard · Bookings · Customers · Pages ·
Pictures · Menus · Contact and hours · Team**.

- **Bookings.** The booking form on the home page posts to `/api/book`. Each request is
  saved, the guest is added to Customers, and (if email is connected) the team gets an
  email. Staff confirm, seat, cancel or mark no-shows; "Confirm on WhatsApp" opens
  WhatsApp with a ready message. Phone and walk-in bookings can be added by hand.
- **Customers.** Built from bookings, keyed by phone number. Tags, notes, CSV export,
  and "Delete" removes a person and all their bookings (data-protection requests).
- **Pages.** A visual editor: the page is shown live; click any text, picture or button
  to edit it. Sections can be added from templates (`tools/cms/sections.js`), moved,
  hidden and removed. Drafts autosave; *Publish* writes `content/pages/<page>.json`.
  SEO tab: title, description, share picture, search-engine visibility, checks.
- **Team.** Roles: Admin, Manager, Website editor, Front desk. Admins add
  people and get a one-time password to pass on.

**How pages are built.** The root `.html` files are templates. Editable elements carry
`data-cms…` attributes; saved values live in `content/` (one JSON per page, plus
`site.json` and `menus.json`). A page's optional `layout` list sets section order,
hidden sections and added template sections. `tools/cms/build.js` writes it all into
`dist/`. To make a new element editable, give it `data-cms="key" data-cms-label="Label"`
inside a `data-cms-section`; it shows up in the editor straight away.

**Code.** `admin/` (Preact + htm, no build step, vendored in `admin/vendor/`),
`server/` (API: `api.js`, storage `store.js`, saving files `files.js`, booking
emails `messages.js`), `api/` (the two Vercel functions).

**On this computer** (`npm run dev`) everything runs in test mode: data is kept in
`.data/` (git-ignored), and pages and pictures save into this folder.
The first visit to `/admin` asks you to create the first admin account.
Sample bookings can be loaded from the dashboard.

### Admin: going live (one-time)

In Vercel → talisman-karen:

1. **Storage → Create → Upstash for Redis** (free tier), connect it to the project. This
   sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Bookings, customers and team live here.
2. **Settings → Environment Variables:**
   - `SESSION_SECRET`: a long random string (`openssl rand -hex 32`).
   - `ADMIN_SETUP_CODE`: any word; needed once to create the first admin account.
   - `GITHUB_TOKEN`: a fine-grained token for `kevinwekesa254/talisman` with
     *Contents: read and write*. Publishing commits to `main`, and Vercel redeploys.
   - `NOTIFY_EMAIL`: where new table requests are emailed (optional).
   - `BREVO_API_KEY` and `EMAIL_FROM` (e.g. `The Talisman <hello@talisman.co.ke>`, a
     sender verified in Brevo): sends the booking emails (optional).
3. Redeploy, open `/admin`, create the first account with the setup code, then add the
   team from **Team**.

Until step 1 is done the live booking form shows "could not send, please call us",
so connect storage before (or with) the first deploy of this version.

## Deployment

GitHub: `kevinwekesa254/talisman` → Vercel project **talisman-karen**, which deploys
`main` automatically on every push. Vercel runs `npm run build` and serves `dist/`;
`api/admin.js` and `api/book.js` are the admin and booking form functions. `vercel.json` sets a one-year immutable cache on
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
