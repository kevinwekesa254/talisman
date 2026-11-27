/* Runs inside the page preview in the admin's page editor.
   Outlines sections and editable parts on hover, tells the admin what was
   clicked, and applies text and picture changes as they are typed. */
(function () {
  var parentWin = window.parent;
  if (parentWin === window) return;
  function post(msg) { parentWin.postMessage(Object.assign({ from: 'talisman-frame' }, msg), '*'); }

  var css = document.createElement('style');
  css.textContent = [
    '[data-reveal]{opacity:1!important;transform:none!important;transition:none!important}',
    'html{scroll-behavior:auto!important}',
    '[data-cms-path]{cursor:text}',
    'img[data-cms-path],.blk__ph{cursor:pointer}',
    '[data-cms-hidden]{position:relative;opacity:.38;filter:grayscale(.8)}',
    '[data-cms-hidden]::after{content:"Hidden on the site";position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:50;background:#1F2433;color:#fff;font:600 12px/1 system-ui,sans-serif;padding:8px 12px;border-radius:999px}',
    '.tx-box{position:absolute;pointer-events:none;z-index:2147483000;border-radius:2px}',
    '.tx-sec{outline:2px solid #5B6BF5;outline-offset:-2px}',
    '.tx-sec.is-sel{outline-width:2px;box-shadow:inset 0 0 0 9999px rgba(91,107,245,.04)}',
    '.tx-el{outline:1.5px dashed #5B6BF5;outline-offset:3px}',
    '.tx-el.is-sel{outline:2px solid #5B6BF5;background:rgba(91,107,245,.06)}',
    '.tx-bar{position:absolute;z-index:2147483001;display:flex;gap:2px;background:#5B6BF5;border-radius:8px;padding:3px;box-shadow:0 6px 18px -6px rgba(40,50,120,.45);font:600 12px/1 system-ui,-apple-system,sans-serif}',
    '.tx-bar span{color:#fff;padding:7px 8px 7px 6px;white-space:nowrap}',
    '.tx-bar button{all:unset;cursor:pointer;color:#fff;width:26px;height:26px;display:grid;place-items:center;border-radius:6px;font-size:15px}',
    '.tx-bar button:hover{background:rgba(255,255,255,.18)}',
    '.tx-add{position:absolute;z-index:2147483001;transform:translate(-50%,-50%);all:unset;cursor:pointer;background:#5B6BF5;color:#fff;border-radius:999px;font:600 12px/1 system-ui,sans-serif;padding:7px 12px 7px 10px;box-shadow:0 6px 16px -6px rgba(40,50,120,.5);display:none}',
    '.tx-add:hover{background:#4A59E6}'
  ].join('\n');
  document.head.appendChild(css);

  var layer = document.createElement('div');
  layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483000';
  document.body.appendChild(layer);
  function box(cls) { var d = document.createElement('div'); d.className = 'tx-box ' + cls; d.style.display = 'none'; layer.appendChild(d); return d; }
  var hovSec = box('tx-sec'), selSec = box('tx-sec is-sel'), hovEl = box('tx-el'), selEl = box('tx-el is-sel');

  var ph = document.createElement('link'); ph.rel = 'stylesheet'; ph.href = '/admin/vendor/phosphor/style.css'; document.head.appendChild(ph);
  function i(n) { return '<i class="ph ph-' + n + '"></i>'; }
  var ICON = { up: i('arrow-up'), down: i('arrow-down'), copy: i('copy'), hide: i('eye-slash'), show: i('eye'), del: i('trash') };
  var bar = document.createElement('div');
  bar.className = 'tx-bar'; bar.style.display = 'none';
  layer.appendChild(bar);
  var add = document.createElement('button');
  add.className = 'tx-add'; add.innerHTML = i('plus') + ' Add section';
  layer.appendChild(add);

  function sections() { return Array.prototype.slice.call(document.querySelectorAll('main > [data-cms-sec]')); }
  function place(el, target, pad) {
    if (!target) { el.style.display = 'none'; return; }
    var r = target.getBoundingClientRect(), p = pad || 0;
    el.style.display = 'block';
    el.style.left = (r.left + scrollX - p) + 'px'; el.style.top = (r.top + scrollY - p) + 'px';
    el.style.width = (r.width + p * 2) + 'px'; el.style.height = (r.height + p * 2) + 'px';
  }

  var current = null, selected = { sec: null, path: null };
  function showBar(sec) {
    current = sec;
    if (!sec) { bar.style.display = 'none'; add.style.display = 'none'; return; }
    var custom = sec.hasAttribute('data-cms-custom');
    var hidden = sec.hasAttribute('data-cms-hidden');
    bar.innerHTML = '<span>' + (sec.getAttribute('data-cms-sec-label') || 'Section') + '</span>' +
      '<button data-act="up" title="Move up">' + ICON.up + '</button><button data-act="down" title="Move down">' + ICON.down + '</button>' +
      (custom ? '<button data-act="duplicate" title="Duplicate">' + ICON.copy + '</button>' : '') +
      '<button data-act="hide" title="' + (hidden ? 'Show on the site' : 'Hide on the site') + '">' + (hidden ? ICON.show : ICON.hide) + '</button>' +
      (custom ? '<button data-act="delete" title="Delete">' + ICON.del + '</button>' : '');
    var r = sec.getBoundingClientRect();
    bar.style.display = 'flex';
    bar.style.top = (Math.max(r.top, 8) + scrollY + 8) + 'px';
    bar.style.left = (r.right + scrollX - bar.offsetWidth - 10) + 'px';
    add.style.display = 'block';
    add.style.left = (r.left + r.width / 2 + scrollX) + 'px';
    add.style.top = (r.bottom + scrollY - 16) + 'px';
  }
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || !current) return;
    e.stopPropagation();
    post({ type: 'section-action', act: b.getAttribute('data-act'), sec: current.getAttribute('data-cms-sec') });
  });
  add.addEventListener('click', function (e) {
    e.stopPropagation();
    if (current) post({ type: 'add-after', sec: current.getAttribute('data-cms-sec') });
  });

  document.addEventListener('mousemove', function (e) {
    if (bar.contains(e.target) || add.contains(e.target)) return;
    var sec = e.target.closest && e.target.closest('main > [data-cms-sec]');
    place(hovSec, sec && sec !== selected.secEl ? sec : null);
    if (sec !== current) showBar(sec);
    var el = e.target.closest && e.target.closest('[data-cms-path]');
    place(hovEl, el && el !== selected.el ? el : null, 0);
  }, true);
  document.addEventListener('mouseleave', function () { place(hovSec, null); place(hovEl, null); });

  document.addEventListener('click', function (e) {
    if (bar.contains(e.target) || add.contains(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    var el = e.target.closest('[data-cms-path]');
    var sec = e.target.closest('main > [data-cms-sec]');
    if (!sec && !el) return;
    post({ type: 'select', path: el ? el.getAttribute('data-cms-path') : null, sec: sec ? sec.getAttribute('data-cms-sec') : null });
  }, true);
  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);

  function select(sec, path) {
    selected.sec = sec; selected.path = path;
    selected.secEl = sec ? document.querySelector('main > [data-cms-sec="' + CSS.escape(sec) + '"]') : null;
    selected.el = path ? document.querySelector('[data-cms-path="' + CSS.escape(path) + '"]') : null;
    redraw();
  }
  function redraw() {
    if (selected.secEl && !document.contains(selected.secEl)) select(selected.sec, selected.path);
    place(selSec, selected.secEl); place(selEl, selected.el, 0);
    if (current) showBar(current);
  }
  addEventListener('resize', redraw);
  var st = null;
  addEventListener('scroll', function () {
    clearTimeout(st);
    st = setTimeout(function () { post({ type: 'scroll', y: scrollY }); }, 120);
  }, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(redraw).observe(document.body);

  addEventListener('message', function (e) {
    if (e.source !== parentWin || !e.data || e.data.to !== 'talisman-frame') return;
    var m = e.data;
    if (m.type === 'set') {
      document.querySelectorAll('[data-cms-path="' + CSS.escape(m.path) + '"]').forEach(function (el) {
        if (el.tagName === 'IMG') {
          if (m.src) { el.src = m.src; el.removeAttribute('srcset'); var s = el.parentElement && el.parentElement.tagName === 'PICTURE' && el.parentElement.querySelector('source'); if (s) s.srcset = m.src; }
          if (m.alt != null) el.alt = m.alt;
        } else {
          if (m.html != null) el.innerHTML = m.html;
          if (m.href != null && el.tagName === 'A') el.setAttribute('href', m.href);
        }
      });
      redraw();
    } else if (m.type === 'select') {
      select(m.sec, m.path);
      if (m.scroll) {
        var t = selected.el || selected.secEl;
        if (t) t.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    } else if (m.type === 'scroll') {
      scrollTo(0, m.y);
    } else if (m.type === 'srcmap') {
      // Pictures uploaded this session that the live site doesn't have yet
      document.querySelectorAll('img').forEach(function (img) {
        var a = img.getAttribute('src'); if (a && m.map[a.split('?')[0]]) img.src = m.map[a.split('?')[0]];
      });
    }
  });
  post({ type: 'ready', height: document.documentElement.scrollHeight });
})();
