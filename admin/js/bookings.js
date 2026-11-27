/* Bookings: day-by-day list, filters, the booking drawer and adding phone bookings. */
import { html, useState, useEffect, useMemo, api, useApp, setState, state, load, can, toast, I, Avatar, StatusPill, STATUS, Empty, Skeleton, Drawer, Modal, Field, fmtDay, fmtTime, fmtDate, ago, num, today, waLink, firstName, csv, confirmBox } from './core.js';

const VIEWS = [['upcoming', 'Upcoming'], ['new', 'New requests'], ['today', 'Today'], ['past', 'Past'], ['all', 'All']];

export function Bookings({ view }) {
  const s = useApp();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  useEffect(() => { load('bookings'); }, []);
  const t = today();
  const all = s.bookings || [];
  const pick = {
    upcoming: b => b.date >= t && !['cancelled', 'completed', 'no_show'].includes(b.status),
    new: b => b.status === 'new' && b.date >= t,
    today: b => b.date === t,
    past: b => b.date < t,
    all: () => true
  };
  const counts = Object.fromEntries(VIEWS.map(([k]) => [k, all.filter(pick[k]).length]));
  let list = all.filter(pick[view] || pick.upcoming);
  const ql = q.trim().toLowerCase();
  if (ql) list = list.filter(b => (b.name + ' ' + b.phone + ' ' + (b.email || '') + ' ' + (b.notes || '')).toLowerCase().includes(ql));
  const past = view === 'past' || view === 'all';
  list.sort((a, b) => { const x = a.date + (a.time || '99'), y = b.date + (b.time || '99'); return past ? (x < y ? 1 : -1) : (x < y ? -1 : 1); });
  const shown = list.slice(0, 400);
  const days = [];
  shown.forEach(b => { const d = days[days.length - 1]; if (d && d.date === b.date) d.items.push(b); else days.push({ date: b.date, items: [b] }); });

  function exportCsv() {
    csv([['Date', 'Time', 'Name', 'Phone', 'Email', 'Guests', 'Status', 'Source', 'Notes', 'Staff note', 'Requested']].concat(list.map(b => [b.date, b.time, b.name, b.phone, b.email, b.guests, (STATUS[b.status] || {}).label, b.source, b.notes, b.staff_note, b.created])), 'talisman-bookings-' + today() + '.csv');
  }
  return html`<div class="card">
    <div class="tabs">${VIEWS.map(([k, l]) => html`<button class=${view === k ? 'is-on' : ''} onClick=${() => { location.hash = '/bookings' + (k === 'upcoming' ? '' : '/' + k); }}>${l}<span class="n">${num(counts[k])}</span></button>`)}</div>
    <div class="toolbar">
      <div class="input-icon grow" style="max-width:360px"><${I} n="magnifying-glass" /><input class="input" placeholder="Search name, phone or note" value=${q} onInput=${e => setQ(e.target.value)} /></div>
      <span class="grow"></span>
      <button class="btn" onClick=${exportCsv}><${I} n="download-simple" />Export</button>
      ${can('bookings') && html`<button class="btn btn--primary" onClick=${() => setAdding(true)}><${I} n="plus" />Add booking</button>`}
    </div>
    ${!s.bookings ? html`<${Skeleton} rows=${6} />` : !list.length ? html`<${Empty} icon="calendar-blank" title=${ql ? 'No matches' : view === 'new' ? 'No new requests' : 'Nothing here'} text=${view === 'new' ? 'Requests from the website booking form arrive here. You are all caught up.' : 'Try another tab or clear the search.'} />` :
    html`<div class="table-wrap"><table class="t">
      <thead><tr><th>Guest</th><th>Time</th><th class="num">Guests</th><th>Note</th><th>From</th><th>Status</th></tr></thead>
      <tbody>${days.map(d => html`
        <tr class="daygroup"><td colspan="6">${fmtDay(d.date, true)}<small>${d.items.length} table${d.items.length === 1 ? '' : 's'} · ${num(d.items.filter(b => b.status !== 'cancelled').reduce((n, b) => n + (b.guests || 0), 0))} guests</small></td></tr>
        ${d.items.map(b => html`<tr onClick=${() => setState({ openBooking: b.id })}>
          <td><div class="who"><${Avatar} name=${b.name} size="sm" /><span><b>${b.name}</b><small>${b.phone}</small></span></div></td>
          <td>${fmtTime(b.time)}</td><td class="num">${b.guests || '–'}</td>
          <td class="muted" style="max-width:260px"><div class="ellipsis">${b.notes || ''}</div></td>
          <td><span class="pill pill--outline">${b.source === 'website' ? 'Website' : b.source === 'walk-in' ? 'Walk-in' : 'Phone'}</span></td>
          <td><${StatusPill} s=${b.status} /></td></tr>`)}`)}
      </tbody></table>
      ${list.length > shown.length && html`<p class="muted small" style="padding:10px 14px">Showing the first ${shown.length} of ${num(list.length)}. Use search to narrow down.</p>`}</div>`}
  </div>
  ${adding && html`<${AddBooking} onClose=${() => setAdding(false)} />`}`;
}

