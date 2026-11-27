/* The page editor. The page is shown on the right; click anything on it to
   edit it on the left. Sections can be added from templates, moved, hidden
   and removed. Changes are kept as a draft until you publish. */
import { html, useState, useEffect, useRef, useMemo, api, useApp, load, toast, I, Field, Skeleton, ago, confirmBox, go, imgUrl, fresh } from './core.js';
import { ImageField } from './website.js';

const S = window.TalismanSections;
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const PAGE_LINKS = ['index.html', 'index.html#visit', 'menu.html', 'beverages.html', 'events.html', 'our-story.html', 'privacy.html', 'terms.html'];

/* ---- paths: "about.heading", "about.milestones.2.title", "@s1a2b.items.0.image" ---- */
function locate(content, path, create) {
  const parts = path.split('.');
  let obj;
  if (parts[0][0] === '@') { const e = (content.layout || []).find(x => x.id === parts[0].slice(1)); if (!e) return null; obj = e.data = e.data || {}; }
  else { if (!content[parts[0]]) { if (!create) return null; content[parts[0]] = {}; } obj = content[parts[0]]; }
  for (let i = 1; i < parts.length - 1; i++) { if (obj[parts[i]] == null) { if (!create) return null; obj[parts[i]] = {}; } obj = obj[parts[i]]; }
  return { obj, key: parts[parts.length - 1] };
}
const getPath = (c, p) => { const l = locate(c, p); return l ? l.obj[l.key] : undefined; };

function withLayout(content, schema) {
  const c = clone(content || {});
  if (!Array.isArray(c.layout)) c.layout = schema.map(s => ({ key: s.key }));
  schema.forEach(s => { if (!c.layout.some(e => e.key === s.key)) c.layout.push({ key: s.key }); });
  return c;
}

/* ---------------- fields ---------------- */
function wrapSel(ta, before, after, cb) {
  if (!ta) return;
  const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value, mid = v.slice(a, b) || 'words';
  cb(v.slice(0, a) + before + mid + after + v.slice(b));
  setTimeout(() => { ta.focus(); ta.setSelectionRange(a + before.length, a + before.length + mid.length); });
}
function TextField({ label, value, onChange, multi, focus, rich, max, plain }) {
  const ref = useRef(null);
  const v = value == null ? '' : String(value);
  const rows = Math.min(rich ? 18 : 8, Math.max(multi ? 2 : 1, v.split('\n').length + (v.length > 60 ? Math.floor(v.length / 48) : 0)));
  const fmt = multi && !plain && html`<div class="fmt">
    <button title="Italic (*words*)" onClick=${() => wrapSel(ref.current, '*', '*', onChange)}><${I} n="text-italic" /></button>
    <button title="Bold (**words**)" onClick=${() => wrapSel(ref.current, '**', '**', onChange)}><${I} n="text-b" /></button>
    <button title="Link" onClick=${() => wrapSel(ref.current, '[', '](menu.html)', onChange)}><${I} n="link-simple" /></button>
    ${rich && html`<button title="Heading" onClick=${() => wrapSel(ref.current, '\n## ', '\n', onChange)}><${I} n="text-h-two" /></button>
      <button title="List" onClick=${() => wrapSel(ref.current, '\n- ', '', onChange)}><${I} n="list-bullets" /></button>`}</div>`;
  useEffect(() => { if (focus && ref.current) { ref.current.scrollIntoView({ block: 'center', behavior: 'smooth' }); ref.current.focus({ preventScroll: true }); } }, [focus]);
  return html`<div class=${'field' + (focus ? ' is-focus' : '')}><label>${label}${max && html`<span class=${'counter' + (v.length > max ? ' is-bad' : '')}>${v.length}/${max}</span>`}</label>${fmt}
    ${multi ? html`<textarea class="textarea" ref=${ref} rows=${rows} value=${v} onInput=${e => onChange(e.target.value)}></textarea>`
      : html`<input class="input" ref=${ref} value=${v} onInput=${e => onChange(e.target.value)} />`}
    ${multi && !rich && !plain && html`<p class="hint">A new line starts a new line on the page. *Stars* make italics.</p>`}</div>`;
}
function LinkField({ label, value, onChange, focus }) {
  const v = value || {};
  const ref = useRef(null);
  useEffect(() => { if (focus && ref.current) { ref.current.scrollIntoView({ block: 'center', behavior: 'smooth' }); ref.current.focus({ preventScroll: true }); } }, [focus]);
  return html`<div class=${'group' + (focus ? ' is-focus' : '')} style=${focus ? 'border-color:var(--accent)' : ''}><div class="group__head"><${I} n="cursor-click" />${label}</div><div class="group__body">
    <div class="field"><label>Button text</label><input class="input" ref=${ref} value=${v.label || ''} onInput=${e => onChange(Object.assign({}, v, { label: e.target.value }))} /></div>
    <div class="field"><label>Goes to</label><input class="input" list="tal-pages" value=${v.href || ''} onInput=${e => onChange(Object.assign({}, v, { href: e.target.value }))} />
      <p class="hint">A page such as menu.html, or a full web address.</p></div></div></div>`;
}
function SelectField({ label, value, options, onChange }) {
  return html`<div class="field"><label>${label}</label><div class="seg" style="justify-self:start;flex-wrap:wrap">${options.map(([k, l]) => html`<button class=${value === k ? 'is-on' : ''} onClick=${() => onChange(k)}>${l}</button>`)}</div></div>`;
}

