/* Website: page list, picture library, contact details and hours, menus. */
import { html, useState, useEffect, useRef, api, useApp, setState, load, toast, I, Empty, Skeleton, Modal, Drawer, Field, ago, num, shrinkImage, fresh, imgUrl, confirmBox, go } from './core.js';

const live = s => (s.me && s.me.setup.files_live ? 'Saved. The website updates in about a minute.' : 'Saved and live on your preview.');

/* ---------------- uploading ---------------- */
export async function uploadFiles(fileList, dir) {
  const out = [];
  for (const file of fileList) {
    try {
      const img = await shrinkImage(file);
      const d = await api('media', { body: { name: img.name, data: img.data, dir } });
      if (/^data:image/.test(img.data)) fresh[d.file.path] = img.data;
      out.push(d.file);
    } catch (e) { toast(file.name + ': ' + e.message, true); }
  }
  if (out.length) toast(out.length === 1 ? 'Uploaded ' + out[0].name : 'Uploaded ' + out.length + ' files');
  return out;
}
function Dropzone({ dir, onDone, accept, label }) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inp = useRef(null);
  async function take(files) { setBusy(true); const r = await uploadFiles([...files], dir); setBusy(false); onDone(r); }
  return html`<div class=${'dropzone' + (over ? ' is-over' : '')} onClick=${() => inp.current.click()} onDragOver=${e => { e.preventDefault(); setOver(true); }} onDragLeave=${() => setOver(false)}
    onDrop=${e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }} role="button" tabindex="0">
    <${I} n=${busy ? 'spinner-gap' : 'upload-simple'} /> ${busy ? 'Uploading…' : label || 'Drop pictures here or click to upload'}
    <div class="small faint" style="margin-top:4px">${accept === '.pdf' ? 'PDF, up to 5 MB' : 'JPG, PNG or WebP. Large photos are made smaller for the web automatically.'}</div>
    <input type="file" ref=${inp} hidden multiple accept=${accept || 'image/jpeg,image/png,image/webp,image/svg+xml'} onChange=${e => take(e.target.files)} />
  </div>`;
}

