/* Team members and roles, your own password, and what is connected. */
import { html, useState, useEffect, api, useApp, setState, toast, I, Avatar, Empty, Skeleton, Modal, Field, ago, confirmBox } from './core.js';

const ROLE_TEXT = {
  admin: 'Everything, including adding and removing team members.',
  manager: 'Bookings, customers and the website. Not the team.',
  editor: 'Words, pictures, menus and hours on the website.',
  frontdesk: 'Bookings and customer details.'
};

function Password({ value }) {
  return html`<div class="note"><${I} n="key" /><span class="grow">Their password, shown once: <b style="font-family:ui-monospace,monospace;font-size:15px">${value}</b><br/>
    <span class="small">Share it privately. They can change it after signing in.</span></span>
    <button class="btn btn--sm" onClick=${() => { navigator.clipboard.writeText(value); toast('Copied'); }}><${I} n="copy" />Copy</button></div>`;
}

export function Team() {
  const s = useApp();
  const [users, setUsers] = useState(null);
  const [adding, setAdding] = useState(false);
  const [shown, setShown] = useState(null);
  const refresh = () => api('users').then(d => setUsers(d.users.sort((a, b) => (a.created < b.created ? -1 : 1))));
  useEffect(() => { refresh(); }, []);
  async function patch(u, p, msg) {
    try { const d = await api('users', { method: 'PATCH', body: Object.assign({ email: u.email }, p) }); if (d.password) setShown({ name: u.name, password: d.password }); refresh(); if (msg) toast(msg); }
    catch (e) { toast(e.message, true); }
  }
  async function del(u) {
    if (!(await confirmBox('Remove ' + u.name + ' from the team? They will not be able to sign in.', 'Remove'))) return;
    try { await api('users', { method: 'DELETE', body: { email: u.email } }); refresh(); toast('Removed'); } catch (e) { toast(e.message, true); }
  }
  return html`<div class="card"><div class="card__head"><h3><${I} n="user-gear" />Team</h3><button class="btn btn--primary" onClick=${() => setAdding(true)}><${I} n="user-plus" />Add someone</button></div>
    ${shown && html`<div style="padding:12px 20px 0"><${Password} value=${shown.password} /></div>`}
    ${!users ? html`<${Skeleton} rows=${3} />` : html`<div class="table-wrap"><table class="t"><thead><tr><th>Person</th><th>Role</th><th>Last signed in</th><th></th></tr></thead>
      <tbody>${users.map(u => html`<tr style="cursor:default">
        <td><div class="who"><${Avatar} name=${u.name} size="sm" /><span><b>${u.name}${u.email === s.me.user.email ? ' (you)' : ''}</b><small>${u.email}</small></span></div></td>
        <td><select class="select" style="width:auto;height:34px" value=${u.role} onChange=${e => patch(u, { role: e.target.value }, 'Role changed')}>${Object.entries(s.me.roles).map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select>
          ${u.disabled && html` <span class="pill pill--red">Switched off</span>`}</td>
        <td class="muted">${u.last_login ? ago(u.last_login) : 'Never'}</td>
        <td class="num">${u.email !== s.me.user.email && html`<span class="row" style="justify-content:flex-end;gap:4px">
          <button class="btn btn--xs" onClick=${() => patch(u, { reset: true })}><${I} n="key" />New password</button>
          <button class="btn btn--xs" onClick=${() => patch(u, { disabled: !u.disabled }, u.disabled ? 'Switched on' : 'Switched off')}>${u.disabled ? 'Switch on' : 'Switch off'}</button>
          <button class="btn btn--xs btn--ghost btn--danger" aria-label="Remove" onClick=${() => del(u)}><${I} n="trash" /></button></span>`}</td></tr>`)}</tbody></table></div>`}
  </div>
  <div class="card"><div class="card__head"><h3><${I} n="shield-check" />What each role can do</h3></div><div class="card__body"><dl class="kv" style="grid-template-columns:150px 1fr">
    ${Object.entries(s.me.roles).map(([k, l]) => html`<dt><b style="color:var(--ink);font-weight:550">${l}</b></dt><dd class="muted">${ROLE_TEXT[k]}</dd>`)}</dl></div></div>
  ${adding && html`<${AddPerson} roles=${s.me.roles} onClose=${() => setAdding(false)} onDone=${(u, pw) => { setAdding(false); setShown({ name: u.name, password: pw }); refresh(); }} />`}`;
}

function AddPerson({ roles, onClose, onDone }) {
  const [f, setF] = useState({ name: '', email: '', role: 'frontdesk' });
  async function save() {
    try { const d = await api('users', { body: f }); onDone(d.user, d.password); toast(d.user.name + ' added'); } catch (e) { toast(e.message, true); }
  }
  return html`<${Modal} title="Add someone to the team" onClose=${onClose} foot=${html`<button class="btn" onClick=${onClose}>Cancel</button><button class="btn btn--primary" style="margin-left:auto" onClick=${save}>Add and make a password</button>`}>
    <${Field} label="Name"><input class="input" value=${f.name} onInput=${e => setF(Object.assign({}, f, { name: e.target.value }))} /></${Field}>
    <${Field} label="Email" hint="They sign in with this."><input class="input" type="email" value=${f.email} onInput=${e => setF(Object.assign({}, f, { email: e.target.value }))} /></${Field}>
    <div class="field"><span class="label">Role</span><div class="stack" style="gap:8px">${Object.entries(roles).map(([k, l]) => html`
      <label class="check" style="align-items:flex-start;padding:10px 12px;border:1px solid ${f.role === k ? 'var(--accent)' : 'var(--line)'};border-radius:10px;background:${f.role === k ? 'var(--accent-soft)' : 'transparent'}">
        <input type="radio" name="role" checked=${f.role === k} onChange=${() => setF(Object.assign({}, f, { role: k }))} style="margin-top:2px" />
        <span><b style="font-weight:550">${l}</b><br/><span class="small muted">${ROLE_TEXT[k]}</span></span></label>`)}</div></div>
  </${Modal}>`;
}

export function Account() {
  const s = useApp();
  const [f, setF] = useState({ current: '', next: '' });
  async function save(e) {
    e.preventDefault();
    try { await api('password', { body: f }); setF({ current: '', next: '' }); toast('Password changed'); } catch (x) { toast(x.message, true); }
  }
  const u = s.me.user;
  return html`<div class="card" style="max-width:560px"><div class="card__head"><h3><${I} n="user" />Your account</h3></div><div class="card__body stack">
    <div class="row"><${Avatar} name=${u.name} size="lg" /><div><b>${u.name}</b><br/><span class="muted">${u.email} · ${s.me.roles[u.role]}</span></div></div>
    <form class="stack" onSubmit=${save}>
      <${Field} label="Current password"><input class="input" type="password" autocomplete="current-password" value=${f.current} onInput=${e => setF(Object.assign({}, f, { current: e.target.value }))} /></${Field}>
      <${Field} label="New password" hint="At least 8 characters."><input class="input" type="password" autocomplete="new-password" minlength="8" value=${f.next} onInput=${e => setF(Object.assign({}, f, { next: e.target.value }))} /></${Field}>
      <button class="btn btn--primary" style="justify-self:start">Change password</button>
    </form>
  </div></div>`;
}

