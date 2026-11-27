/* Customers: everyone who has booked, with their consent for marketing. */
import { html, useState, useEffect, api, useApp, setState, load, can, toast, I, Avatar, StatusPill, Empty, Skeleton, Drawer, Modal, Field, fmtDay, fmtDate, ago, num, waLink, firstName, csv, today, confirmBox } from './core.js';

const FILTERS = [['all', 'Everyone'], ['subscribed', 'Happy to hear from us'], ['regulars', 'Regulars (3+ visits)'], ['lapsed', 'Not seen in 90 days'], ['new', 'New this month']];

function consentPills(c) {
  const e = c.consent && c.consent.email && c.email, w = c.consent && c.consent.whatsapp;
  if (!e && !w) return html`<span class="faint small">No</span>`;
  return html`<span class="row" style="gap:6px">${e && html`<span class="pill pill--green"><${I} n="envelope-simple" />Email</span>`}${w && html`<span class="pill pill--green"><${I} n="whatsapp-logo" />WhatsApp</span>`}</span>`;
}

export function Customers() {
  const s = useApp();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState('last_seen');
  const [adding, setAdding] = useState(false);
  useEffect(() => { load('customers'); load('bookings'); }, []);
  const all = s.customers || [];
  const tags = [...new Set(all.flatMap(c => c.tags || []))].sort();
  const d90 = new Date(Date.now() - 90 * 864e5).toISOString(), m0 = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  let list = all.filter(c => {
    if (filter === 'subscribed' && !(c.consent && (c.consent.email || c.consent.whatsapp))) return false;
    if (filter === 'regulars' && (c.bookings || 0) < 3) return false;
    if (filter === 'lapsed' && (c.last_seen || '') >= d90) return false;
    if (filter === 'new' && (c.first_seen || '') < m0) return false;
    if (tag && !(c.tags || []).includes(tag)) return false;
    return true;
  });
  const ql = q.trim().toLowerCase();
  if (ql) list = list.filter(c => (c.name + ' ' + c.phone + ' ' + (c.email || '') + ' ' + (c.tags || []).join(' ')).toLowerCase().includes(ql));
  list.sort((a, b) => sort === 'bookings' ? (b.bookings || 0) - (a.bookings || 0) : sort === 'name' ? String(a.name).localeCompare(b.name) : (a.last_seen < b.last_seen ? 1 : -1));
  const Th = ({ k, children }) => html`<th><button onClick=${() => setSort(k)}>${children}<${I} n=${sort === k ? 'caret-down' : 'caret-up-down'} /></button></th>`;
  function exportCsv() {
    csv([['Name', 'Phone', 'Email', 'Visits', 'Guests', 'First booking', 'Last booking', 'Email OK', 'WhatsApp OK', 'Tags', 'Notes']]
      .concat(list.map(c => [c.name, c.phone, c.email, c.bookings, c.guests, (c.first_seen || '').slice(0, 10), (c.last_seen || '').slice(0, 10), c.consent && c.consent.email ? 'yes' : 'no', c.consent && c.consent.whatsapp ? 'yes' : 'no', (c.tags || []).join('; '), c.notes])), 'talisman-customers-' + today() + '.csv');
    toast('Exported ' + list.length + ' customers');
  }
  return html`<div class="card">
    <div class="toolbar">
      <div class="input-icon grow" style="max-width:340px"><${I} n="magnifying-glass" /><input class="input" placeholder="Search name, phone, email or tag" value=${q} onInput=${e => setQ(e.target.value)} /></div>
      <select class="select" style="width:auto" value=${filter} onChange=${e => setFilter(e.target.value)}>${FILTERS.map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select>
      ${tags.length > 0 && html`<select class="select" style="width:auto" value=${tag} onChange=${e => setTag(e.target.value)}><option value="">Any tag</option>${tags.map(t => html`<option>${t}</option>`)}</select>`}
      <span class="grow"></span>
      <span class="muted small">${num(list.length)} people</span>
      <button class="btn" onClick=${exportCsv}><${I} n="download-simple" />Export</button>
      <button class="btn btn--primary" onClick=${() => setAdding(true)}><${I} n="plus" />Add customer</button>
    </div>
    ${!s.customers ? html`<${Skeleton} rows=${7} />` : !list.length ? html`<${Empty} icon="users-three" title=${all.length ? 'No matches' : 'No customers yet'} text=${all.length ? 'Try a different filter.' : 'Everyone who books a table is added here automatically.'} />` :
    html`<div class="table-wrap"><table class="t">
      <thead><tr><${Th} k="name">Customer</${Th}><th>Email</th><${Th} k="bookings">Visits</${Th}><${Th} k="last_seen">Last booking</${Th}><th>Marketing</th><th>Tags</th></tr></thead>
      <tbody>${list.slice(0, 300).map(c => html`<tr onClick=${() => setState({ openCustomer: c.key })}>
        <td><div class="who"><${Avatar} name=${c.name} size="sm" /><span><b>${c.name}</b><small>${c.phone}</small></span></div></td>
        <td class="muted">${c.email || '–'}</td><td>${c.bookings || 0}</td><td>${c.last_seen ? ago(c.last_seen) : '–'}</td>
        <td>${consentPills(c)}</td><td><span class="row" style="gap:4px">${(c.tags || []).slice(0, 2).map(t => html`<span class="pill">${t}</span>`)}</span></td></tr>`)}</tbody>
    </table>${list.length > 300 && html`<p class="muted small" style="padding:10px 14px">Showing 300 of ${num(list.length)}. Search to find someone.</p>`}</div>`}
  </div>
  <p class="muted small" style="padding:0 4px">Only send offers to people marked “Happy to hear from us”. They agreed on the booking form. Kenya’s data protection law requires this.</p>
  ${adding && html`<${AddCustomer} onClose=${() => setAdding(false)} />`}
  ${s.openCustomer && html`<${CustomerDrawer} id=${s.openCustomer} onClose=${() => setState({ openCustomer: null })} />`}`;
}

