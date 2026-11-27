/* Shared pieces for the content editor (CMS) and the build.

   How it fits together
   --------------------
   The .html files in the project root are templates. Elements an editor may
   change carry data attributes:

     <section data-cms-section="about" data-cms-label="Our Story">
       <h2 data-cms="heading" data-cms-label="Heading">…</h2>
       <img data-cms="image" data-cms-label="Image" src="…" alt="…">
       <ol data-cms-list="milestones" data-cms-label="Milestones"> <li>…</li> </ol>
     </section>
     <div data-cms-rich="body">…</div>          long text written in Markdown
     <p data-cms-site="hours_footer">…</p>      filled from Site settings

   readSchema() turns those attributes into a list of sections and fields,
   with the template's own content as the default values. build.js writes the
   saved content (content/*.json) back into the templates, and also writes
   the editor's config.yml from the same schema, so the editor always matches
   the pages. */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = path.resolve(__dirname, '..', '..');
const CONTENT = path.join(ROOT, 'content');

const PAGES = [
  { file: 'index.html',     name: 'home',      label: 'Home' },
  { file: 'menu.html',      name: 'menu',      label: 'Menu' },
  { file: 'beverages.html', name: 'beverages', label: 'Beverages' },
  { file: 'events.html',    name: 'events',    label: 'Art & Events' },
  { file: 'our-story.html', name: 'our-story', label: 'Our Story' },
  { file: 'privacy.html',   name: 'privacy',   label: 'Privacy Policy' },
  { file: 'terms.html',     name: 'terms',     label: 'Terms of Use' },
  { file: 'thank-you.html', name: 'thank-you', label: 'Thank-you page' },
  { file: '404.html',       name: '404',       label: 'Page not found (404)' }
];

function load(html) {
  // htmlparser2 mode keeps the source almost byte-for-byte (entities,
  // whitespace, attribute order), so templates and output stay diff-friendly.
  return cheerio.load(html, { xml: { xmlMode: false, decodeEntities: false, emptyAttrs: true } });
}

/* ---- Inline text <-> HTML ------------------------------------------------
   Editors write plain text. *word* is italic, **word** is bold,
   [words](link) is a link and a new line is a line break. */

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', mdash: '—', ndash: '–', hellip: '…', middot: '·',
  copy: '©', eacute: 'é', egrave: 'è', times: '×', rarr: '→', larr: '←' };

function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (m, e) {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return Object.prototype.hasOwnProperty.call(ENT, e.toLowerCase()) ? ENT[e.toLowerCase()] : m;
  });
}
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

// Returns null when the HTML holds something the plain-text format can't express.
function htmlToText(html) {
  var ok = true;
  var out = html
    .replace(/\s+/g, ' ')
    .replace(/<br\s*\/?>\s*/gi, '\n')
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<a href="([^"]*)">([\s\S]*?)<\/a>/gi, '[$2]($1)');
  if (/<[a-z\/!]/i.test(out)) ok = false;
  out = decode(out).split('\n').map(function (l) { return l.trim(); }).join('\n').trim();
  return ok ? out : null;
}

function textToHtml(text) {
  return escapeHtml(String(text == null ? '' : text).trim())
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, h) { return '<a href="' + h.replace(/"/g, '&quot;') + '">' + t + '</a>'; })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\r?\n/g, '<br>');
}

/* ---- Reading the schema out of a template ------------------------------- */

function fieldType($el) {
  if ($el.is('img')) return 'image';
  if ($el.is('a')) return 'link';
  if ($el.is('button')) return 'label';
  return 'text';
}

function readField($, el) {
  var $el = $(el);
  var type = fieldType($el);
  var f = { key: $el.attr('data-cms'), label: $el.attr('data-cms-label') || $el.attr('data-cms'), type: type };
  if (type === 'image') {
    f.value = { src: $el.attr('src') || '', alt: decode($el.attr('alt') || '') };
    var $src = $el.parent('picture').find('source[srcset]').first();
    if ($src.length) { f.mobile = true; f.value.mobile_src = $src.attr('srcset'); }
  } else if (type === 'link') {
    f.value = { label: htmlToText($el.html()) || '', href: $el.attr('href') || '' };
  } else if (type === 'label') {
    f.value = htmlToText($el.html()) || '';
  } else {
    f.value = htmlToText($el.html());
    f.long = $el.is('p, blockquote') && f.value.length > 60;
  }
  return f;
}

function readSchema(file) {
  var html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  var $ = load(html);
  var sections = [];
  $('[data-cms-section]').each(function (i, sec) {
    var s = { key: $(sec).attr('data-cms-section'), label: $(sec).attr('data-cms-label'), fields: [], lists: [], rich: [] };
    // Fields that belong to a list are read with the list, not on their own.
    $(sec).find('[data-cms]').each(function (j, el) {
      if (!$(el).closest('[data-cms-list]').length) s.fields.push(readField($, el));
    });
    $(sec).find('[data-cms-list]').each(function (j, list) {
      var items = $(list).children().toArray();
      var l = { key: $(list).attr('data-cms-list'), label: $(list).attr('data-cms-label'), item: $(list).attr('data-cms-item') || 'Item', fields: [], value: [] };
      items.forEach(function (item, n) {
        var row = {};
        $(item).find('[data-cms]').each(function (k, el) {
          var f = readField($, el);
          if (n === 0) l.fields.push(f);
          row[f.key] = f.value;
        });
        l.value.push(row);
      });
      s.lists.push(l);
    });
    $(sec).find('[data-cms-rich]').each(function (j, el) {
      s.rich.push({ key: $(el).attr('data-cms-rich'), label: $(el).attr('data-cms-label') || 'Body', html: $(el).html() });
    });
    sections.push(s);
  });
  return { $: $, html: html, sections: sections };
}

/* ---- SEO fields, read from the <head> ------------------------------------ */
function readSeo($) {
  var img = $('meta[property="og:image"]').attr('content') || '';
  return {
    title: decode($('title').text()),
    description: decode($('meta[name="description"]').attr('content') || ''),
    image: img.replace(/^https?:\/\/[^/]+\//, ''),
    noindex: /noindex/.test($('meta[name="robots"]').attr('content') || '')
  };
}

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
}

module.exports = { ROOT, CONTENT, PAGES, load, decode, escapeHtml, escapeAttr, htmlToText, textToHtml, readSchema, readSeo, readJson };