/* One field, built-in or template. f.type: text | longtext | label | link | image | select | list | rich */
function FieldFor({ f, path, content, change, focusPath, listChange }) {
  const v = getPath(content, path);
  const focus = focusPath === path;
  const set = (val, kind) => change(path, val, kind);
  if (f.type === 'image') return html`<${ImageField} label=${f.label} value=${v} focus=${focus} onChange=${val => set(val, 'image')} />`;
  if (f.type === 'link') return html`<${LinkField} label=${f.label} value=${v} focus=${focus} onChange=${val => set(val, 'link')} />`;
  if (f.type === 'select') return html`<${SelectField} label=${f.label} value=${v} options=${f.options} onChange=${val => set(val, 'render')} />`;
  if (f.type === 'rich') return html`<${TextField} label=${f.label} value=${v} multi rich focus=${focus} onChange=${val => set(val, 'render')} />`;
  if (f.type === 'list') return html`<${ListField} f=${f} path=${path} content=${content} change=${change} focusPath=${focusPath} listChange=${listChange} />`;
  const multi = f.type === 'longtext' || f.long || /heading|quote|intro|text|statement/i.test(f.label) || /\n/.test(v || '');
  return html`<${TextField} label=${f.label} value=${v} multi=${multi} focus=${focus} onChange=${val => set(val, f.type === 'label' ? 'label' : 'text')} />`;
}

