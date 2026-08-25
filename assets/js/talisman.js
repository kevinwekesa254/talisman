/* =========================================================================
   TALISMAN — interactions
   Progressive enhancement: every feature degrades to working HTML.
   No dependencies. Ships as one file for easy wp_enqueue_script().
   ========================================================================= */
(function () {
  'use strict';

  // Tells the inline head script the enhancement layer booted, so it leaves .js on.
  window.__talismanReady = true;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer: fine)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---- rAF-batched scroll bus -------------------------------------------- */
  var scrollFns = [], ticking = false;
  function onScroll(fn) { scrollFns.push(fn); fn(window.scrollY); }
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      for (var i = 0; i < scrollFns.length; i++) scrollFns[i](y);
      ticking = false;
    });
  }, { passive: true });

  /* ---- 1. Floating nav: transparent over dark hero, solid after ---------- */
  (function nav() {
    var el = $('.nav');
    if (!el || el.classList.contains('nav--light')) return;
    var trigger = function () {
      var hero = $('.hero, .pagehead');
      return hero ? Math.max(hero.offsetHeight - 120, 80) : 80;
    };
    var point = trigger();
    window.addEventListener('resize', function () { point = trigger(); });
    onScroll(function (y) { el.classList.toggle('is-solid', y > point); });
  })();

  /* ---- 2. Mobile sheet ---------------------------------------------------- */
  (function sheet() {
    var toggle = $('.nav__toggle'), panel = $('.nav-sheet');
    if (!toggle || !panel) return;
    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      panel.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('is-locked');
      $$('.nav-sheet__link', panel).forEach(function (a, i) {
        a.style.animationDelay = (0.06 + i * 0.05) + 's';
      });
      var first = $('.nav-sheet__close', panel);
      if (first) first.focus();
    }
    function close() {
      panel.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('is-locked');
      if (lastFocus) lastFocus.focus();
    }
    toggle.addEventListener('click', function () {
      panel.classList.contains('is-open') ? close() : open();
    });
    var closeBtn = $('.nav-sheet__close', panel);
    if (closeBtn) closeBtn.addEventListener('click', close);
    $$('a', panel).forEach(function (a) { a.addEventListener('click', close); });

    document.addEventListener('keydown', function (e) {
      if (!panel.classList.contains('is-open')) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      // Focus trap
      var f = $$('a[href], button', panel).filter(function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    // Sheet is desktop-irrelevant — shut it if the viewport grows
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1080 && panel.classList.contains('is-open')) close();
    });
  })();

  /* ---- 3. Scroll reveals -------------------------------------------------- */
  (function reveals() {
    var els = $$('[data-reveal]');
    if (!els.length) return;
    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    // Anything already on screen at load reveals immediately — no blank fold.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var group = e.target.parentElement;
        var sibs = group ? $$('[data-reveal]', group) : [];
        var i = sibs.indexOf(e.target);
        e.target.style.transitionDelay = (i > 0 && i < 8 ? i * 0.07 : 0) + 's';
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    function sweep() {
      var vh = window.innerHeight;
      els.forEach(function (el) {
        if (el.classList.contains('is-in')) return;
        var r = el.getBoundingClientRect();
        if (r.top < vh * 0.9 && r.bottom > 0) {
          el.classList.add('is-in');
          io.unobserve(el);
        }
      });
    }

    els.forEach(function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) el.classList.add('is-in');
      else io.observe(el);
    });

    /* Deep links (#visit, #enquire) scroll the page after this script has already
       decided what was on screen, so the target section can land still hidden.
       Re-sweep once the browser has settled, and again on any hash change. */
    window.addEventListener('load', sweep);
    window.addEventListener('hashchange', function () { setTimeout(sweep, 60); });
    if (location.hash) setTimeout(sweep, 120);
  })();

  /* ---- 4. Parallax (hero + bands) ---------------------------------------- */
  (function parallax() {
    if (reduced) return;
    var hero = $('[data-parallax="hero"]');
    var bands = $$('[data-parallax="band"]');
    if (!hero && !bands.length) return;
    onScroll(function (y) {
      if (hero && y < window.innerHeight * 1.3) {
        hero.style.transform = 'translate3d(0,' + (y * 0.26) + 'px,0)';
      }
      var vh = window.innerHeight;
      bands.forEach(function (img) {
        var r = img.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var p = (r.top + r.height / 2 - vh / 2) / vh;
        img.style.transform = 'translate3d(0,' + (p * -64) + 'px,0)';
      });
    });
  })();

  /* ---- 5. Pointer tilt on figures (desktop only) ------------------------- */
  (function tilt() {
    if (reduced || !fine) return;
    $$('[data-tilt]').forEach(function (el) {
      el.addEventListener('mousemove', function (ev) {
        var r = el.getBoundingClientRect();
        var x = (ev.clientX - r.left) / r.width - 0.5;
        var y = (ev.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(900px) rotateY(' + (x * 4.5) + 'deg) rotateX(' + (y * -4.5) + 'deg)';
      });
      el.addEventListener('mouseleave', function () {
        el.style.transform = 'perspective(900px) rotateY(0) rotateX(0)';
      });
    });
  })();

  /* ---- 6. Menu scrollspy -------------------------------------------------- */
  (function scrollspy() {
    var links = $$('.menu-nav__link');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var sections = links.map(function (a) { return $(a.getAttribute('href')); }).filter(Boolean);
    if (!sections.length) return;

    function setActive(id) {
      links.forEach(function (a) {
        var on = a.getAttribute('href') === '#' + id;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
    var spy = new IntersectionObserver(function (entries) {
      var visible = entries.filter(function (e) { return e.isIntersecting; })
        .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
      if (visible.length) setActive(visible[0].target.id);
    }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
    setActive(sections[0].id);
  })();

  /* ---- 7. Forms: inline validation, no silent failures ------------------- */
  (function forms() {
    var patterns = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
      tel: /^[+()\d][\d\s\-().]{6,}$/
    };

    function validate(input) {
      var field = input.closest('.field');
      if (!field) return true;
      var errEl = $('.field__error', field);
      var v = input.value.trim();
      var msg = '';

      if (input.required && !v) {
        msg = (input.dataset.label || 'This field') + ' is required.';
      } else if (v && input.type === 'email' && !patterns.email.test(v)) {
        msg = 'Please enter a valid email, e.g. name@example.com';
      } else if (v && input.type === 'tel' && !patterns.tel.test(v)) {
        msg = 'Please enter a reachable phone number, e.g. +254 7XX XXX XXX';
      } else if (v && input.type === 'number') {
        var n = Number(v), min = Number(input.min || -Infinity), max = Number(input.max || Infinity);
        if (isNaN(n) || n < min || n > max) msg = 'Please enter a number between ' + input.min + ' and ' + input.max + '.';
      }

      field.classList.toggle('has-error', !!msg);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (errEl) errEl.lastElementChild.textContent = msg;
      return !msg;
    }

    $$('form[data-validate]').forEach(function (form) {
      var inputs = $$('.field__input', form);
      var status = $('.form__status', form);

      // Validate on blur, not on keystroke; re-validate live once a field is dirty.
      inputs.forEach(function (input) {
        input.addEventListener('blur', function () { validate(input); });
        input.addEventListener('input', function () {
          if (input.closest('.field').classList.contains('has-error')) validate(input);
        });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var bad = inputs.filter(function (i) { return !validate(i); });
        if (bad.length) {
          bad[0].focus();
          bad[0].scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
          return;
        }
        var btn = $('button[type="submit"]', form);
        var label = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.style.opacity = '.55'; btn.textContent = 'Sending…'; }

        // No backend yet — WordPress will wire this to Contact Form 7 / admin-ajax.
        window.setTimeout(function () {
          if (status) {
            status.querySelector('[data-status-text]').textContent = form.dataset.success ||
              'Asante. We have your details and a member of our team will call you back shortly.';
            status.classList.add('is-visible');
          }
          form.reset();
          inputs.forEach(function (i) {
            i.closest('.field').classList.remove('has-error');
            i.removeAttribute('aria-invalid');
          });
          if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.textContent = label; }
        }, 700);
      });
    });
  })();

  /* ---- 8. In-page menu viewer (PDF) --------------------------------------- */
  (function menuViewer() {
    var viewer = $('[data-viewer]');
    if (!viewer) return;

    var frame    = $('[data-viewer-frame]', viewer);
    var tabs     = $$('.viewer__tab', viewer);
    var stage    = $('.viewer__stage', viewer);
    var fallback = $('[data-viewer-fallback]', viewer);
    var fbLink   = $('[data-viewer-fallback-link]', viewer);
    var download = $('[data-viewer-download]', viewer);
    var openBtns = $$('[data-menu-open]');
    var closeBtn = $('[data-menu-close]', viewer);
    if (!frame || !tabs.length) return;

    /* iOS Safari and some Android browsers refuse to render PDFs in an iframe
       and silently show nothing. There is no reliable event for that, so detect
       plugin support up front and swap in a real link instead of a blank box. */
    var canEmbed = (function () {
      var nav = window.navigator;
      if (nav.pdfViewerEnabled !== undefined) return !!nav.pdfViewerEnabled;
      if (nav.mimeTypes && nav.mimeTypes['application/pdf']) return true;
      return !/iPad|iPhone|iPod|Android/i.test(nav.userAgent);
    })();

    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      var src = tab.dataset.pdf;
      var title = tab.dataset.title || 'Talisman menu';

      if (canEmbed) {
        // #view=FitH opens at page width rather than the browser's last zoom
        frame.src = src + '#view=FitH&toolbar=1';
        frame.title = title + ' (PDF)';
        if (fallback) fallback.hidden = true;
      } else {
        frame.removeAttribute('src');
        if (fallback) fallback.hidden = false;
        if (fbLink) { fbLink.href = src; fbLink.textContent = 'Open the ' + title.toLowerCase(); }
      }
      if (download) {
        download.href = src;
        download.textContent = 'Download the ' + title.toLowerCase();
      }
      if (stage) stage.setAttribute('aria-labelledby', tab.id);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { select(tab); });
      // Roving focus, per the tablist pattern
      tab.addEventListener('keydown', function (e) {
        var i = tabs.indexOf(tab), next = null;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];
        if (!next) return;
        e.preventDefault();
        next.focus();
        select(next);
      });
    });

    function open() {
      if (!viewer.hidden) return;
      viewer.hidden = false;
      viewer.classList.add('is-opening');
      openBtns.forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      select(tabs[0]);                       // PDF is only fetched on first open
      viewer.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      window.setTimeout(function () { tabs[0].focus({ preventScroll: true }); }, reduced ? 0 : 450);
    }
    function close() {
      viewer.hidden = true;
      viewer.classList.remove('is-opening');
      frame.removeAttribute('src');          // stop the embedded viewer
      openBtns.forEach(function (b) {
        b.setAttribute('aria-expanded', 'false');
      });
      if (openBtns[0]) openBtns[0].focus();
    }

    openBtns.forEach(function (b) { b.addEventListener('click', open); });
    if (closeBtn) closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !viewer.hidden) close();
    });

    // Deep links. #food and #beverages come from the nav dropdown and should
    // open the viewer already showing the right menu.
    var byHash = {
      '#menus': tabs[0], '#menu-viewer': tabs[0],
      '#food': $('#tab-main', viewer),
      '#beverages': $('#tab-wine', viewer) || $('#tab-bev', viewer),
      '#wine': $('#tab-wine', viewer),
      '#coffee': $('#tab-coffee', viewer),
      '#cocktails': $('#tab-bev', viewer),
      '#bar': $('#tab-bar', viewer)
    };

    /* Cards elsewhere on the page open the viewer already on their own tab. */
    $$('[data-menu-tab]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var tab = $('#' + link.getAttribute('data-menu-tab'), viewer);
        if (!tab) return;
        e.preventDefault();
        if (viewer.hidden) open();
        select(tab);
        viewer.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      });
    });
    function fromHash() {
      var tab = byHash[location.hash];
      if (!tab) return;
      if (viewer.hidden) open();
      select(tab);
      viewer.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
    fromHash();
    window.addEventListener('hashchange', fromHash);
  })();

  /* ---- 10. Nav dropdown --------------------------------------------------- */
  (function navDropdown() {
    var groups = $$('[data-nav-group]');
    if (!groups.length) return;

    groups.forEach(function (group) {
      var toggle = $('[data-nav-toggle]', group);
      var sub = $('[data-nav-sub]', group);
      if (!toggle || !sub) return;

      function open()  { group.classList.add('is-open');  toggle.setAttribute('aria-expanded', 'true'); }
      function close() { group.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }

      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        group.classList.contains('is-open') ? close() : open();
      });

      // Arrow-down from the trigger moves into the submenu
      toggle.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); open(); var f = $('a', sub); if (f) f.focus(); }
      });
      sub.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { close(); toggle.focus(); }
      });

      // CSS opens on hover/focus-within too; these keep ARIA in step with it
      group.addEventListener('mouseenter', function () { toggle.setAttribute('aria-expanded', 'true'); });
      group.addEventListener('mouseleave', function () { if (!group.classList.contains('is-open')) toggle.setAttribute('aria-expanded', 'false'); });

      document.addEventListener('click', function (e) { if (!group.contains(e.target)) close(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
      $$('a', sub).forEach(function (a) { a.addEventListener('click', close); });
    });
  })();

  /* ---- 9. Numbered gallery carousel --------------------------------------- */
  (function gallery() {
    var root = $('[data-gallery]');
    if (!root) return;
    var track = $('[data-gallery-track]', root);
    var prev  = $('[data-gallery-prev]', root);
    var next  = $('[data-gallery-next]', root);
    var bar   = $('[data-gallery-bar]', root);
    if (!track) return;

    function page() {
      // One "page" is however many items are currently visible
      var item = track.firstElementChild;
      if (!item) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap || '0') || 0;
      var per = Math.max(1, Math.round(track.clientWidth / (item.offsetWidth + gap)));
      return per * (item.offsetWidth + gap);
    }

    function sync() {
      var max = track.scrollWidth - track.clientWidth;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max - 2;
      if (bar) {
        var visible = track.clientWidth / track.scrollWidth;
        var progress = max > 0 ? track.scrollLeft / max : 0;
        bar.style.width = Math.max(visible * 100, 8) + '%';
        bar.style.transform = 'translateX(' + (progress * ((1 / Math.max(visible, .0001)) - 1) * 100) + '%)';
      }
    }

    function go(dir) {
      track.scrollBy({ left: dir * page(), behavior: reduced ? 'auto' : 'smooth' });
    }
    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });
    track.addEventListener('scroll', function () {
      window.clearTimeout(track._t);
      track._t = window.setTimeout(sync, 60);
    }, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  })();

  /* ---- 11. Footer year ---------------------------------------------------- */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
