/* Section templates for the page builder.

   Used in two places: the build (Node) writes these into the pages, and the
   admin (browser) shows them in the "Add section" library and renders a live
   preview. Each template lists its fields, its starting content and a small
   wireframe drawing for the library.

   A page's content file can hold a `layout` list. Entries are either a
   built-in section ({ "key": "about", "hidden": false }) or one of these
   templates ({ "id": "s1a2b", "type": "split", "data": { ... } }). */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TalismanSections = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // *italic*, **bold**, [words](link), new line = line break
  function inline(text) {
    return esc(String(text == null ? '' : text).trim()).replace(/&quot;/g, '"')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, h) { return '<a href="' + h.replace(/"/g, '&quot;') + '">' + t + '</a>'; })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\r?\n/g, '<br>');
  }

  /* ---- wireframes: 160 x 100 drawings, light grey on white ---- */
  var W = {
    box: function (x, y, w, h, r) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (r || 2) + '" fill="#D9DCE6"/>'; },
    img: function (x, y, w, h) {
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="#C9CEDD"/>' +
        '<path d="M' + (x + w * .2) + ' ' + (y + h * .78) + 'l' + (w * .22) + ' -' + (h * .3) + 'l' + (w * .16) + ' ' + (h * .18) + 'l' + (w * .1) + ' -' + (h * .1) + 'l' + (w * .14) + ' ' + (h * .22) + 'z" fill="#AEB5C9"/>' +
        '<circle cx="' + (x + w * .72) + '" cy="' + (y + h * .3) + '" r="' + Math.min(w, h) * .08 + '" fill="#AEB5C9"/>';
    },
    line: function (x, y, w, dark) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (dark ? 6 : 3) + '" rx="1.5" fill="' + (dark ? '#9AA2B8' : '#D9DCE6') + '"/>'; },
    btn: function (x, y) { return '<rect x="' + x + '" y="' + y + '" width="30" height="9" rx="4.5" fill="#6E7BF2"/>'; },
    svg: function (inner, bg) { return '<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="' + (bg || '#F6F7FB') + '"/>' + inner + '</svg>'; }
  };

  var IMG = function (src, alt) { return { src: src, alt: alt }; };
  var SIDE = { key: 'side', label: 'Picture side', type: 'select', options: [['right', 'Picture on the right'], ['left', 'Picture on the left']] };
  var BG = { key: 'background', label: 'Background', type: 'select', options: [['paper', 'Light'], ['cream', 'Cream'], ['dark', 'Dark']] };

  function bgClass(d) { return d.background === 'cream' ? ' section--cream' : d.background === 'dark' ? ' blk--dark on-dark' : ''; }
  function p(ctx, path) { return ctx.edit ? ' data-cms-path="' + esc(path) + '"' : ''; }
  function img(ctx, path, v, cls, sizes) {
    v = v || {};
    if (!v.src) return '<div class="blk__ph"' + p(ctx, path) + '>Add a picture</div>';
    return '<img class="' + (cls || '') + '" src="' + esc(ctx.src ? ctx.src(v.src) : v.src) + '" alt="' + esc(v.alt) + '" loading="lazy" decoding="async"' + (sizes ? ' sizes="' + sizes + '"' : '') + p(ctx, path) + '>';
  }
  function link(ctx, path, v, cls) {
    if (!v || !v.label) return '';
    return '<a class="' + cls + '" href="' + esc(v.href || '#') + '"' + p(ctx, path) + '>' + inline(v.label) + '</a>';
  }
  function text(ctx, tag, path, v, cls) {
    if (!v && !ctx.edit) return '';
    return '<' + tag + (cls ? ' class="' + cls + '"' : '') + p(ctx, path) + '>' + inline(v) + '</' + tag + '>';
  }

  var T = {};

  T.split = {
    label: 'Picture and words', group: 'Story',
    description: 'A photo beside a heading, a paragraph and a button.',
    wireframe: W.svg(W.img(88, 14, 60, 72) + W.line(12, 26, 22) + W.line(12, 36, 58, true) + W.line(12, 46, 46, true) + W.line(12, 58, 64) + W.line(12, 64, 60) + W.line(12, 70, 50) + W.btn(12, 80)),
    fields: [
      { key: 'eyebrow', label: 'Small label', type: 'text' },
      { key: 'heading', label: 'Heading', type: 'longtext' },
      { key: 'text', label: 'Text', type: 'longtext' },
      { key: 'button', label: 'Button', type: 'link' },
      { key: 'image', label: 'Picture', type: 'image' },
      SIDE, BG
    ],
    defaults: { eyebrow: 'From the garden', heading: 'A new heading\n*in two lines.*', text: 'Write a few sentences here. Keep it short and specific, the way the rest of the site reads.', button: { label: 'See the menus', href: 'menu.html' }, image: IMG('/assets/img/story-guest-cocktail.jpg', 'A guest laughing over cocktails at Talisman'), side: 'right', background: 'paper' },
    render: function (d, ctx, id) {
      var a = '@' + id + '.';
      return '<section class="section blk blk-split' + (d.side === 'left' ? ' blk-split--left' : '') + bgClass(d) + '">' +
        '<div class="wrap blk-split__grid">' +
        '<div class="blk-split__words" data-reveal>' + text(ctx, 'p', a + 'eyebrow', d.eyebrow, 'eyebrow eyebrow--wine') + text(ctx, 'h2', a + 'heading', d.heading) +
        text(ctx, 'p', a + 'text', d.text, 'blk__text') + link(ctx, a + 'button', d.button, 'btn btn--primary') + '</div>' +
        '<figure class="blk-split__media" data-reveal>' + img(ctx, a + 'image', d.image, '', '(min-width: 900px) 50vw, 100vw') + '</figure>' +
        '</div></section>';
    }
  };

  T.banner = {
    label: 'Full-width picture', group: 'Pictures',
    description: 'A wide photo with a heading on top. Good between two text sections.',
    wireframe: W.svg(W.img(0, 0, 160, 100) + '<rect width="160" height="100" fill="#1b1614" opacity=".25"/>' + W.line(40, 40, 80, true) + W.line(52, 50, 56, true) + W.btn(65, 64)),
    fields: [
      { key: 'image', label: 'Picture', type: 'image' },
      { key: 'heading', label: 'Heading', type: 'longtext' },
      { key: 'text', label: 'Text', type: 'longtext' },
      { key: 'button', label: 'Button', type: 'link' }
    ],
    defaults: { image: IMG('/assets/img/evening-lamplight.jpg', 'Friends dining by lamplight in the Talisman garden'), heading: 'Evenings in\n*the garden.*', text: '', button: { label: '', href: '' } },
    render: function (d, ctx, id) {
      var a = '@' + id + '.';
      return '<section class="blk blk-banner on-dark">' + img(ctx, a + 'image', d.image, 'blk-banner__img', '100vw') +
        '<div class="wrap blk-banner__inner" data-reveal>' + text(ctx, 'h2', a + 'heading', d.heading) + text(ctx, 'p', a + 'text', d.text, 'blk__text') +
        link(ctx, a + 'button', d.button, 'btn btn--primary') + '</div></section>';
    }
  };

  T.statement = {
    label: 'Statement or quote', group: 'Story',
    description: 'One large sentence in the middle of the page, with a short line under it.',
    wireframe: W.svg(W.line(30, 30, 100, true) + W.line(40, 42, 80, true) + W.line(56, 54, 48, true) + W.line(62, 70, 36)),
    fields: [
      { key: 'eyebrow', label: 'Small label', type: 'text' },
      { key: 'quote', label: 'Statement', type: 'longtext' },
      { key: 'by', label: 'Line under it', type: 'text' },
      BG
    ],
    defaults: { eyebrow: '', quote: '“A place that feels like\n*someone’s home.*”', by: 'A guest, 2024', background: 'cream' },
    render: function (d, ctx, id) {
      var a = '@' + id + '.';
      return '<section class="section blk blk-statement' + bgClass(d) + '"><div class="wrap wrap--narrow center" data-reveal>' +
        text(ctx, 'p', a + 'eyebrow', d.eyebrow, 'eyebrow eyebrow--wine') + text(ctx, 'p', a + 'quote', d.quote, 'blk-statement__quote') +
        text(ctx, 'p', a + 'by', d.by, 'blk-statement__by') + '</div></section>';
    }
  };

  T.cards = {
    label: 'Three pictures with captions', group: 'Pictures',
    description: 'Three highlights side by side: a dish, an event, a room.',
    wireframe: W.svg(W.line(12, 12, 50, true) + [10, 58, 106].map(function (x) { return W.img(x, 26, 44, 40) + W.line(x, 72, 34, true) + W.line(x, 82, 40) + W.line(x, 88, 30); }).join('')),
    fields: [
      { key: 'eyebrow', label: 'Small label', type: 'text' },
      { key: 'heading', label: 'Heading', type: 'longtext' },
      { key: 'items', label: 'Cards', type: 'list', item: 'card', fields: [
        { key: 'image', label: 'Picture', type: 'image' },
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'text', label: 'Text', type: 'longtext' }
      ] },
      BG
    ],
    defaults: { eyebrow: 'This season', heading: 'Three things\n*worth the drive.*', background: 'paper', items: [
      { image: IMG('/assets/img/cuisine-fish-wine.jpg', 'Fish on a golden purée with white wine'), title: 'From the grill', text: 'A line about the dish.' },
      { image: IMG('/assets/img/cuisine-sashimi.jpg', 'Tuna sashimi with pickled ginger'), title: 'House-cured', text: 'A line about the dish.' },
      { image: IMG('/assets/img/cuisine-bowl-window.jpg', 'A leafy bowl in the window light'), title: 'From the farm', text: 'A line about the dish.' }
    ] },
    render: function (d, ctx, id) {
      var a = '@' + id + '.';
      var items = (d.items || []).map(function (it, i) {
        var b = a + 'items.' + i + '.';
        return '<article class="blk-cards__item" data-reveal>' + '<figure class="blk-cards__media">' + img(ctx, b + 'image', it.image, '', '(min-width: 900px) 33vw, 100vw') + '</figure>' +
          text(ctx, 'h3', b + 'title', it.title) + text(ctx, 'p', b + 'text', it.text, 'blk__text') + '</article>';
      }).join('');
      return '<section class="section blk blk-cards' + bgClass(d) + '"><div class="wrap">' +
        '<div class="blk__head" data-reveal>' + text(ctx, 'p', a + 'eyebrow', d.eyebrow, 'eyebrow eyebrow--wine') + text(ctx, 'h2', a + 'heading', d.heading) + '</div>' +
        '<div class="blk-cards__grid">' + items + '</div></div></section>';
    }
  };

  T.gallery = {
    label: 'Picture grid', group: 'Pictures',
    description: 'A grid of photos. Add as many as you like.',
    wireframe: W.svg(W.line(12, 10, 46, true) + W.img(10, 22, 68, 36) + W.img(82, 22, 32, 36) + W.img(118, 22, 32, 36) + W.img(10, 62, 32, 32) + W.img(46, 62, 32, 32) + W.img(82, 62, 68, 32)),
    fields: [
      { key: 'heading', label: 'Heading', type: 'longtext' },
      { key: 'items', label: 'Pictures', type: 'list', item: 'picture', fields: [{ key: 'image', label: 'Picture', type: 'image' }] },
      BG
    ],
    defaults: { heading: 'A look\n*around.*', background: 'paper', items: [
      { image: IMG('/assets/img/home-hero-gazebos.jpg', 'Thatched gazebos in the garden') },
      { image: IMG('/assets/img/evening-lamplight.jpg', 'Dining by lamplight') },
      { image: IMG('/assets/img/story-guest-cocktail.jpg', 'A guest with a cocktail') },
      { image: IMG('/assets/img/cuisine-sashimi.jpg', 'Tuna sashimi') },
      { image: IMG('/assets/img/cuisine-fish-wine.jpg', 'Fish with white wine') }
    ] },
    render: function (d, ctx, id) {
      var a = '@' + id + '.';
      var items = (d.items || []).map(function (it, i) {
        return '<figure class="blk-gallery__item" data-reveal>' + img(ctx, a + 'items.' + i + '.image', it.image, '', '(min-width: 900px) 33vw, 50vw') + '</figure>';
      }).join('');
      return '<section class="section blk blk-gallery' + bgClass(d) + '"><div class="wrap">' +
        '<div class="blk__head" data-reveal>' + text(ctx, 'h2', a + 'heading', d.heading) + '</div>' +
        '<div class="blk-gallery__grid">' + items + '</div></div></section>';
    }
  };

  T.columns = {
    label: 'Two columns of text', group: 'Text',
    description: 'A heading with two columns of writing. Good for details and policies.',
    wireframe: W.svg(W.line(12, 14, 60, true) + W.line(12, 24, 40, true) + [0, 1, 2, 3, 4, 5].map(function (i) { return W.line(12, 42 + i * 8, 62) + W.line(86, 42 + i * 8, 62); }).join('')),
    fields: [
      { key: 'eyebrow', label: 'Small label', type: 'text' },
      { key: 'heading', label: 'Heading', type: 'longtext' },
      { key: 'left', label: 'Left column', type: 'longtext' },
      { key: 'right', label: 'Right column', type: 'longtext' },
      BG
    ],
    defaults: { eyebrow: 'Good to know', heading: 'Before you\n*visit.*', left: '**Parking.** There is free parking inside the gate.\n\n**Children.** High chairs are available.', right: '**Dogs.** Well-behaved dogs are welcome in the garden.\n\n**Groups.** For more than 12 guests, please call ahead.', background: 'paper' },
    render: function (d, ctx, id) {
      var a = '@' + id + '.';
      return '<section class="section blk blk-columns' + bgClass(d) + '"><div class="wrap">' +
        '<div class="blk__head" data-reveal>' + text(ctx, 'p', a + 'eyebrow', d.eyebrow, 'eyebrow eyebrow--wine') + text(ctx, 'h2', a + 'heading', d.heading) + '</div>' +
        '<div class="blk-columns__grid" data-reveal>' + text(ctx, 'p', a + 'left', d.left, 'blk__text') + text(ctx, 'p', a + 'right', d.right, 'blk__text') + '</div></div></section>';
    }
  };

  T.faq = {
    label: 'Questions and answers', group: 'Text',
    description: 'Common questions that open on tap. Search engines read these too.',
    wireframe: W.svg(W.line(12, 12, 60, true) + [0, 1, 2, 3].map(function (i) { return W.box(12, 28 + i * 17, 136, 13, 3) + W.line(18, 33 + i * 17, 70, false) + '<path d="M138 ' + (32 + i * 17) + 'l3 3l3 -3" stroke="#9AA2B8" fill="none"/>'; }).join('')),
    fields: [
      { key: 'heading', label: 'Heading', type: 'longtext' },
      { key: 'items', label: 'Questions', type: 'list', item: 'question', fields: [
        { key: 'question', label: 'Question', type: 'text' },
        { key: 'answer', label: 'Answer', type: 'longtext' }
      ] },
      BG
    ],
    defaults: { heading: 'Questions\n*we hear often.*', background: 'cream', items: [
      { question: 'Do I need to book?', answer: 'Booking is best for weekends and evenings. Walk-ins are welcome when we have space.' },
      { question: 'Is there parking?', answer: 'Yes, free parking inside the gate.' },
      { question: 'Can you host a private event?', answer: 'Yes. Send us a message with the date and number of guests.' }
    ] },
    render: function (d, ctx, id) {
      var a = '@' + id + '.';
      var items = (d.items || []).map(function (it, i) {
        var b = a + 'items.' + i + '.';
        return '<details class="blk-faq__item"' + (ctx.edit ? ' open' : '') + '><summary' + p(ctx, b + 'question') + '>' + inline(it.question) + '</summary>' + text(ctx, 'p', b + 'answer', it.answer, 'blk__text') + '</details>';
      }).join('');
      return '<section class="section blk blk-faq' + bgClass(d) + '"><div class="wrap wrap--narrow">' +
        '<div class="blk__head" data-reveal>' + text(ctx, 'h2', a + 'heading', d.heading) + '</div><div class="blk-faq__list" data-reveal>' + items + '</div></div></section>';
    }
  };

  T.cta = {
    label: 'Call to action', group: 'Text',
    description: 'A short band with one line and a button, e.g. “Book a table”.',
    wireframe: W.svg('<rect x="0" y="22" width="160" height="56" fill="#3F4458"/>' + '<rect x="24" y="40" width="70" height="6" rx="1.5" fill="#C9CEDD"/><rect x="24" y="52" width="50" height="3" rx="1.5" fill="#8E95AB"/>' + W.btn(110, 44)),
    fields: [
      { key: 'heading', label: 'Heading', type: 'longtext' },
      { key: 'text', label: 'Text', type: 'longtext' },
      { key: 'button', label: 'Button', type: 'link' },
      { key: 'background', label: 'Background', type: 'select', options: [['dark', 'Dark'], ['wine', 'Wine'], ['cream', 'Cream']] }
    ],
    defaults: { heading: 'Book a table\n*for the weekend.*', text: 'Send us a message and we will call you back to confirm.', button: { label: 'Book a table', href: 'index.html#visit' }, background: 'dark' },
    render: function (d, ctx, id) {
      var a = '@' + id + '.';
      var bg = d.background === 'wine' ? ' blk-cta--wine on-dark' : d.background === 'cream' ? ' section--cream' : ' blk--dark on-dark';
      return '<section class="section section--tight blk blk-cta' + bg + '"><div class="wrap blk-cta__inner" data-reveal>' +
        '<div>' + text(ctx, 'h2', a + 'heading', d.heading) + text(ctx, 'p', a + 'text', d.text, 'blk__text') + '</div>' +
        link(ctx, a + 'button', d.button, 'btn ' + (d.background === 'cream' ? 'btn--primary' : 'btn--light')) + '</div></section>';
    }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function newId() { return 's' + Math.random().toString(36).slice(2, 7); }

  return {
    templates: T,
    order: ['split', 'banner', 'cards', 'gallery', 'statement', 'columns', 'faq', 'cta'],
    inline: inline,
    esc: esc,
    create: function (type) { return { id: newId(), type: type, data: clone(T[type].defaults) }; },
    render: function (entry, ctx) {
      var t = T[entry.type];
      if (!t) return '';
      var html = t.render(entry.data || {}, ctx || {}, entry.id);
      if (ctx && ctx.edit) html = html.replace(/^<section /, '<section data-cms-sec="@' + esc(entry.id) + '" data-cms-sec-label="' + esc(t.label) + '" data-cms-custom ');
      return html;
    }
  };
});
