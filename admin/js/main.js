/* The admin shell: sign-in, sidebar, top bar, search and routing. */
import { html, render, useState, useEffect, useRef, api, state, setState, useApp, load, can, go, toast, I, Avatar, Toasts, ConfirmHost, Switch, useOutside, fmtDay, fmtTime, ago, Modal, Field } from './core.js';
import { Dashboard } from './dashboard.js';
import { Bookings, BookingDrawer } from './bookings.js';
import { Customers } from './customers.js';
import { Pages, Media, SiteSettings, Menus } from './website.js';
import { Editor } from './editor.js';
import { Team, Account } from './team.js';

/* ---------------- sign-in and first-time setup ---------------- */
function Auth() {
  const s = useApp();
  const setup = s.me.setup.needsOwner;
  const [f, setF] = useState({ name: '', email: '', password: '', code: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const up = k => e => setF(Object.assign({}, f, { [k]: e.target.value }));
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await api(setup ? 'setup' : 'login', { body: f });
      setState({ me: await api('me') });
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  return html`<div class="auth">
    <div class="auth__art"><p>The words, pictures and bookings for The Talisman, in one place.</p></div>
    <div class="auth__form"><form class="auth__box" onSubmit=${submit}>
      <img src="/assets/img/logo.png" alt="The Talisman" />
      <div><h1>${setup ? 'Create the first admin account' : 'Sign in'}</h1>
      <p class="muted" style="margin-top:6px">${setup ? 'This account can add the rest of the team later.' : 'Use the email and password your admin gave you.'}</p></div>
      ${err && html`<div class="err" role="alert">${err}</div>`}
      ${setup && html`<${Field} label="Your name"><input class="input" required value=${f.name} onInput=${up('name')} autocomplete="name" /></${Field}>`}
      <${Field} label="Email"><input class="input" type="email" required value=${f.email} onInput=${up('email')} autocomplete="email" /></${Field}>
      <${Field} label="Password" hint=${setup ? 'At least 8 characters.' : ''}><input class="input" type="password" required minlength=${setup ? 8 : 1} value=${f.password} onInput=${up('password')} autocomplete=${setup ? 'new-password' : 'current-password'} /></${Field}>
      ${setup && !s.me.setup.local && html`<${Field} label="Setup code" hint="Your web developer has this. It stops anyone else from creating the first account."><input class="input" required value=${f.code} onInput=${up('code')} /></${Field}>`}
      <button class="btn btn--primary" style="height:44px;justify-content:center" disabled=${busy}>${busy ? 'One moment…' : setup ? 'Create account' : 'Sign in'}</button>
      ${!setup && html`<p class="small muted">Forgotten your password? Ask an admin to reset it from the Team page.</p>`}
    </form></div>
  </div>`;
}

/* ---------------- sidebar ---------------- */
const NAV = [
  { group: 'Main', items: [
    { to: '/', icon: 'squares-four', label: 'Dashboard', area: 'dashboard' },
    { to: '/bookings', icon: 'calendar-check', label: 'Bookings', area: 'bookings', sub: [['/bookings', 'Upcoming'], ['/bookings/new', 'New requests'], ['/bookings/past', 'Past bookings']] },
    { to: '/customers', icon: 'users-three', label: 'Customers', area: 'customers' }
  ] },
  { group: 'Website', items: [
    { to: '/pages', icon: 'browsers', label: 'Pages', area: 'website' },
    { to: '/media', icon: 'images', label: 'Pictures', area: 'website' },
    { to: '/menus', icon: 'book-open-text', label: 'Menus', area: 'website' },
    { to: '/site', icon: 'clock', label: 'Contact and hours', area: 'website' }
  ] },
  { group: 'Settings', items: [
    { to: '/team', icon: 'user-gear', label: 'Team', area: 'team' },
    { to: '/account', icon: 'question', label: 'Your account' }
  ] }
];
function Sidebar() {
  const s = useApp();
  const r = s.route;
  const newCount = (s.bookings || []).filter(b => b.status === 'new' && b.date >= new Date().toISOString().slice(0, 10)).length;
  const [dark, setDark] = useState(document.documentElement.dataset.theme === 'dark');
  const theme = v => { setDark(v); document.documentElement.dataset.theme = v ? 'dark' : 'light'; try { localStorage.setItem('tal-theme', v ? 'dark' : 'light'); } catch (e) {} };
  const active = to => (to === '/' ? r === '/' : r === to || r.startsWith(to + '/'));
  const local = s.me.setup.local;
  return html`<aside class="side">
    <div class="brand"><img src="/assets/img/logo.png" alt="" /><div><b>Talisman</b><small>Admin</small></div></div>
    <a class="siteswitch" href="/" target="_blank" rel="noopener"><span class="dot">T</span><span>The Talisman<small>${local ? 'Preview on this computer' : 'talisman-karen.vercel.app'}</small></span><${I} n="arrow-square-out" /></a>
    ${NAV.map(g => {
      const items = g.items.filter(it => !it.area || can(it.area));
      if (!items.length) return null;
      return html`<p class="nav__label">${g.group}</p><nav class="nav">${items.map(it => html`
        <a href=${'#' + it.to} class=${active(it.to) ? 'is-on' : ''} onClick=${() => document.querySelector('.app').classList.remove('side-open')}><${I} n=${it.icon} />${it.label}
          ${it.to === '/bookings' && newCount ? html`<span class="count">${newCount}</span>` : it.sub && html`<${I} n=${active(it.to) ? 'caret-up' : 'caret-down'} cls="faint" style="margin-left:auto" />`}</a>
        ${it.sub && active(it.to) && html`<div class="nav__sub">${it.sub.map(([to, l]) => html`<a href=${'#' + to} class=${r === to ? 'is-on' : ''}>${l}</a>`)}</div>`}`)}</nav>`;
    })}
    <div class="side__foot">
      <div class="toggle-row"><${I} n="moon" /><span>Dark mode</span><${Switch} on=${dark} onChange=${theme} label="Dark mode" /></div>
      ${local ? html`<div class="promo"><h4><${I} n="flask" /> Preview <span class="tag">Test mode</span></h4><p>You are on your computer. Bookings here are sample data, and nothing you change is live until it is pushed.</p></div>`
      : html`<div class="promo"><h4><${I} n="globe" /> Your website</h4><p>Changes you publish appear on the site in about a minute.</p><a class="btn btn--dark" href="/" target="_blank" rel="noopener">View the site</a></div>`}
    </div>
  </aside>`;
}

/* ---------------- top bar ---------------- */
function Bell() {
  const s = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  const t = new Date().toISOString().slice(0, 10);
  const items = (s.bookings || []).filter(b => b.status === 'new' && b.date >= t).sort((a, b) => (a.created < b.created ? 1 : -1));
  if (!can('bookings')) return null;
  return html`<div style="position:relative" ref=${ref}>
    <button class="iconbtn" aria-label=${items.length + ' new table requests'} onClick=${() => setOpen(!open)}><${I} n="bell" />${items.length > 0 && html`<span class="badge-dot">${items.length > 99 ? '99+' : items.length}</span>`}</button>
    ${open && html`<div class="pop" style="width:340px">
      <div class="row" style="padding:8px 10px"><b>New table requests</b><span class="grow"></span><a href="#/bookings/new" onClick=${() => setOpen(false)} class="small">See all</a></div>
      ${items.length ? items.slice(0, 6).map(b => html`<button class="item" onClick=${() => { setOpen(false); setState({ openBooking: b.id }); }}>
        <${Avatar} name=${b.name} size="sm" /><span class="grow"><b style="font-weight:550">${b.name}</b><br/><span class="small muted">${fmtDay(b.date)} · ${fmtTime(b.time)} · ${b.guests || '?'} guests</span></span><span class="small faint">${ago(b.created)}</span></button>`)
      : html`<p class="muted small" style="padding:6px 10px 12px">Nothing waiting. New requests from the website show up here.</p>`}
    </div>`}
  </div>`;
}
function UserMenu() {
  const s = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  const u = s.me.user;
  async function out() { await api('logout', { body: {} }); setState({ me: await api('me'), bookings: null, customers: null }); }
  return html`<div style="position:relative" ref=${ref}>
    <button class="userbtn" onClick=${() => setOpen(!open)} aria-label="Your account"><${Avatar} name=${u.name} /><${I} n="caret-down" /></button>
    ${open && html`<div class="pop">
      <div style="padding:8px 10px 10px"><b>${u.name}</b><br/><span class="small muted">${u.email} · ${s.me.roles[u.role]}</span></div><hr/>
      <a href="#/account" onClick=${() => setOpen(false)}><${I} n="key" /> Change password</a>
      <a href="/" target="_blank" rel="noopener"><${I} n="arrow-square-out" /> View the website</a><hr/>
      <button class="item" onClick=${out}><${I} n="sign-out" /> Sign out</button>
    </div>`}
  </div>`;
}
function TeamAvatars() {
  const [team, setTeam] = useState(null);
  useEffect(() => { if (can('team')) api('users').then(d => setTeam(d.users)).catch(() => {}); }, []);
  if (!team || !team.length) return null;
  return html`<div class="avatars">${team.slice(0, 3).map(u => html`<${Avatar} name=${u.name} />`)}${team.length > 3 && html`<span class="more">+${team.length - 3}</span>`}
    <a class="iconbtn" href="#/team" aria-label="Add someone to the team" style="margin-left:6px;border-radius:50%;width:32px;height:32px"><${I} n="plus" /></a></div>`;
}

/* ---------------- search (Cmd/Ctrl K) ---------------- */
function CommandK({ onClose }) {
  const s = useApp();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  useEffect(() => { if (can('customers')) load('customers'); }, []);
  const ql = q.trim().toLowerCase();
  const nav = NAV.flatMap(g => g.items).filter(it => !it.area || can(it.area)).map(it => ({ group: 'Go to', icon: it.icon, label: it.label, run: () => go(it.to) }));
  const results = [];
  nav.filter(n => !ql || n.label.toLowerCase().includes(ql)).forEach(n => results.push(n));
  if (ql.length > 1) {
    (s.customers || []).filter(c => (c.name + ' ' + c.phone + ' ' + (c.email || '')).toLowerCase().includes(ql)).slice(0, 6)
      .forEach(c => results.push({ group: 'Customers', icon: 'user', label: c.name, meta: c.phone, run: () => { go('/customers'); setState({ openCustomer: c.key }); } }));
    (s.bookings || []).filter(b => (b.name + ' ' + b.phone).toLowerCase().includes(ql)).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5)
      .forEach(b => results.push({ group: 'Bookings', icon: 'calendar-blank', label: b.name, meta: fmtDay(b.date) + ' · ' + b.guests + ' guests', run: () => setState({ openBooking: b.id }) }));
    (s.pages || []).filter(p => p.label.toLowerCase().includes(ql)).forEach(p => results.push({ group: 'Edit a page', icon: 'pencil-simple', label: p.label, run: () => go('/edit/' + p.name) }));
  }
  const pick = r => { onClose(); r.run(); };
  const key = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI(Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setI(Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[i]) pick(results[i]);
  };
  let lastGroup = '';
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose(); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  return html`<div class="scrim" onClick=${onClose}></div><div class="modal cmdk" role="dialog" aria-label="Search">
    <input placeholder="Search guests, bookings, pages…" value=${q} onInput=${e => { setQ(e.target.value); setI(0); }} onKeyDown=${key} ref=${el => el && !el._f && (el._f = 1, setTimeout(() => el.focus()))} />
    <div class="cmdk__list">${results.length ? results.map((r, n) => {
      const g = r.group !== lastGroup ? html`<div class="cmdk__group">${r.group}</div>` : null; lastGroup = r.group;
      return html`${g}<button class=${n === i ? 'is-on' : ''} onMouseEnter=${() => setI(n)} onClick=${() => pick(r)}><${I} n=${r.icon} />${r.label}${r.meta && html`<small>${r.meta}</small>`}</button>`;
    }) : html`<p class="muted" style="padding:14px">Nothing found for “${q}”.</p>`}</div>
  </div>`;
}

/* ---------------- routes ---------------- */
const TITLES = { '/': 'Dashboard', bookings: 'Bookings', customers: 'Customers', pages: 'Pages', media: 'Pictures', menus: 'Menus', site: 'Contact and hours', team: 'Team', account: 'Your account' };
function routeView(r) {
  const [, a, b] = r.split('/');
  const need = { bookings: 'bookings', customers: 'customers', pages: 'website', media: 'website', menus: 'website', site: 'website', edit: 'website', team: 'team' }[a];
  if (need && !can(need)) return html`<div class="card"><${Empty2} /></div>`;
  switch (a || '') {
    case '': return html`<${Dashboard} />`;
    case 'bookings': return html`<${Bookings} view=${b || 'upcoming'} />`;
    case 'customers': return html`<${Customers} />`;
    case 'pages': return html`<${Pages} />`;
    case 'media': return html`<${Media} />`;
    case 'menus': return html`<${Menus} />`;
    case 'site': return html`<${SiteSettings} />`;
    case 'team': return html`<${Team} />`;
    case 'account': return html`<${Account} />`;
    default: return html`<div class="card"><div class="empty"><h4>Page not found</h4><a href="#/">Back to the dashboard</a></div></div>`;
  }
}
const Empty2 = () => html`<div class="empty"><${I} n="lock" /><h4>Not part of your role</h4><p>Ask an admin if you need this.</p></div>`;

function Shell() {
  const s = useApp();
  const [cmd, setCmd] = useState(false);
  useEffect(() => {
    if (can('dashboard')) load('bookings');
    load('pages');
    const k = e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd(true); } };
    addEventListener('keydown', k);
    // New requests arrive while the admin is open
    const t = setInterval(() => { if (document.visibilityState === 'visible' && can('dashboard')) load('bookings', true); }, 60000);
    return () => { removeEventListener('keydown', k); clearInterval(t); };
  }, []);
  const [, a, b] = s.route.split('/');
  if (a === 'edit') return html`<${Editor} name=${b} key=${b} /><${Toasts} /><${ConfirmHost} />`;
  const title = TITLES[a || '/'] || '';
  return html`<div class="app">
    <${Sidebar} />
    <main class="main">
      <header class="top">
        <button class="iconbtn menu-btn" aria-label="Menu" onClick=${() => document.querySelector('.app').classList.toggle('side-open')}><${I} n="list" /></button>
        <h1>${title}</h1>
        <${TeamAvatars} />
        <span class="divider-v"></span>
        <${Bell} />
        <button class="search" onClick=${() => setCmd(true)}><${I} n="magnifying-glass" /><span style="text-align:left">Search anything</span><span class="kbd">${/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'} K</span></button>
        <${UserMenu} />
      </header>
      <div class="content">${routeView(s.route)}</div>
    </main>
    ${cmd && html`<${CommandK} onClose=${() => setCmd(false)} />`}
    ${s.openBooking && html`<${BookingDrawer} id=${s.openBooking} onClose=${() => setState({ openBooking: null })} />`}
    <${Toasts} /><${ConfirmHost} />
  </div>`;
}

function Root() {
  const s = useApp();
  useEffect(() => { api('me').then(me => setState({ me })).catch(e => setState({ me: { error: e.message } })); }, []);
  if (!s.me) return html`<div style="display:grid;place-items:center;height:100vh"><img src="/assets/img/logo.png" alt="Loading" style="width:64px;opacity:.5" /></div>`;
  if (s.me.error) return html`<div class="auth__form" style="min-height:100vh"><div class="auth__box"><div class="err">${s.me.error}</div></div></div>`;
  if (!s.me.user) return html`<${Auth} /><${Toasts} />`;
  return html`<${Shell} />`;
}

render(html`<${Root} />`, document.getElementById('app'));