function ListField({ f, path, content, change, focusPath, listChange }) {
  const rows = getPath(content, path) || [];
  const [open, setOpen] = useState(-1);
  useEffect(() => { if (focusPath && focusPath.startsWith(path + '.')) setOpen(Number(focusPath.slice(path.length + 1).split('.')[0])); }, [focusPath]);
  const title = (r, i) => { const t = f.fields.find(x => x.type !== 'image' && r[x.key]); const val = t ? r[t.key] : ''; return String(typeof val === 'object' ? val.label || '' : val).replace(/[*\n]/g, ' ').slice(0, 40) || (f.item || 'Item') + ' ' + (i + 1); };
  const thumb = r => { const im = f.fields.find(x => x.type === 'image'); return im && r[im.key] && r[im.key].src; };
  return html`<div class="group"><div class="group__head"><${I} n="list-dashes" />${f.label}<span class="grow"></span><span class="muted small">${rows.length}</span></div><div class="group__body">
    ${rows.map((r, i) => html`<div class="listitem">
      <div class="listitem__head" onClick=${() => setOpen(open === i ? -1 : i)}>${thumb(r) ? html`<img src=${imgUrl(thumb(r))} alt="" />` : html`<${I} n="dots-six-vertical" cls="faint" />`}
        <span class="grow ellipsis">${title(r, i)}</span>
        <button class="btn btn--xs btn--ghost btn--icon" aria-label="Move up" disabled=${i === 0} onClick=${e => { e.stopPropagation(); listChange(path, 'up', i); }}><${I} n="arrow-up" /></button>
        <button class="btn btn--xs btn--ghost btn--icon" aria-label="Move down" disabled=${i === rows.length - 1} onClick=${e => { e.stopPropagation(); listChange(path, 'down', i); }}><${I} n="arrow-down" /></button>
        <button class="btn btn--xs btn--ghost btn--icon btn--danger" aria-label="Remove" onClick=${e => { e.stopPropagation(); listChange(path, 'remove', i); }}><${I} n="trash" /></button>
        <${I} n=${open === i ? 'caret-up' : 'caret-down'} cls="faint" /></div>
      ${open === i && html`<div class="listitem__body">${f.fields.map(sub => html`<${FieldFor} f=${sub} path=${path + '.' + i + '.' + sub.key} content=${content} change=${change} focusPath=${focusPath} />`)}</div>`}
    </div>`)}
    <button class="btn btn--sm" style="justify-self:start" onClick=${() => { listChange(path, 'add'); setOpen(rows.length); }}><${I} n="plus" />Add ${f.item || 'item'}</button>
  </div></div>`;
}

/* field lists for a section */
function fieldsFor(entry, schema) {
  if (entry.type) return S.templates[entry.type].fields;
  const s = schema.find(x => x.key === entry.key);
  if (!s) return [];
  return s.fields.map(f => Object.assign({}, f))
    .concat(s.lists.map(l => ({ key: l.key, label: l.label, type: 'list', item: (l.item || 'item').toLowerCase(), fields: l.fields })))
    .concat(s.rich.map(r => ({ key: r.key, label: r.label || 'Text', type: 'rich' })));
}
const secId = e => (e.type ? '@' + e.id : e.key);
function secLabel(e, schema) {
  if (e.type) { const d = e.data || {}; const t = String(d.heading || d.quote || '').replace(/[*\n]+/g, ' ').trim(); return S.templates[e.type].label + (t ? ': ' + t.slice(0, 28) : ''); }
  const s = schema.find(x => x.key === e.key); return s ? s.label : e.key;
}