/* ---------------- picture picker ---------------- */
export function MediaPicker({ onPick, onClose, dir }) {
  const [files, setFiles] = useState(null);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const refresh = () => api('media', { params: { dir: dir || '' } }).then(d => setFiles(d.files.sort((a, b) => (b.modified || 0) - (a.modified || 0))));
  useEffect(() => { refresh(); }, []);
  const list = (files || []).filter(f => !/\.pdf$/i.test(f.name) && f.name.toLowerCase().includes(q.toLowerCase()));
  return html`<${Modal} title="Choose a picture" onClose=${onClose} width=${900}
    foot=${html`<span class="muted small">${sel ? sel.name : 'Click a picture to choose it'}</span><button class="btn btn--primary" style="margin-left:auto" disabled=${!sel} onClick=${() => onPick('/' + sel.path.replace(/^\//, ''))}>Use this picture</button>`}>
    <${Dropzone} dir=${dir} onDone=${r => { refresh(); if (r[0]) setSel(Object.assign({}, r[0], { path: r[0].path })); }} />
    <div class="input-icon"><${I} n="magnifying-glass" /><input class="input" placeholder="Search by file name" value=${q} onInput=${e => setQ(e.target.value)} /></div>
    ${!files ? html`<${Skeleton} rows=${3} />` : html`<div class="mediagrid">${list.map(f => html`<button class=${'mediaitem' + (sel && sel.path === f.path ? ' is-on' : '')} onClick=${() => setSel(f)} onDblClick=${() => onPick('/' + f.path.replace(/^\//, ''))}>
      <img loading="lazy" src=${imgUrl('/' + f.path.replace(/^\//, ''))} alt="" onError=${e => { e.target.onerror = null; e.target.src = '/api/admin?a=raw&path=' + encodeURIComponent(f.path); }} /><span>${f.name}</span></button>`)}</div>`}
  </${Modal}>`;
}
export function ImageField({ label, value, onChange, noAlt, dir, focus, hint }) {
  const [open, setOpen] = useState(false);
  const v = value || {};
  return html`<div class=${'field' + (focus ? ' is-focus' : '')}><label>${label}</label>
    <div class="imgfield">${v.src ? html`<img src=${imgUrl(v.src)} alt="" onError=${e => { e.target.onerror = null; e.target.src = '/api/admin?a=raw&path=' + encodeURIComponent(v.src.split('?')[0]); }} />` : html`<span class="ph-box"><${I} n="image" /></span>`}
      <div class="grow"><div class="name ellipsis">${v.src ? v.src.split('/').pop() : 'No picture'}</div>
        <div class="row" style="margin-top:6px;gap:6px"><button class="btn btn--xs" onClick=${() => setOpen(true)}><${I} n="swap" />${v.src ? 'Replace' : 'Choose'}</button>
        ${v.src && noAlt && html`<button class="btn btn--xs btn--ghost" onClick=${() => onChange(Object.assign({}, v, { src: '' }))}>Remove</button>`}</div></div></div>
    ${!noAlt && html`<input class="input" placeholder="Describe the picture in a few words" value=${v.alt || ''} onInput=${e => onChange(Object.assign({}, v, { alt: e.target.value }))} />
      <p class="hint">${hint || 'The description helps Google and people using screen readers.'}</p>`}
    ${open && html`<${MediaPicker} dir=${dir} onClose=${() => setOpen(false)} onPick=${src => { setOpen(false); onChange(Object.assign({}, v, { src })); }} />`}
  </div>`;
}

/* ---------------- pages ---------------- */
export function Pages() {
  const s = useApp();
  useEffect(() => { load('pages', true); }, []);
  if (!s.pages) return html`<div class="card"><${Skeleton} rows=${4} /></div>`;
  return html`<div class="card"><div class="card__head"><h3><${I} n="browsers" />Pages</h3><span class="muted small">Click a page to edit its words, pictures and sections.</span></div>
    <div class="pagegrid">${s.pages.map(p => html`<button class="pagecard" onClick=${() => go('/edit/' + p.name)}>
      <div class="pagecard__thumb"><iframe src=${'/' + p.file} loading="lazy" tabindex="-1" title=${p.label}></iframe></div>
      <div class="pagecard__meta"><span class="grow"><b>${p.label}</b><br/><span class="small muted">/${p.file === 'index.html' ? '' : p.file}</span></span>
        ${p.draft ? html`<span class="pill pill--amber" title=${'Saved by ' + p.draft_by}>Draft · ${ago(p.draft_at)}</span>` : html`<span class="pill pill--green">Live</span>`}</div>
    </button>`)}</div></div>`;
}

/* ---------------- picture library ---------------- */
export function Media() {
  const [files, setFiles] = useState(null);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const refresh = () => api('media').then(d => setFiles(d.files.sort((a, b) => (b.modified || 0) - (a.modified || 0))));
  useEffect(() => { refresh(); }, []);
  const list = (files || []).filter(f => f.name.toLowerCase().includes(q.toLowerCase()));
  async function del() {
    if (!(await confirmBox('Delete ' + sel.name + ' from the website?'))) return;
    try { await api('media', { method: 'DELETE', body: { path: sel.path } }); setSel(null); refresh(); toast('Deleted'); } catch (e) { toast(e.message, true); }
  }
  return html`<div class="card"><div class="toolbar">
      <div class="input-icon grow" style="max-width:340px"><${I} n="magnifying-glass" /><input class="input" placeholder="Search pictures" value=${q} onInput=${e => setQ(e.target.value)} /></div>
      <span class="grow"></span><span class="muted small">${files ? num(files.length) + ' pictures' : ''}</span></div>
    <div class="card__body stack"><${Dropzone} onDone=${refresh} />
      ${!files ? html`<${Skeleton} rows=${3} />` : html`<div class="mediagrid">${list.map(f => html`<button class="mediaitem" onClick=${() => setSel(f)}><img loading="lazy" src=${imgUrl('/' + f.path)} alt="" onError=${e => { e.target.onerror = null; e.target.src = '/api/admin?a=raw&path=' + encodeURIComponent(f.path); }} /><span>${f.name}</span></button>`)}</div>`}
    </div></div>
    ${sel && html`<${Drawer} title=${sel.name} onClose=${() => setSel(null)} foot=${html`<button class="btn" onClick=${() => { navigator.clipboard.writeText('/' + sel.path); toast('Address copied'); }}><${I} n="copy" />Copy address</button>
      <button class="btn btn--ghost btn--danger" style="margin-left:auto" onClick=${del}><${I} n="trash" />Delete</button>`}>
      <img src=${imgUrl('/' + sel.path)} alt="" style="width:100%;border-radius:12px;background:var(--sunken)" />
      <dl class="kv"><dt>Address</dt><dd>/${sel.path}</dd><dt>Size</dt><dd>${(sel.size / 1024 / 1024).toFixed(2)} MB</dd></dl>
      <p class="small muted">Pictures still used on a page cannot be deleted. Replace them on the page first.</p>
    </${Drawer}>`}`;
}

/* ---------------- contact details and opening hours ---------------- */
const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function SiteSettings() {
  const s = useApp();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('settings', { params: { file: 'site' } }).then(r => setD(r.data)); }, []);
  if (!d) return html`<div class="card"><${Skeleton} rows=${6} /></div>`;
  const up = k => e => setD(Object.assign({}, d, { [k]: e.target.value }));
  const setRow = (i, p) => setD(Object.assign({}, d, { hours: d.hours.map((r, j) => (j === i ? Object.assign({}, r, p) : r)) }));
  async function save() {
    setBusy(true);
    try { await api('settings', { params: { file: 'site' }, body: { data: d } }); toast(live(s)); } catch (e) { toast(e.message, true); }
    setBusy(false);
  }
  return html`<div class="dash-2" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
    <div class="card"><div class="card__head"><h3><${I} n="address-book" />Contact details</h3></div><div class="card__body stack">
      <p class="muted small">These appear in the footer, the contact section, the thank-you page and the details Google shows.</p>
      <div class="grid-2"><${Field} label="Phone number" hint="As guests should see it"><input class="input" value=${d.phone} onInput=${up('phone')} /></${Field}>
      <${Field} label="Email"><input class="input" type="email" value=${d.email} onInput=${up('email')} /></${Field}></div>
      <${Field} label="Address, first line"><input class="input" value=${d.address_line_1} onInput=${up('address_line_1')} /></${Field}>
      <${Field} label="Address, second line"><input class="input" value=${d.address_line_2} onInput=${up('address_line_2')} /></${Field}>
      <${Field} label="Instagram page"><input class="input" value=${d.instagram} onInput=${up('instagram')} /></${Field}>
      <${Field} label="Facebook page"><input class="input" value=${d.facebook} onInput=${up('facebook')} /></${Field}>
    </div></div>
    <div class="card"><div class="card__head"><h3><${I} n="clock" />Opening hours</h3></div><div class="card__body stack">
      ${d.hours.map((r, i) => html`<div class="hours-row" style="grid-template-columns:1fr">
        <div class="grid-2"><${Field} label="Shown as"><input class="input" value=${r.label} onInput=${e => setRow(i, { label: e.target.value })} /></${Field}>
          <div class="grid-2"><${Field} label="Opens"><input class="input" type="time" value=${r.opens} onInput=${e => setRow(i, { opens: e.target.value })} /></${Field}>
          <${Field} label="Closes"><input class="input" type="time" value=${r.closes} onInput=${e => setRow(i, { closes: e.target.value })} /></${Field}></div></div>
        <div class="row"><div class="chips grow">${WEEK.map(w => html`<button class=${'chip' + (r.days.includes(w) ? ' is-on' : '')} onClick=${() => setRow(i, { days: r.days.includes(w) ? r.days.filter(x => x !== w) : WEEK.filter(x => x === w || r.days.includes(x)) })}>${w.slice(0, 3)}</button>`)}</div>
          <button class="btn btn--ghost btn--sm btn--danger" onClick=${() => setD(Object.assign({}, d, { hours: d.hours.filter((_, j) => j !== i) }))} aria-label="Remove these hours"><${I} n="trash" /></button></div>
      </div>`)}
      <button class="btn btn--sm" style="justify-self:start" onClick=${() => setD(Object.assign({}, d, { hours: d.hours.concat({ label: '', days: [], opens: '10:00', closes: '22:00' }) }))}><${I} n="plus" />Add opening times</button>
      <${Field} label="Closed all day" hint="The booking form will not accept these days."><div class="chips">${WEEK.map(w => html`<button class=${'chip' + ((d.closed_days || []).includes(w) ? ' is-on' : '')} onClick=${() => setD(Object.assign({}, d, { closed_days: (d.closed_days || []).includes(w) ? d.closed_days.filter(x => x !== w) : WEEK.filter(x => x === w || (d.closed_days || []).includes(x)) }))}>${w}</button>`)}</div></${Field}>
    </div></div>
  </div>
  <div class="row"><span class="grow"></span><button class="btn btn--primary" onClick=${save} disabled=${busy}><${I} n="check" />${busy ? 'Saving…' : 'Save and publish'}</button></div>`;
}

/* ---------------- menus ---------------- */
const MENUS = [['main', 'Main menu'], ['breakfast', 'Breakfast'], ['tea', 'Afternoon tea'], ['coffee', 'Coffee'], ['wine', 'Wine list'], ['cocktails', 'Cocktails']];
export function Menus() {
  const s = useApp();
  const [d, setD] = useState(null);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('settings', { params: { file: 'menus' } }).then(r => setD(r.data)); }, []);
  if (!d) return html`<div class="card"><${Skeleton} rows=${6} /></div>`;
  const setMenu = (k, p) => setD(Object.assign({}, d, { [k]: Object.assign({}, d[k], p) }));
  async function save() { setBusy(true); try { await api('settings', { params: { file: 'menus' }, body: { data: d } }); toast(live(s)); } catch (e) { toast(e.message, true); } setBusy(false); }
  async function pdf(k, file) { const r = await uploadFiles([file], 'menus'); if (r[0]) setMenu(k, { pdf: r[0].path }); }
  return html`<p class="muted">Each menu has a PDF guests can download, and a picture of each page that shows on the site.</p>
  <div class="pagegrid" style="padding:0;grid-template-columns:repeat(auto-fill,minmax(330px,1fr))">${MENUS.map(([k, label]) => {
    const m = d[k] || { pdf: '', pages: [] };
    return html`<div class="card"><div class="card__head"><h3><${I} n="book-open-text" />${label}</h3></div><div class="card__body stack">
      <div class="imgfield"><span class="ph-box"><${I} n="file-pdf" /></span><div class="grow"><div class="name ellipsis">${m.pdf ? m.pdf.split('/').pop() : 'No PDF'}</div>
        <div class="row" style="gap:6px;margin-top:6px">${m.pdf && html`<a class="btn btn--xs" href=${m.pdf} target="_blank" rel="noopener">Open</a>`}
        <label class="btn btn--xs"><${I} n="upload-simple" />Upload new PDF<input type="file" hidden accept="application/pdf" onChange=${e => e.target.files[0] && pdf(k, e.target.files[0])} /></label></div></div></div>
      <div class="field"><span class="label">Pages (${(m.pages || []).length})</span><div class="mediagrid" style="grid-template-columns:repeat(4,1fr);gap:8px">
        ${(m.pages || []).map((p, i) => html`<div class="mediaitem" style="aspect-ratio:3/4;cursor:default"><img src=${imgUrl(p.image)} alt="" />
          <span style="display:flex;gap:2px;justify-content:flex-end;padding:4px">
            ${i > 0 && html`<button class="btn btn--xs btn--icon" style="width:24px;height:24px" aria-label="Move earlier" onClick=${() => { const a = m.pages.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; setMenu(k, { pages: a }); }}><${I} n="arrow-left" /></button>`}
            <button class="btn btn--xs btn--icon" style="width:24px;height:24px" aria-label="Remove page" onClick=${() => setMenu(k, { pages: m.pages.filter((_, j) => j !== i) })}><${I} n="x" /></button></span></div>`)}
        <button class="mediaitem" style="aspect-ratio:3/4;display:grid;place-items:center;color:var(--muted);border:1.5px dashed var(--line-2)" onClick=${() => setPick(k)}><${I} n="plus" /></button>
      </div></div>
    </div></div>`;
  })}</div>
  <div class="row"><span class="grow"></span><button class="btn btn--primary" onClick=${save} disabled=${busy}><${I} n="check" />${busy ? 'Saving…' : 'Save and publish menus'}</button></div>
  ${pick && html`<${MediaPicker} dir="menu-pages" onClose=${() => setPick(null)} onPick=${src => { setMenu(pick, { pages: (d[pick].pages || []).concat({ image: src }) }); setPick(null); }} />`}`;
}