function AddCustomer({ onClose }) {
  const [f, setF] = useState({ name: '', phone: '+254 ', email: '', consent_email: false, consent_whatsapp: false, tags: '' });
  const up = k => e => setF(Object.assign({}, f, { [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  async function save() {
    try { await api('customers', { body: Object.assign({}, f, { tags: f.tags.split(',').map(t => t.trim()).filter(Boolean) }) }); await load('customers', true); toast('Customer added'); onClose(); }
    catch (e) { toast(e.message, true); }
  }
  return html`<${Modal} title="Add a customer" onClose=${onClose} foot=${html`<button class="btn" onClick=${onClose}>Cancel</button><button class="btn btn--primary" style="margin-left:auto" onClick=${save}>Add customer</button>`}>
    <${Field} label="Name"><input class="input" value=${f.name} onInput=${up('name')} /></${Field}>
    <div class="grid-2"><${Field} label="Phone" hint="With the country code"><input class="input" value=${f.phone} onInput=${up('phone')} /></${Field}>
    <${Field} label="Email"><input class="input" type="email" value=${f.email} onInput=${up('email')} /></${Field}></div>
    <${Field} label="Tags" hint="Separate with commas, e.g. Corporate, Wine lover"><input class="input" value=${f.tags} onInput=${up('tags')} /></${Field}>
    <div class="note note--amber"><${I} n="info" /><span>Only tick these if the person has told you they want to hear about events and offers.</span></div>
    <label class="check"><input type="checkbox" checked=${f.consent_email} onChange=${up('consent_email')} />Happy to get emails</label>
    <label class="check"><input type="checkbox" checked=${f.consent_whatsapp} onChange=${up('consent_whatsapp')} />Happy to get WhatsApp messages</label>
  </${Modal}>`;
}

function CustomerDrawer({ id, onClose }) {
  const s = useApp();
  const c = (s.customers || []).find(x => x.key === id);
  const [notes, setNotes] = useState(null);
  const [tagText, setTagText] = useState('');
  if (!c) return null;
  const visits = (s.bookings || []).filter(b => b.customer === c.key).sort((a, b) => (a.date < b.date ? 1 : -1));
  async function patch(p, msg) {
    try { const d = await api('customers', { method: 'PATCH', body: Object.assign({ key: c.key }, p) }); setState({ customers: s.customers.map(x => (x.key === c.key ? d.customer : x)) }); if (msg) toast(msg); }
    catch (e) { toast(e.message, true); }
  }
  async function forget() {
    if (!(await confirmBox('Delete ' + c.name + ' and all of their bookings? Use this when someone asks you to remove their details. It cannot be undone.', 'Delete everything'))) return;
    await api('customers', { method: 'DELETE', body: { key: c.key } });
    setState({ customers: s.customers.filter(x => x.key !== c.key), bookings: (s.bookings || []).filter(b => b.customer !== c.key) });
    onClose(); toast('Customer deleted');
  }
  const addTag = () => { const t = tagText.trim(); if (t && !(c.tags || []).includes(t)) patch({ tags: (c.tags || []).concat(t) }); setTagText(''); };
  return html`<${Drawer} title=${c.name} onClose=${onClose} head=${html`<${Avatar} name=${c.name} size="lg" />`}
    foot=${html`<a class="btn btn--primary" href=${waLink(c.phone, 'Hello ' + firstName(c.name) + ', ')} target="_blank" rel="noopener"><${I} n="whatsapp-logo" />WhatsApp</a>
      <a class="btn" href=${'tel:' + String(c.phone).replace(/[^\d+]/g, '')}><${I} n="phone" />Call</a>
      ${c.email && html`<a class="btn" href=${'mailto:' + c.email}><${I} n="envelope-simple" />Email</a>`}
      <button class="btn btn--ghost btn--danger" style="margin-left:auto" onClick=${forget}><${I} n="trash" />Delete</button>`}>
    <div class="facts">
      <div class="fact"><small>Visits</small><b>${c.bookings || 0}</b></div>
      <div class="fact"><small>Guests brought</small><b>${c.guests || 0}</b></div>
      <div class="fact"><small>First booking</small><b>${c.first_seen ? fmtDate(c.first_seen) : '–'}</b></div>
    </div>
    <dl class="kv"><dt>Phone</dt><dd>${c.phone}</dd><dt>Email</dt><dd>${c.email || html`<span class="faint">Not given</span>`}</dd></dl>
    <div class="group"><div class="group__head"><${I} n="shield-check" />Marketing permission</div><div class="group__body">
      <label class="check"><input type="checkbox" checked=${!!(c.consent && c.consent.email)} disabled=${!c.email} onChange=${e => patch({ consent: { email: e.target.checked, whatsapp: !!(c.consent && c.consent.whatsapp) } }, 'Saved')} />Happy to get emails${!c.email && html`<span class="faint small">(no email)</span>`}</label>
      <label class="check"><input type="checkbox" checked=${!!(c.consent && c.consent.whatsapp)} onChange=${e => patch({ consent: { whatsapp: e.target.checked, email: !!(c.consent && c.consent.email) } }, 'Saved')} />Happy to get WhatsApp messages</label>
      ${c.consent && c.consent.at && html`<p class="small muted">Last changed ${ago(c.consent.at)} · ${c.consent.source}</p>`}
      ${c.unsubscribed && c.unsubscribed.email && html`<p class="small" style="color:var(--red)">Unsubscribed from email ${ago(c.unsubscribed.email)}</p>`}
    </div></div>
    <div class="field"><span class="label">Tags</span><div class="chips">${(c.tags || []).map(t => html`<span class="chip is-on">${t} <button style="all:unset;cursor:pointer;margin-left:4px" aria-label=${'Remove ' + t} onClick=${() => patch({ tags: c.tags.filter(x => x !== t) })}>×</button></span>`)}
      <input class="input" style="width:150px;height:32px;border-radius:999px" placeholder="Add a tag" value=${tagText} onInput=${e => setTagText(e.target.value)} onKeyDown=${e => e.key === 'Enter' && addTag()} onBlur=${addTag} /></div></div>
    <${Field} label="Notes" hint="Preferences, allergies, favourite table. Only the team sees this."><textarea class="textarea" rows="3" value=${notes == null ? c.notes || '' : notes} onInput=${e => setNotes(e.target.value)} onBlur=${() => notes != null && patch({ notes }, 'Notes saved')}></textarea></${Field}>
    <div class="field"><span class="label">Bookings</span>${visits.length ? html`<div class="timeline">${visits.slice(0, 12).map(b => html`<div style="cursor:pointer" onClick=${() => setState({ openBooking: b.id })}><span class="grow">${fmtDay(b.date, true)} · ${b.guests} guests${b.notes ? ' · ' + b.notes : ''}</span><${StatusPill} s=${b.status} /></div>`)}</div>` : html`<p class="muted small">No bookings yet.</p>`}</div>
  </${Drawer}>`;
}