/* ---------------- SEO ---------------- */
function SeoPanel({ content, change, frame, page }) {
  const seo = content.seo || {};
  const set = (k, v) => change('seo.' + k, v, 'none');
  const [checks, setChecks] = useState({ noAlt: 0, h1: 1 });
  useEffect(() => {
    try {
      const d = frame.current.contentDocument;
      setChecks({ noAlt: [...d.querySelectorAll('main img')].filter(i => !i.alt && !i.closest('[aria-hidden="true"]')).length, h1: d.querySelectorAll('h1').length });
    } catch (e) {}
  }, [content]);
  const t = seo.title || '', ds = seo.description || '';
  const ok = (good, text) => html`<div><${I} n=${good ? 'check-circle' : 'warning-circle'} /><span>${text}</span></div>`;
  const url = 'talisman-karen.vercel.app' + (page.file === 'index.html' ? '' : ' › ' + page.file.replace('.html', ''));
  return html`
    <div class="serp"><div class="serp__url"><i>T</i><span>The Talisman<br/><span class="muted">${url}</span></span></div>
      <div class="serp__title">${t || 'Page title'}</div><div class="serp__desc">${ds.length > 160 ? ds.slice(0, 157) + '…' : ds || 'Add a description.'}</div></div>
    <${TextField} label="Page title" plain value=${t} max=${60} onChange=${v => set('title', v)} />
    <${TextField} label="Description" plain value=${ds} multi max=${160} onChange=${v => set('description', v)} />
    <${ImageField} label="Picture when the page is shared" value=${{ src: seo.image }} noAlt onChange=${v => set('image', v.src)} />
    ${seo.image && html`<div class="share"><img src=${imgUrl(seo.image)} alt="" /><div><b>${t}</b><br/><span class="muted">${ds.slice(0, 90)}</span></div></div>`}
    <label class="check"><input type="checkbox" checked=${!!seo.noindex} onChange=${e => set('noindex', e.target.checked)} />Hide this page from search engines</label>
    <div class="group"><div class="group__head"><${I} n="list-checks" />Checks</div><div class="group__body checks">
      ${ok(t.length >= 20 && t.length <= 60, t.length > 60 ? 'Title is long. Google cuts it after about 60 characters.' : t.length < 20 ? 'Title is short. Say what the page is and where.' : 'Title length is good.')}
      ${ok(ds.length >= 110 && ds.length <= 160, ds.length > 160 ? 'Description is long. Aim for 120 to 160 characters.' : ds.length < 110 ? 'Description is short. Aim for 120 to 160 characters.' : 'Description length is good.')}
      ${ok(checks.noAlt === 0, checks.noAlt ? checks.noAlt + ' picture' + (checks.noAlt > 1 ? 's have' : ' has') + ' no description.' : 'Every picture has a description.')}
      ${ok(checks.h1 === 1, checks.h1 === 1 ? 'The page has one main heading.' : 'The page should have exactly one main heading (it has ' + checks.h1 + ').')}
      ${ok(!!seo.image, seo.image ? 'Has a picture for sharing.' : 'Add a picture for when the link is shared.')}
    </div></div>`;
}

