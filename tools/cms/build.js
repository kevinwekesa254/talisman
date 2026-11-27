#!/usr/bin/env node
/* Builds the public site into dist/.

   1. Copies the site (pages, assets, robots, sitemap, admin) into dist/.
   2. Writes the saved content (content/*.json) into each page template.
   3. Adds the page-builder sections a page's `layout` lists (sections.js).

   renderPage(..., { edit: true }) keeps the editing marks and adds a content
   path to every editable element, for the admin's visual editor.

   `node tools/cms/build.js --init` creates any missing content files from the
   templates' current text, so the first build changes nothing on the page. */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const lib = require('./lib');
const { ROOT, CONTENT, PAGES, load, textToHtml, escapeHtml, escapeAttr, readSchema, readSeo, readJson } = lib;
const Sections = require('./sections');

const DIST = path.join(ROOT, 'dist');
const BASE = 'https://talisman-karen.vercel.app';
const args = process.argv.slice(2);
const INIT = args.includes('--init');

// What the templates say today. Site settings replace these wherever they appear.
const TEMPLATE_SITE = {
  phone: '+254 705 999 997',
  email: 'hello@talisman.co.ke',
  address_line_1: '320 Ngong Road, Karen',
  address_line_2: 'Nairobi, Kenya',
  instagram: 'https://www.instagram.com/talisman.nairobi/',
  facebook: 'https://www.facebook.com/talismanrestaurant'
};
const DEFAULT_SITE = Object.assign({}, TEMPLATE_SITE, {
  hours: [
    { label: 'Tuesday to Friday', days: ['Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '11:00', closes: '22:00' },
    { label: 'Saturday', days: ['Saturday'], opens: '09:00', closes: '21:00' },
    { label: 'Sunday', days: ['Sunday'], opens: '09:30', closes: '21:00' }
  ],
  closed_days: ['Monday']
});
const MENU_TABS = {
  'menu.html': ['tab-main', 'tab-breakfast', 'tab-tea'],
  'beverages.html': ['tab-coffee', 'tab-wine', 'tab-cocktails']
};
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SKIP = new Set(['node_modules', 'dist', 'content', 'tools', 'api', 'server', '.data', '.env', '.env.local', '.git', '.vercel', 'Talisman Website Images',
  'package.json', 'package-lock.json', 'README.md', '.gitignore', 'vercel.json', '.DS_Store']);

/* ---------------------------------------------------------------- helpers */
function write(p, s) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); }
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    if (SKIP.has(name) || name.startsWith('__')) continue;
    if (from !== ROOT || !name.endsWith('.html')) {
      const a = path.join(from, name), b = path.join(to, name);
      const st = fs.statSync(a);
      if (st.isDirectory()) {
        // Raw camera folders stay out of the build (see .gitignore)
        if (/ Shoot /.test(name)) continue;
        copyDir(a, b);
      } else {
        // Only copy what changed, so rebuilds while editing stay quick.
        let same = false;
        try { const d = fs.statSync(b); same = d.size === st.size && d.mtimeMs >= st.mtimeMs; } catch (e) {}
        if (!same) fs.copyFileSync(a, b);
      }
    }
  }
}
function imageSize(src) {
  try {
    const { imageSize } = require('image-size');
    const file = path.join(ROOT, decodeURI(src.replace(/^\//, '').split('?')[0]));
    return imageSize(fs.readFileSync(file));
  } catch (e) { return null; }
}
function time12(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  if (!m) return t || '';
  let h = +m[1]; const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12;
  return h + ':' + m[2] + ' ' + ap;
}
function plural(days) {
  const p = days.map(d => d + 's');
  return p.length > 1 ? p.slice(0, -1).join(', ') + ' and ' + p[p.length - 1] : p[0] || '';
}
function openRange(site) {
  const open = WEEK.filter(d => !(site.closed_days || []).includes(d));
  if (!open.length) return '';
  // Rotate the week so a closed day sits first, then a contiguous run reads "Tuesday to Sunday".
  const start = WEEK.findIndex((d, i) => open.includes(d) && !open.includes(WEEK[(i + 6) % 7]));
  const run = [];
  for (let i = 0; i < 7; i++) { const d = WEEK[(start + i) % 7]; if (open.includes(d)) run.push(d); else break; }
  if (run.length === open.length && run.length > 2) return run[0] + ' to ' + run[run.length - 1];
  return open.join(', ');
}

/* --------------------------------------------------------- default content */
function defaultsFor(page) {
  const schema = readSchema(page.file);
  const out = { seo: readSeo(schema.$) };
  const TurndownService = require('turndown');
  const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '*' });
  for (const s of schema.sections) {
    const v = {};
    s.fields.forEach(f => { v[f.key] = f.value; });
    s.lists.forEach(l => { v[l.key] = l.value; });
    s.rich.forEach(r => { v[r.key] = td.turndown(r.html).trim(); });
    out[s.key] = v;
  }
  return out;
}
function defaultMenus() {
  const out = {};
  for (const [file, ids] of Object.entries(MENU_TABS)) {
    const $ = load(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    ids.forEach(id => {
      const t = $('#' + id);
      out[id.replace('tab-', '')] = { pdf: t.attr('data-pdf'), pages: (t.attr('data-pages') || '').split(',').filter(Boolean).map(p => ({ image: p })) };
    });
  }
  return out;
}

/* ---------------------------------------------------------- apply content */
// Pictures are cached by browsers for a year, so each one gets a short
// fingerprint of its contents. Replacing a picture under the same name still
// shows the new one straight away.
const stamps = {};
function versioned(src) {
  if (!src || /^https?:/.test(src)) return src;
  const clean = src.split('?')[0];
  if (!(clean in stamps)) {
    try { stamps[clean] = require('crypto').createHash('sha1').update(fs.readFileSync(path.join(ROOT, decodeURI(clean.replace(/^\//, ''))))).digest('hex').slice(0, 8); }
    catch (e) { stamps[clean] = ''; }
  }
  return stamps[clean] ? clean + '?v=' + stamps[clean] : clean;
}
function swapPreload($, from, to) {
  $('link[rel="preload"][as="image"]').each((i, l) => { if ($(l).attr('href') === from) $(l).attr('href', to); });
}
function applyImage($, el, v, o) {
  const $el = $(el);
  const old = $el.attr('src');
  const src = v.src || old;
  const out = o.edit ? src : versioned(src);
  $el.attr('src', out);
  swapPreload($, old, out); // hero pictures are preloaded in <head>
  if (src !== old && !o.edit) {
    const dim = imageSize(src);
    if (dim) {
      $el.attr('width', dim.width).attr('height', dim.height);
      const fig = $el.closest('figure');
      const st = fig.attr('style') || '';
      if (/--r:/.test(st)) fig.attr('style', st.replace(/--r:\s*[\d.]+/, '--r:' + (dim.width / dim.height).toFixed(4)));
    }
  }
  $el.attr('alt', v.alt || '');
  const $source = $el.parent('picture').find('source[srcset]').first();
  if ($source.length) {
    const oldMob = $source.attr('srcset');
    const mob = o.edit ? (v.mobile_src || src) : versioned(v.mobile_src || src);
    $source.attr('srcset', mob);
    swapPreload($, oldMob, mob);
  }
}
function applyField($, el, type, v, o, pathName) {
  const $el = $(el);
  if (o.edit) $el.attr('data-cms-path', pathName);
  if (v === undefined || v === null) return;
  if (type === 'image') return applyImage($, el, v, o);
  if (type === 'link') { $el.html(textToHtml(v.label)); if (v.href) $el.attr('href', v.href); return; }
  if (type === 'label') return $el.html(escapeHtml(v));
  $el.html(textToHtml(v));
}
function fieldType($el) { return $el.is('img') ? 'image' : $el.is('a') ? 'link' : $el.is('button') ? 'label' : 'text'; }

function renderPage(page, content, site, menus, opts) {
  const o = opts || {};
  const $ = load(fs.readFileSync(path.join(ROOT, page.file), 'utf8'));
  const sections = content || {};

  $('[data-cms-section]').each((i, sec) => {
    const key = $(sec).attr('data-cms-section');
    if (o.edit) $(sec).attr('data-cms-sec', key).attr('data-cms-sec-label', $(sec).attr('data-cms-label') || key);
    const data = sections[key] || {};
    // Lists first: rebuild their items from the first item as a pattern.
    $(sec).find('[data-cms-list]').each((j, list) => {
      const lkey = $(list).attr('data-cms-list');
      let rows = data[lkey];
      if (!Array.isArray(rows)) { if (!o.edit) return; rows = null; }
      const pattern = $(list).children().first().clone();
      if (rows) $(list).empty();
      (rows || $(list).children().toArray().map(() => ({}))).forEach((row, n) => {
        const item = rows ? pattern.clone() : $($(list).children()[n]);
        item.find('[data-cms]').each((k, el) => applyField($, el, fieldType($(el)), row[$(el).attr('data-cms')], o, key + '.' + lkey + '.' + n + '.' + $(el).attr('data-cms')));
        if (rows) $(list).append(item);
      });
    });
    $(sec).find('[data-cms]').each((j, el) => {
      if ($(el).closest('[data-cms-list]').length) return;
      applyField($, el, fieldType($(el)), data[$(el).attr('data-cms')], o, key + '.' + $(el).attr('data-cms'));
    });
    $(sec).find('[data-cms-rich]').each((j, el) => {
      if (o.edit) $(el).attr('data-cms-path', key + '.' + $(el).attr('data-cms-rich'));
      const md = data[$(el).attr('data-cms-rich')];
      if (typeof md === 'string') $(el).html('\n' + marked.parse(md) + '\n');
    });
  });

  applyLayout($, content, o);

  // Menus (PDF + page pictures behind each tab)
  (MENU_TABS[page.file] || []).forEach(id => {
    const m = menus[id.replace('tab-', '')];
    if (!m) return;
    if (m.pdf) $('#' + id).attr('data-pdf', m.pdf);
    if (m.pages) $('#' + id).attr('data-pages', m.pages.map(p => p.image).filter(Boolean).join(','));
  });

  // Opening hours
  const rows = site.hours || [];
  const closed = site.closed_days || [];
  $('[data-cms-site="hours_footer"]').html(
    rows.map(r => escapeHtml(r.label) + ': ' + time12(r.opens) + ' to ' + time12(r.closes)).join('<br>') +
    (closed.length ? '<br><span style="opacity:.6">Closed ' + plural(closed) + '</span>' : ''));
  $('[data-cms-site="hours_grid"]').html('\n' +
    rows.map(r => '              <span>' + escapeHtml(r.label) + '</span><span>' + time12(r.opens) + ' to ' + time12(r.closes) + '</span>\n').join('') +
    closed.map(d => '              <span>' + d + '</span><span>Closed</span>\n').join('') + '            ');
  $('[data-cms-site="hours_inline"]').html(
    rows.map(r => escapeHtml(r.label) + ', ' + time12(r.opens) + ' to ' + time12(r.closes)).join(' &middot; ') +
    (closed.length ? ' &middot; Closed ' + plural(closed) : ''));
  const range = openRange(site);
  $('[data-cms-site="closed_note"]').html(escapeHtml((range ? range + '. ' : '') + (closed.length ? 'We are closed on ' + plural(closed) + '.' : '')));
  $('input[data-closed-days]').each((i, el) => {
    $(el).attr('data-closed-days', closed.map(d => DAYS.indexOf(d)).filter(n => n >= 0).join(','));
    $(el).attr('data-closed-message', 'We are closed on ' + plural(closed) + '.' + (range ? ' Please choose ' + range + '.' : ''));
  });

  // Search and sharing
  const seo = (content && content.seo) || {};
  const abs = p => (/^https?:/.test(p) ? p : BASE + '/' + String(p).replace(/^\//, ''));
  if (seo.title) {
    $('title').text(seo.title);
    $('meta[property="og:title"], meta[name="twitter:title"]').attr('content', seo.title);
  }
  if (seo.description) $('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]').attr('content', seo.description);
  if (seo.image) $('meta[property="og:image"], meta[name="twitter:image"]').attr('content', abs(seo.image));
  if (typeof seo.noindex === 'boolean') $('meta[name="robots"]').attr('content', seo.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large');

  // Structured data for search engines
  $('script[type="application/ld+json"]').each((i, s) => {
    let data; try { data = JSON.parse($(s).html()); } catch (e) { return; }
    const list = Array.isArray(data) ? data : [data];
    list.forEach(d => {
      if (d['@type'] === 'WebPage') { if (seo.title) d.name = seo.title; if (seo.description) d.description = seo.description; }
      if (d['@type'] === 'Restaurant') {
        d.telephone = site.phone.replace(/[^\d+]/g, '');
        d.email = site.email;
        d.sameAs = [site.instagram, site.facebook].filter(Boolean);
        d.openingHoursSpecification = rows.map(r => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: r.days, opens: r.opens, closes: r.closes }));
      }
      if (d['@type'] === 'WebSite' && seo.description) d.description = seo.description;
    });
    $(s).html(JSON.stringify(data));
  });

  // Editing marks are for the editor only
  if (o.edit) {
    $('head').prepend('<base href="/">');
    // The preview is shown from /admin/, so make page addresses absolute.
    const rel = v => v && !/^([a-z]+:|\/|#)/i.test(v);
    $('[src], [href], [srcset]').each((i, el) => {
      for (const a of ['src', 'href']) { const v = $(el).attr(a); if (rel(v)) $(el).attr(a, '/' + v); }
      const ss = $(el).attr('srcset');
      if (ss) $(el).attr('srcset', ss.split(',').map(p => { const t = p.trim(); return rel(t) ? '/' + t : t; }).join(', '));
    });
    $('body').append('<script src="/admin/frame.js"></script>');
  } else {
    $('*').each((i, el) => {
      for (const a of Object.keys(el.attribs || {})) if (a.startsWith('data-cms')) $(el).removeAttr(a);
    });
  }

  // Contact details and links that appear on every page
  let html = $.html();
  const swap = (from, to) => { if (from && to && from !== to) html = html.split(from).join(to); };
  const telOf = p => 'tel:' + String(p).replace(/[^\d+]/g, '');
  swap(telOf(TEMPLATE_SITE.phone), telOf(site.phone));
  swap(TEMPLATE_SITE.phone, escapeHtml(site.phone));
  swap('mailto:' + TEMPLATE_SITE.email, 'mailto:' + site.email);
  swap(TEMPLATE_SITE.email, escapeHtml(site.email));
  swap(TEMPLATE_SITE.instagram, escapeAttr(site.instagram));
  swap(TEMPLATE_SITE.facebook, escapeAttr(site.facebook));
  swap(TEMPLATE_SITE.address_line_1 + '<br>' + TEMPLATE_SITE.address_line_2, escapeHtml(site.address_line_1) + '<br>' + escapeHtml(site.address_line_2));
  return html;
}

/* ------------------------------------------------- page-builder sections */
// Reorders, hides and adds sections inside <main> from content.layout.
// Anything in <main> that isn't a section travels with the section before it.
function applyLayout($, content, o) {
  const layout = content && Array.isArray(content.layout) ? content.layout : null;
  if (!layout) return;
  const main = $('main').first();
  const groups = [];
  let cur = null;
  main.contents().each((i, node) => {
    const key = node.type === 'tag' ? $(node).attr('data-cms-section') : null;
    if (key) { cur = { key, nodes: [node] }; groups.push(cur); }
    else if (cur) cur.nodes.push(node);
    else groups.push({ key: null, nodes: [node] });
  });
  const byKey = {};
  groups.forEach(g => { if (g.key) byKey[g.key] = g; });
  const ctx = { edit: !!o.edit, src: o.edit ? null : versioned };
  const out = groups.filter(g => !g.key).map(g => ({ g }));  // leading whitespace etc.
  const seen = new Set();
  layout.forEach(entry => {
    if (entry && entry.key && byKey[entry.key] && !seen.has(entry.key)) {
      seen.add(entry.key);
      if (entry.hidden) {
        if (o.edit) { $(byKey[entry.key].nodes[0]).attr('data-cms-hidden', ''); out.push({ g: byKey[entry.key] }); }
        return;
      }
      out.push({ g: byKey[entry.key] });
    } else if (entry && entry.type && Sections.templates[entry.type]) {
      if (entry.hidden && !o.edit) return;
      let html = Sections.render(entry, ctx);
      if (entry.hidden) html = html.replace(/^<section /, '<section data-cms-hidden ');
      out.push({ html });
    }
  });
  // Sections added to a template after the layout was saved: keep them after
  // the section that comes before them in the template.
  groups.forEach((g, i) => {
    if (!g.key || seen.has(g.key)) return;
    let at = out.length;
    for (let j = i - 1; j >= 0; j--) {
      const k = out.findIndex(x => x.g === groups[j]);
      if (k >= 0) { at = k + 1; break; }
    }
    out.splice(at, 0, { g });
  });
  main.empty();
  out.forEach(x => {
    if (x.html) main.append('\n' + x.html + '\n');
    else x.g.nodes.forEach(n => main.append(n));
  });
}

/* -------------------------------------------------------------------- run */
function build() {
  const t0 = Date.now();
  fs.mkdirSync(path.join(CONTENT, 'pages'), { recursive: true });
  const sitePath = path.join(CONTENT, 'site.json');
  const menusPath = path.join(CONTENT, 'menus.json');
  if (INIT && !fs.existsSync(sitePath)) write(sitePath, JSON.stringify(DEFAULT_SITE, null, 2) + '\n');
  if (INIT && !fs.existsSync(menusPath)) write(menusPath, JSON.stringify(defaultMenus(), null, 2) + '\n');
  const site = Object.assign({}, DEFAULT_SITE, readJson(sitePath, {}));
  const menus = readJson(menusPath, defaultMenus());

  copyDir(ROOT, DIST);

  for (const page of PAGES) {
    const cPath = path.join(CONTENT, 'pages', page.name + '.json');
    if (INIT && !fs.existsSync(cPath)) write(cPath, JSON.stringify(defaultsFor(page), null, 2) + '\n');
    const content = readJson(cPath, null);
    write(path.join(DIST, page.file), renderPage(page, content, site, menus));
  }
  // The admin uses the same section templates for its library and preview.
  fs.copyFileSync(path.join(__dirname, 'sections.js'), path.join(DIST, 'admin', 'sections.js'));
  console.log('Built ' + PAGES.length + ' pages into dist/ in ' + (Date.now() - t0) + ' ms');
}

if (require.main === module) build();
function loadSite() { return Object.assign({}, DEFAULT_SITE, readJson(path.join(CONTENT, 'site.json'), {})); }
function loadMenus() { return readJson(path.join(CONTENT, 'menus.json'), null) || defaultMenus(); }

module.exports = { build, renderPage, loadSite, loadMenus, DEFAULT_SITE };
