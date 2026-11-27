/* Shared pieces: rendering, server calls, app state, formatting and small UI parts. */
import { h, html, render, useState, useEffect, useRef, useMemo, useCallback, useReducer } from '../vendor/htm-preact.js';
export { h, html, render, useState, useEffect, useRef, useMemo, useCallback, useReducer };

/* ---------------- server ---------------- */
export async function api(a, opts) {
  const o = opts || {};
  const q = new URLSearchParams(Object.assign({ a }, o.params || {}));
  const r = await fetch('/api/admin?' + q, {
    method: o.method || (o.body !== undefined ? 'POST' : 'GET'), credentials: 'same-origin',
    headers: o.body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined
  });
  const ct = r.headers.get('content-type') || '';
  const data = ct.includes('json') ? await r.json() : await r.text();
  if (r.status === 401 && !['me', 'login', 'setup', 'password'].includes(a)) { setState({ me: Object.assign({}, state.me, { user: null }) }); }
  if (!r.ok) throw new Error((data && data.error) || ('Error ' + r.status));
  return data;
}

/* ---------------- state ---------------- */
const listeners = new Set();
export const state = { me: null, bookings: null, customers: null, activity: null, pages: null, route: location.hash.slice(1) || '/' };
export function setState(patch) { Object.assign(state, patch); listeners.forEach(f => f()); }
export function useApp() {
  const [, force] = useReducer(x => x + 1, 0);
  useEffect(() => { listeners.add(force); return () => listeners.delete(force); }, []);
  return state;
}
const loading = {};
export function load(kind, force) {
  if (!force && (state[kind] || loading[kind])) return loading[kind] || Promise.resolve(state[kind]);
  loading[kind] = api(kind).then(d => { setState({ [kind]: d[kind] }); return d[kind]; })
    .catch(e => { if (!/sign in|role/i.test(e.message)) toast(e.message, true); setState({ [kind]: state[kind] || [] }); })
    .finally(() => { delete loading[kind]; });
  return loading[kind];
}
export const can = area => !!(state.me && state.me.user && state.me.user.can.includes(area));
export function go(path) { location.hash = path; }
addEventListener('hashchange', () => setState({ route: location.hash.slice(1) || '/' }));

/* ---------------- toasts ---------------- */
let toastId = 0;
export function toast(text, err) {
  const t = { id: ++toastId, text, err };
  setState({ toasts: (state.toasts || []).concat(t) });
  setTimeout(() => setState({ toasts: (state.toasts || []).filter(x => x.id !== t.id) }), err ? 6000 : 3200);
}
export function Toasts() {
  const s = useApp();
  return html`<div class="toasts" role="status" aria-live="polite">${(s.toasts || []).map(t => html`<div class=${'toast' + (t.err ? ' is-err' : '')} key=${t.id}><${I} n=${t.err ? 'warning-circle' : 'check-circle'} />${t.text}</div>`)}</div>`;
}

/* ---------------- formatting ---------------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const pad = n => String(n).padStart(2, '0');
export const isoDay = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const today = () => isoDay(new Date());
export function parseDay(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); }
export function fmtDay(s, long) {
  if (!s) return 'No date';
  const d = parseDay(s);
  const t = today(), tm = new Date(); tm.setDate(tm.getDate() + 1);
  if (s === t) return 'Today';
  if (s === isoDay(tm)) return 'Tomorrow';
  return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + (long || d.getFullYear() !== new Date().getFullYear() ? ' ' + String(d.getFullYear()).slice(long ? 0 : 2) : '');
}
export function fmtDate(iso) { const d = new Date(iso); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2); }
export function fmtTime(t) { if (!t) return 'Any time'; const [h, m] = t.split(':').map(Number); return (h % 12 || 12) + ':' + pad(m) + (h < 12 ? ' am' : ' pm'); }
export function ago(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 86400 * 7) return Math.floor(s / 86400) + ' d ago';
  return fmtDate(iso);
}
export const num = n => Number(n || 0).toLocaleString('en-KE');
export const MONTH_NAMES = MONTHS;
export const DAY_NAMES = DAYS;
export const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
export function waLink(phone, text) { return 'https://wa.me/' + String(phone || '').replace(/[^\d]/g, '') + (text ? '?text=' + encodeURIComponent(text) : ''); }
export function csv(rows, name) {
  const esc = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const text = rows.map(r => r.map(esc).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------------- small UI ---------------- */