/* ---------------- the editor ---------------- */
export function Editor({ name }) {
  const s = useApp();
  const [data, setData] = useState(null);
  const [content, setContent] = useState(null);
  const [sel, setSel] = useState({ sec: null, path: null });
  const [tab, setTab] = useState('edit');
  const [device, setDevice] = useState('desktop');
  const [status, setStatus] = useState({ dirty: false, savedAt: null, busy: '' });
  const [insertAfter, setInsertAfter] = useState(null);
  const [loading, setLoading] = useState(true);
  const frame = useRef(null);
  const scrollY = useRef(0);
  const pending = useRef(null);
  const hist = useRef({ past: [], future: [], last: 0, lastPath: '' });
  const contentRef = useRef(null);
  contentRef.current = content;

  useEffect(() => {
    api('page', { params: { name } }).then(d => {
      setData(d);
      const c = withLayout(d.draft || d.published, d.schema);
      setContent(c); renderFrame(c);
      setStatus({ dirty: false, savedAt: d.draft_at, busy: '', draft: !!d.draft });
    }).catch(e => { toast(e.message, true); go('/pages'); });
    const warn = e => { if (stRef.current.dirty) { e.preventDefault(); e.returnValue = ''; } };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [name]);
  const stRef = useRef(status); stRef.current = status;

  // frame <-> editor messages
  function post(msg) { const w = frame.current && frame.current.contentWindow; if (w) w.postMessage(Object.assign({ to: 'talisman-frame' }, msg), '*'); }
  async function renderFrame(c) {
    setLoading(true);
    try { const htmlText = await api('render', { body: { name, content: c } }); if (frame.current) frame.current.srcdoc = htmlText; }
    catch (e) { toast(e.message, true); setLoading(false); }
  }
  const selRef = useRef(sel); selRef.current = sel;
  useEffect(() => {
    const onMsg = e => {
      if (!frame.current || e.source !== frame.current.contentWindow || !e.data || e.data.from !== 'talisman-frame') return;
      const m = e.data;
      if (m.type === 'ready') {
        setLoading(false);
        post({ type: 'scroll', y: scrollY.current });
        post({ type: 'srcmap', map: fresh });
        post({ type: 'select', sec: selRef.current.sec, path: selRef.current.path, scroll: !!pending.current });
        pending.current = null;
      } else if (m.type === 'scroll') scrollY.current = m.y;
      else if (m.type === 'select') { setSel({ sec: m.sec, path: m.path }); setTab('edit'); post({ type: 'select', sec: m.sec, path: m.path }); }
      else if (m.type === 'section-action') sectionAction(m.act, m.sec);
      else if (m.type === 'add-after') { setInsertAfter(m.sec); setTab('add'); }
    };
    addEventListener('message', onMsg);
    return () => removeEventListener('message', onMsg);
  }, [name]);

  // undo / redo
  function snapshot(path) {
    const h = hist.current, now = Date.now();
    if (path && path === h.lastPath && now - h.last < 900) { h.last = now; return; }
    h.past.push(JSON.stringify(contentRef.current)); if (h.past.length > 80) h.past.shift();
    h.future = []; h.last = now; h.lastPath = path || '';
  }
  function undo(redo) {
    const h = hist.current, from = redo ? h.future : h.past, to = redo ? h.past : h.future;
    if (!from.length) return;
    to.push(JSON.stringify(contentRef.current));
    const c = JSON.parse(from.pop());
    h.lastPath = '';
    setContent(c); setStatus(st => Object.assign({}, st, { dirty: true })); renderFrame(c);
  }
  useEffect(() => {
    const k = e => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
      e.preventDefault(); undo(e.shiftKey);
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);

  // autosave a draft a few seconds after the last change
  useEffect(() => {
    if (!status.dirty) return;
    const t = setTimeout(() => saveDraft(true), 5000);
    return () => clearTimeout(t);
  }, [content, status.dirty]);

  const renderTimer = useRef(null);
  function scheduleRender(c) { clearTimeout(renderTimer.current); renderTimer.current = setTimeout(() => renderFrame(c), 350); }

  function change(path, value, kind) {
    snapshot(path);
    const c = clone(contentRef.current);
    const l = locate(c, path, true);
    l.obj[l.key] = value;
    setContent(c); setStatus(st => Object.assign({}, st, { dirty: true }));
    if (kind === 'text') post({ type: 'set', path, html: S.inline(value) });
    else if (kind === 'label') post({ type: 'set', path, html: esc(value) });
    else if (kind === 'link') post({ type: 'set', path, html: S.inline(value.label), href: value.href });
    else if (kind === 'image') { if (value.src) post({ type: 'set', path, src: imgUrl(value.src), alt: value.alt || '' }); else scheduleRender(c); }
    else if (kind === 'render') scheduleRender(c);
  }
  function listChange(path, act, i) {
    snapshot();
    const c = clone(contentRef.current);
    const l = locate(c, path, true);
    const arr = Array.isArray(l.obj[l.key]) ? l.obj[l.key] : (l.obj[l.key] = []);
    if (act === 'add') arr.push(arr.length ? clone(arr[arr.length - 1]) : {});
    if (act === 'remove') arr.splice(i, 1);
    if (act === 'up' && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    if (act === 'down' && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
    setContent(c); setStatus(st => Object.assign({}, st, { dirty: true })); scheduleRender(c);
  }
  async function sectionAction(act, sec) {
    const c0 = contentRef.current;
    const idx = c0.layout.findIndex(e => secId(e) === sec);
    if (idx < 0) return;
    if (act === 'delete' && !(await confirmBox('Remove this section from the page?', 'Remove'))) return;
    snapshot();
    const c = clone(c0), L = c.layout, e = L[idx];
    if (act === 'up' && idx > 0) [L[idx - 1], L[idx]] = [L[idx], L[idx - 1]];
    if (act === 'down' && idx < L.length - 1) [L[idx + 1], L[idx]] = [L[idx], L[idx + 1]];
    if (act === 'hide') e.hidden = !e.hidden;
    if (act === 'duplicate' && e.type) { const d = clone(e); d.id = S.create(e.type).id; L.splice(idx + 1, 0, d); }
    if (act === 'delete' && e.type) { L.splice(idx, 1); setSel({ sec: null, path: null }); }
    setContent(c); setStatus(st => Object.assign({}, st, { dirty: true }));
    pending.current = true; renderFrame(c);
    if (act === 'hide') toast(e.hidden ? 'Hidden. It stays here for you, but visitors will not see it.' : 'Showing on the site again');
  }
  function addSection(type) {
    snapshot();
    const c = clone(contentRef.current);
    const entry = S.create(type);
    const after = insertAfter || sel.sec;
    let at = after ? c.layout.findIndex(e => secId(e) === after) + 1 : 0;
    if (at <= 0) { // after the last section by default
      at = c.layout.length;
    }
    c.layout.splice(at, 0, entry);
    setContent(c); setStatus(st => Object.assign({}, st, { dirty: true }));
    const ns = { sec: '@' + entry.id, path: null };
    setSel(ns); selRef.current = ns; setInsertAfter(null); setTab('edit');
    pending.current = true; renderFrame(c);
    toast('Added “' + S.templates[type].label + '”. Click its text and pictures to change them.');
  }

  async function saveDraft(auto) {
    if (!contentRef.current) return;
    setStatus(st => Object.assign({}, st, { busy: auto ? '' : 'draft' }));
    try {
      await api('page', { params: { name }, body: { action: 'draft', content: contentRef.current } });
      setStatus({ dirty: false, savedAt: new Date().toISOString(), busy: '', draft: true });
      if (!auto) toast('Draft saved. Only the team can see it.');
    } catch (e) { setStatus(st => Object.assign({}, st, { busy: '' })); if (!auto) toast(e.message, true); }
  }
  async function publish() {
    setStatus(st => Object.assign({}, st, { busy: 'publish' }));
    try {
      const r = await api('page', { params: { name }, body: { action: 'publish', content: contentRef.current } });
      setStatus({ dirty: false, savedAt: null, busy: '', draft: false, published: new Date().toISOString() });
      toast(r.live === 'soon' ? 'Published. The website updates in about a minute.' : 'Published to your preview site.');
      load('pages', true);
    } catch (e) { setStatus(st => Object.assign({}, st, { busy: '' })); toast(e.message, true); }
  }
  async function discard() {
    if (!(await confirmBox('Throw away the draft and go back to what is live on the site?', 'Discard draft'))) return;
    await api('page', { params: { name }, body: { action: 'discard' } });
    const c = withLayout(data.published, data.schema);
    setContent(c); renderFrame(c); setStatus({ dirty: false, savedAt: null, busy: '', draft: false });
    toast('Draft discarded');
  }
  async function leave() {
    if (status.dirty) await saveDraft(true);
    go('/pages');
  }

  if (!data || !content) return html`<div class="ed"><div class="ed__top"></div><div class="ed__body"><div class="ed__panel"><${Skeleton} rows=${6} /></div><div class="ed__canvas"></div></div></div>`;
  const pages = s.pages || [];
  const entry = sel.sec ? content.layout.find(e => secId(e) === sel.sec) : null;
  const width = { desktop: '100%', tablet: '834px', phone: '390px' }[device];
  const label = status.busy === 'publish' ? 'Publishing…' : status.busy === 'draft' ? 'Saving…' : status.dirty ? 'Unsaved changes' : status.savedAt ? 'Draft saved ' + ago(status.savedAt) : status.published ? 'Published ' + ago(status.published) : status.draft ? 'Draft' : 'Same as the live site';

  return html`<div class="ed">
    <datalist id="tal-pages">${PAGE_LINKS.map(p => html`<option value=${p} />`)}</datalist>
    <header class="ed__top">
      <button class="iconbtn" onClick=${leave} aria-label="Back to pages"><${I} n="arrow-left" /></button>
      <div class="title"><img src="/assets/img/logo.png" alt="" style="width:30px" /><span>Editing</span>
        <select class="select" style="width:auto;height:36px;font-weight:550" value=${name} onChange=${async e => { if (status.dirty) await saveDraft(true); go('/edit/' + e.target.value); }}>${pages.map(p => html`<option value=${p.name}>${p.label}</option>`)}</select></div>
      <div class="center">
        <div class="seg" role="group" aria-label="Screen size">${[['desktop', 'desktop', 'Computer'], ['tablet', 'device-tablet', 'Tablet'], ['phone', 'device-mobile', 'Phone']].map(([k, ic, l]) => html`<button class=${device === k ? 'is-on' : ''} onClick=${() => setDevice(k)} title=${l} aria-label=${l}><${I} n=${ic} /></button>`)}</div>
      </div>
      <button class="btn btn--ghost btn--icon" onClick=${() => undo(false)} title="Undo" aria-label="Undo"><${I} n="arrow-counter-clockwise" /></button>
      <button class="btn btn--ghost btn--icon" onClick=${() => undo(true)} title="Redo" aria-label="Redo"><${I} n="arrow-clockwise" /></button>
      <span class="ed__status">${status.dirty ? html`<i class="dot" style="background:var(--amber)"></i>` : html`<i class="dot" style="background:var(--green)"></i>`}${label}</span>
      ${status.draft && !status.dirty && html`<button class="btn btn--ghost btn--sm" onClick=${discard}>Discard draft</button>`}
      <button class="btn" onClick=${() => saveDraft(false)} disabled=${!!status.busy}>Save draft</button>
      <button class="btn btn--primary" onClick=${publish} disabled=${!!status.busy}><${I} n="rocket-launch" />Publish</button>
    </header>
    <div class="ed__body">
      <aside class="ed__panel">
        <div class="ed__tabs">${[['edit', 'pencil-simple', 'Edit'], ['add', 'plus-square', 'Add section'], ['layout', 'stack', 'Layout'], ['seo', 'magnifying-glass', 'SEO']].map(([k, ic, l]) => html`<button class=${tab === k ? 'is-on' : ''} onClick=${() => setTab(k)}><${I} n=${ic} />${l}</button>`)}</div>
        <div class="ed__scroll">
          ${tab === 'edit' && (entry ? html`
            <div class="sechead"><${I} n=${entry.type ? 'square-half' : 'rows'} /><h3>${secLabel(entry, data.schema)}</h3>
              <button class="btn btn--xs btn--ghost" onClick=${() => { setSel({ sec: null, path: null }); post({ type: 'select', sec: null, path: null }); }}>Done</button></div>
            ${entry.hidden && html`<div class="note note--amber"><${I} n="eye-slash" /><span>This section is hidden from visitors. <a href="#" onClick=${e => { e.preventDefault(); sectionAction('hide', sel.sec); }}>Show it</a></span></div>`}
            ${fieldsFor(entry, data.schema).map(f => html`<${FieldFor} key=${f.key} f=${f} path=${sel.sec + '.' + f.key} content=${content} change=${change} focusPath=${sel.path} listChange=${listChange} />`)}
            <div class="row row--wrap" style="border-top:1px solid var(--line);padding-top:14px">
              <button class="btn btn--sm" onClick=${() => sectionAction('up', sel.sec)}><${I} n="arrow-up" />Move up</button>
              <button class="btn btn--sm" onClick=${() => sectionAction('down', sel.sec)}><${I} n="arrow-down" />Move down</button>
              <button class="btn btn--sm" onClick=${() => sectionAction('hide', sel.sec)}><${I} n=${entry.hidden ? 'eye' : 'eye-slash'} />${entry.hidden ? 'Show' : 'Hide'}</button>
              ${entry.type && html`<button class="btn btn--sm btn--ghost btn--danger" onClick=${() => sectionAction('delete', sel.sec)}><${I} n="trash" />Remove</button>`}
            </div>`
          : html`<div class="note"><${I} n="cursor-click" /><span>Click any text, picture or button on the page to change it. Hover over a section for more options.</span></div>
            <div class="nav-list">${content.layout.map(e => html`<div class=${'nav-item' + (e.hidden ? ' is-hidden' : '')} onClick=${() => { const ns = { sec: secId(e), path: null }; setSel(ns); post(Object.assign({ type: 'select', scroll: true }, ns)); }}>
              <${I} n=${e.type ? 'square-half' : 'rows'} cls="faint" /><span>${secLabel(e, data.schema)}</span><${I} n="caret-right" cls="faint" /></div>`)}</div>
            <button class="btn" onClick=${() => setTab('add')}><${I} n="plus" />Add a section</button>`)}
          ${tab === 'add' && html`<p class="muted small">${insertAfter || sel.sec ? 'The new section goes after “' + secLabel(content.layout.find(e => secId(e) === (insertAfter || sel.sec)) || {}, data.schema) + '”.' : 'The new section goes at the end of the page. Select a section first to put it after that one.'}</p>
            ${['Story', 'Pictures', 'Text'].map(g => html`<div class="lib__group">${g}</div><div class="lib">${S.order.filter(t => S.templates[t].group === g).map(t => html`
              <button class="libitem" onClick=${() => addSection(t)} title=${S.templates[t].description}><span dangerouslySetInnerHTML=${{ __html: S.templates[t].wireframe }}></span><b>${S.templates[t].label}</b></button>`)}</div>`)}`}
          ${tab === 'layout' && html`<${LayoutPanel} content=${content} schema=${data.schema} sel=${sel} onSelect=${ns => { setSel(ns); setTab('edit'); post(Object.assign({ type: 'select', scroll: true }, ns)); }}
              onMove=${(from, to) => { snapshot(); const c = clone(content); const [m] = c.layout.splice(from, 1); c.layout.splice(to, 0, m); setContent(c); setStatus(st => Object.assign({}, st, { dirty: true })); renderFrame(c); }}
              onAction=${sectionAction} />`}
          ${tab === 'seo' && html`<${SeoPanel} content=${content} change=${change} frame=${frame} page=${data.page} />`}
        </div>
      </aside>
      <div class="ed__canvas"><iframe ref=${frame} class=${'ed__frame' + (loading ? ' is-loading' : '')} style=${'width:' + width} title="Page preview"></iframe></div>
    </div>
  </div>`;
}

function LayoutPanel({ content, schema, sel, onSelect, onMove, onAction }) {
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  return html`<p class="muted small">Drag to change the order. Hidden sections stay here but visitors do not see them.</p>
    <div class="nav-list">${content.layout.map((e, i) => html`<div class=${'nav-item' + (sel.sec === secId(e) ? ' is-on' : '') + (e.hidden ? ' is-hidden' : '') + (drag === i ? ' is-drag' : '') + (over === i && drag !== i ? ' is-over' : '')}
      draggable="true" onDragStart=${() => setDrag(i)} onDragEnd=${() => { setDrag(null); setOver(null); }} onDragOver=${ev => { ev.preventDefault(); setOver(i); }}
      onDrop=${ev => { ev.preventDefault(); if (drag != null && drag !== i) onMove(drag, i); setDrag(null); setOver(null); }} onClick=${() => onSelect({ sec: secId(e), path: null })}>
      <${I} n="dots-six-vertical" cls="grip" /><span>${secLabel(e, schema)}</span>
      ${e.type && html`<span class="pill pill--accent" style="font-size:11px;padding:1px 7px">Added</span>`}
      <button class="btn btn--xs btn--ghost btn--icon" title=${e.hidden ? 'Show' : 'Hide'} onClick=${ev => { ev.stopPropagation(); onAction('hide', secId(e)); }}><${I} n=${e.hidden ? 'eye-slash' : 'eye'} /></button>
      ${e.type && html`<button class="btn btn--xs btn--ghost btn--icon btn--danger" title="Remove" onClick=${ev => { ev.stopPropagation(); onAction('delete', secId(e)); }}><${I} n="trash" /></button>`}
    </div>`)}</div>`;
}