function AddBooking({ onClose, preset }) {
  const [f, setF] = useState(Object.assign({ name: '', phone: '+254 ', email: '', date: today(), time: '19:00', guests: 2, notes: '', status: 'confirmed', source: 'phone', marketing: false }, preset || {}));
  const [busy, setBusy] = useState(false);
  const up = k => e => setF(Object.assign({}, f, { [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  async function save(e) {
    e && e.preventDefault(); setBusy(true);
    try { const d = await api('bookings', { body: f }); await load('bookings', true); toast('Booking added for ' + d.booking.name); onClose(); setState({ openBooking: d.booking.id }); }
    catch (x) { toast(x.message, true); }
    setBusy(false);
  }
  return html`<${Modal} title="Add a booking" onClose=${onClose} width=${560}
    foot=${html`<button class="btn" onClick=${onClose}>Cancel</button><button class="btn btn--primary" style="margin-left:auto" onClick=${save} disabled=${busy}>${busy ? 'Saving…' : 'Add booking'}</button>`}>
    <form class="stack" onSubmit=${save}>
      <div class="grid-2"><${Field} label="Name"><input class="input" required value=${f.name} onInput=${up('name')} /></${Field}>
        <${Field} label="Phone" hint="With the country code"><input class="input" required value=${f.phone} onInput=${up('phone')} /></${Field}></div>
      <${Field} label="Email (optional)"><input class="input" type="email" value=${f.email} onInput=${up('email')} /></${Field}>
      <div class="grid-2"><${Field} label="Date"><input class="input" type="date" value=${f.date} onInput=${up('date')} /></${Field}>
        <${Field} label="Time"><input class="input" type="time" step="900" value=${f.time} onInput=${up('time')} /></${Field}></div>
      <div class="grid-2"><${Field} label="Guests"><input class="input" type="number" min="1" value=${f.guests} onInput=${up('guests')} /></${Field}>
        <${Field} label="How they booked"><select class="select" value=${f.source} onChange=${up('source')}><option value="phone">Phone call</option><option value="walk-in">Walk-in</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select></${Field}></div>
      <${Field} label="Note"><textarea class="textarea" rows="2" value=${f.notes} onInput=${up('notes')} placeholder="Birthday, high chair, table by the fire…"></textarea></${Field}>
      <label class="check"><input type="checkbox" checked=${f.marketing} onChange=${up('marketing')} />They are happy to hear about events and offers</label>
    </form>
  </${Modal}>`;
}

export function BookingDrawer({ id, onClose }) {
  const s = useApp();
  const b = (s.bookings || []).find(x => x.id === id);
  const [note, setNote] = useState(null);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(null);
  useEffect(() => { if (!s.bookings) load('bookings'); }, []);
  if (!b) return s.bookings ? html`<${Drawer} title="Booking" onClose=${onClose}><${Empty} title="This booking no longer exists" /></${Drawer}>` : null;
  const editable = can('bookings');
  const history = (s.bookings || []).filter(x => x.customer === b.customer);
  async function patch(p, msg) {
    try {
      const d = await api('bookings', { method: 'PATCH', body: Object.assign({ id: b.id }, p) });
      setState({ bookings: s.bookings.map(x => (x.id === b.id ? d.booking : x)) });
      if (msg) toast(msg);
    } catch (e) { toast(e.message, true); }
  }
  async function remove() {
    if (!(await confirmBox('Delete the booking for ' + b.name + '? This cannot be undone.'))) return;
    await api('bookings', { method: 'DELETE', body: { id: b.id } });
    setState({ bookings: s.bookings.filter(x => x.id !== b.id) }); onClose(); toast('Booking deleted');
  }
  const when = fmtDay(b.date, true) + (b.time ? ' at ' + fmtTime(b.time) : '');
  const confirmMsg = 'Hello ' + firstName(b.name) + ', this is The Talisman. Your table for ' + (b.guests || '') + ' on ' + when.replace(/^Today/, 'today').replace(/^Tomorrow/, 'tomorrow') + ' is confirmed. We look forward to seeing you. If your plans change, just reply here.';
  return html`<${Drawer} title=${b.name} onClose=${onClose} head=${html`<${Avatar} name=${b.name} size="lg" />`}
    foot=${editable && html`<a class="btn btn--primary" href=${waLink(b.phone, confirmMsg)} target="_blank" rel="noopener" onClick=${() => b.status === 'new' && patch({ status: 'confirmed' }, 'Marked as confirmed')}><${I} n="whatsapp-logo" />${b.status === 'new' ? 'Confirm on WhatsApp' : 'WhatsApp'}</a>
      <a class="btn" href=${'tel:' + b.phone.replace(/[^\d+]/g, '')}><${I} n="phone" />Call</a>
      ${b.email && html`<a class="btn" href=${'mailto:' + b.email}><${I} n="envelope-simple" />Email</a>`}
      <button class="btn btn--ghost btn--danger" style="margin-left:auto" onClick=${remove} aria-label="Delete booking"><${I} n="trash" /></button>`}>
    <div class="row row--wrap"><${StatusPill} s=${b.status} /><span class="muted small">Requested ${ago(b.created)} ${b.source === 'website' ? 'on the website' : 'by ' + b.source}</span></div>
    <div class="facts">
      <div class="fact"><small>Date</small><b>${fmtDay(b.date)}</b></div>
      <div class="fact"><small>Time</small><b>${fmtTime(b.time)}</b></div>
      <div class="fact"><small>Guests</small><b>${b.guests || '–'}</b></div>
    </div>
    ${editable && html`<div class="field"><span class="label">Status</span><div class="status-row">${['new', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'].map(k => html`
      <button class=${b.status === k ? 'is-on' : ''} onClick=${() => patch({ status: k }, 'Marked as ' + STATUS[k].label.toLowerCase())}><${I} n=${STATUS[k].icon} />${STATUS[k].label}</button>`)}</div></div>`}
    ${b.notes && html`<div class="note"><${I} n="chat-text" /><span>${b.notes}</span></div>`}
    ${edit ? html`<div class="stack">
        <div class="grid-2"><${Field} label="Date"><input class="input" type="date" value=${f.date} onInput=${e => setF(Object.assign({}, f, { date: e.target.value }))} /></${Field}>
        <${Field} label="Time"><input class="input" type="time" step="900" value=${f.time} onInput=${e => setF(Object.assign({}, f, { time: e.target.value }))} /></${Field}></div>
        <div class="grid-2"><${Field} label="Guests"><input class="input" type="number" min="1" value=${f.guests} onInput=${e => setF(Object.assign({}, f, { guests: e.target.value }))} /></${Field}>
        <${Field} label="Table"><input class="input" value=${f.table || ''} placeholder="e.g. Gazebo 2" onInput=${e => setF(Object.assign({}, f, { table: e.target.value }))} /></${Field}></div>
        <div class="row"><button class="btn btn--primary" onClick=${() => { patch(f, 'Booking updated'); setEdit(false); }}>Save changes</button><button class="btn btn--ghost" onClick=${() => setEdit(false)}>Cancel</button></div>
      </div>`
    : html`<dl class="kv">
        <dt>Phone</dt><dd>${b.phone}</dd>
        <dt>Email</dt><dd>${b.email || html`<span class="faint">Not given</span>`}</dd>
        <dt>Table</dt><dd>${b.table || html`<span class="faint">Not set</span>`}</dd>
        <dt>Marketing</dt><dd>${b.marketing ? html`<span class="pill pill--green">Happy to hear from us</span>` : html`<span class="faint">No</span>`}</dd>
      </dl>
      ${editable && html`<button class="btn btn--sm" style="justify-self:start" onClick=${() => { setF({ date: b.date, time: b.time, guests: b.guests, table: b.table }); setEdit(true); }}><${I} n="pencil-simple" />Change date, time or table</button>`}`}
    ${editable && html`<${Field} label="Staff note" hint="Only the team sees this."><textarea class="textarea" rows="2" value=${note == null ? b.staff_note || '' : note} onInput=${e => setNote(e.target.value)} onBlur=${() => note != null && note !== (b.staff_note || '') && patch({ staff_note: note }, 'Note saved')}></textarea></${Field}>`}
    ${history.length > 1 && html`<div class="field"><span class="label">Visits by ${firstName(b.name)} (${history.length})</span>
      <div class="timeline">${history.sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 8).map(x => html`<div><span class="grow">${fmtDay(x.date, true)} · ${x.guests} guests</span><${StatusPill} s=${x.status} /></div>`)}</div></div>`}
    <div class="field"><span class="label">History</span><div class="timeline">${(b.history || []).map(h => html`<div><span>${(STATUS[h.status] || { label: h.status }).label} by ${h.by}</span><span class="faint small">${ago(h.at)}</span></div>`)}</div></div>
  </${Drawer}>`;
}