export const I = ({ n, cls, style }) => html`<i class=${'ph ph-' + n + (cls ? ' ' + cls : '')} style=${style} aria-hidden="true"></i>`;
const AV = ['#5B6BF5', '#E0769F', '#3BA58A', '#E3A13B', '#7B5DE5', '#3B9BE8', '#C2643F', '#5E8F3A'];
export function Avatar({ name, size }) {
  const n = String(name || '?').trim();
  const ini = n.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  let hsh = 0; for (const c of n) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
  return html`<span class=${'av' + (size ? ' av--' + size : '')} style=${'background:' + AV[hsh % AV.length]} title=${n}>${ini}</span>`;
}
export const STATUS = {
  new: { label: 'New request', cls: 'pill--accent', icon: 'sparkle' },
  confirmed: { label: 'Confirmed', cls: 'pill--green', icon: 'check' },
  seated: { label: 'Seated', cls: 'pill--sky', icon: 'armchair' },
  completed: { label: 'Completed', cls: '', icon: 'check-circle' },
  cancelled: { label: 'Cancelled', cls: 'pill--red', icon: 'x' },
  no_show: { label: 'No-show', cls: 'pill--amber', icon: 'user-minus' }
};
export const StatusPill = ({ s }) => html`<span class=${'pill ' + ((STATUS[s] || {}).cls || '')}>${(STATUS[s] || { label: s }).label}</span>`;
export function Empty({ icon, title, text, children }) {
  return html`<div class="empty"><${I} n=${icon || 'tray'} /><h4>${title}</h4>${text && html`<p>${text}</p>`}${children}</div>`;
}
export function Skeleton({ rows }) {
  return html`<div style="padding:16px 20px;display:grid;gap:12px">${Array.from({ length: rows || 5 }, (_, i) => html`<div class="skel" style=${'height:44px;opacity:' + (1 - i * .13)}></div>`)}</div>`;
}
export function Switch({ on, onChange, label }) {
  return html`<button type="button" class="switch" role="switch" aria-checked=${on ? 'true' : 'false'} aria-label=${label} onClick=${() => onChange(!on)}></button>`;
}
export function Drawer({ title, onClose, children, foot, head }) {
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose(); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return html`<div class="scrim" onClick=${onClose}></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label=${title}>
      <div class="drawer__head">${head}<h3>${title}</h3><button class="iconbtn" onClick=${onClose} aria-label="Close"><${I} n="x" /></button></div>
      <div class="drawer__body">${children}</div>
      ${foot && html`<div class="drawer__foot">${foot}</div>`}
    </aside>`;
}
export function Modal({ title, onClose, children, foot, width }) {
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose(); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return html`<div class="scrim" onClick=${onClose}></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label=${title} style=${width ? '--mw:' + width + 'px' : ''}>
      <div class="drawer__head"><h3>${title}</h3><button class="iconbtn" onClick=${onClose} aria-label="Close"><${I} n="x" /></button></div>
      <div class="drawer__body">${children}</div>
      ${foot && html`<div class="drawer__foot">${foot}</div>`}
    </div>`;
}
export function Field({ label, hint, children, counter, focus }) {
  return html`<div class=${'field' + (focus ? ' is-focus' : '')}><label>${label}${counter}</label>${children}${hint && html`<p class="hint">${hint}</p>`}</div>`;
}
export function useOutside(ref, close) {
  useEffect(() => {
    const f = e => { if (ref.current && !ref.current.contains(e.target)) close(); };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, []);
}
// Confirm with a real dialog instead of window.confirm
export function confirmBox(text, okLabel) {
  return new Promise(res => setState({ confirm: { text, okLabel, res } }));
}
export function ConfirmHost() {
  const s = useApp();
  const c = s.confirm;
  if (!c) return null;
  const done = v => { setState({ confirm: null }); c.res(v); };
  return html`<${Modal} title="Are you sure?" onClose=${() => done(false)} width=${420}
    foot=${html`<button class="btn" onClick=${() => done(false)}>Keep it</button><button class="btn btn--primary" style="margin-left:auto;background:var(--red);border-color:var(--red)" onClick=${() => done(true)}>${c.okLabel || 'Yes, delete'}</button>`}>
    <p>${c.text}</p></${Modal}>`;
}

/* ---------------- pictures ---------------- */
// Uploads are shrunk in the browser first (longest side 2400 px).
export function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      const r = new FileReader(); r.onload = () => resolve({ data: r.result, name: file.name }); r.onerror = reject; r.readAsDataURL(file); return;
    }
    const img = new Image();
    img.onload = () => {
      const max = 2400, k = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * k), hh = Math.round(img.height * k);
      const c = document.createElement('canvas'); c.width = w; c.height = hh;
      const x = c.getContext('2d');
      const png = file.type === 'image/png';
      if (!png) { x.fillStyle = '#fff'; x.fillRect(0, 0, w, hh); }
      x.drawImage(img, 0, 0, w, hh);
      const data = c.toDataURL(png ? 'image/png' : 'image/jpeg', .84);
      URL.revokeObjectURL(img.src);
      resolve({ data, name: png ? file.name : file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg', width: w, height: hh });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
// Pictures uploaded in this session: shown from memory until the live site has them.
export const fresh = {};
export function imgUrl(src) { if (!src) return ''; const s = src.split('?')[0]; return fresh[s] || s; }
