/* The admin's server side: sign-in, bookings, customers, website
   content and team. One handler for every /api/admin call (?a=<action>),
   plus the public booking form (/api/book).

   Runs as Vercel functions (api/*.js) and inside `npm run dev`. */

const crypto = require('crypto');
const path = require('path');
const store = require('./store');
const files = require('./files');
const messages = require('./messages');

/* ------------------------------------------------------------ plumbing */
function send(res, code, data, headers) {
  res.statusCode = code;
  res.setHeader('Content-Type', typeof data === 'string' ? 'text/html; charset=utf-8' : 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers || {})) res.setHeader(k, v);
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
}
async function body(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 8e6) throw Object.assign(new Error('That file is too large.'), { status: 413 }); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return {}; }
}
function query(req) { return Object.fromEntries(new URL(req.url, 'http://x').searchParams); }
function fail(status, message) { const e = new Error(message); e.status = status; throw e; }
function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
const now = () => new Date().toISOString();
const clean = (s, n) => String(s == null ? '' : s).trim().slice(0, n || 200);
const phoneKey = p => String(p || '').replace(/[^\d]/g, '');

/* ------------------------------------------------------------ team and roles */
const ROLES = {
  admin:     { label: 'Admin', can: ['dashboard', 'bookings', 'customers', 'website', 'team'] },
  manager:   { label: 'Manager', can: ['dashboard', 'bookings', 'customers', 'website'] },
  editor:    { label: 'Website editor', can: ['dashboard', 'website'] },
  frontdesk: { label: 'Front desk', can: ['dashboard', 'bookings', 'customers'] }
};
function hashPassword(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  return { salt, hash: crypto.scryptSync(String(pw), salt, 32).toString('hex') };
}
function publicUser(u) { return u && { email: u.email, name: u.name, role: u.role, created: u.created, last_login: u.last_login, disabled: !!u.disabled, can: (ROLES[u.role] || {}).can || [] }; }

const COOKIE = 'tal_admin';
const DAYS = 14;
function sign(s) { return crypto.createHmac('sha256', store.secret()).update(s).digest('base64url'); }
function sessionCookie(user) {
  const payload = Buffer.from(JSON.stringify({ e: user.email, x: Date.now() + DAYS * 864e5, v: user.hash.slice(0, 8) })).toString('base64url');
  return COOKIE + '=' + payload + '.' + sign(payload) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + DAYS * 86400 + (store.LOCAL ? '' : '; Secure');
}
async function currentUser(req) {
  const raw = cookies(req)[COOKIE];
  if (!raw || !store.secret()) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig || sign(payload) !== sig) return null;
  let s; try { s = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch (e) { return null; }
  if (!s.x || s.x < Date.now()) return null;
  const u = await store.get('users', s.e);
  if (!u || u.disabled || u.hash.slice(0, 8) !== s.v) return null; // a password change signs everyone out
  return u;
}
function need(user, area) { if (!user) fail(401, 'Please sign in.'); if (!(ROLES[user.role] || { can: [] }).can.includes(area)) fail(403, 'Your role cannot do that.'); }

async function log(user, type, text, extra) {
  await store.set('activity', store.id('a'), Object.assign({ at: now(), by: user ? user.name : 'Website', type, text }, extra || {}));
}

/* ------------------------------------------------------------ bookings and customers */
async function upsertCustomer(b, consent) {
  const key = phoneKey(b.phone);
  if (!key) return null;
  const c = (await store.get('customers', key)) || { key, first_seen: b.created, bookings: 0, guests: 0, tags: [], consent: { email: false, whatsapp: false } };
  c.name = b.name || c.name;
  c.phone = b.phone || c.phone;
  if (b.email) c.email = b.email;
  c.last_seen = b.created;
  c.bookings = (c.bookings || 0) + 1;
  c.guests = (c.guests || 0) + (Number(b.guests) || 0);
  if (consent) c.consent = { email: !!c.email, whatsapp: true, at: b.created, source: b.source === 'website' ? 'Booking form' : 'Added by staff' };
  await store.set('customers', key, c);
  return key;
}

async function createBooking(input, source, user) {
  const b = {
    id: store.id('b'), created: now(), source,
    name: clean(input.name, 80), phone: clean(input.phone, 30), email: clean(input.email, 120).toLowerCase(),
    date: /^\d{4}-\d{2}-\d{2}$/.test(input.date || '') ? input.date : '',
    time: /^\d{2}:\d{2}$/.test(input.time || '') ? input.time : '',
    guests: Math.max(0, Math.min(200, parseInt(input.guests, 10) || 0)),
    notes: clean(input.notes, 1200), status: input.status && user ? input.status : 'new', marketing: !!input.marketing,
    history: [{ at: now(), by: user ? user.name : 'Website', status: 'new' }]
  };
  if (!b.name || phoneKey(b.phone).length < 7) fail(400, 'A name and phone number are needed.');
  b.customer = await upsertCustomer(b, b.marketing);
  await store.set('bookings', b.id, b);
  await log(user, 'booking', (user ? 'Added a booking for ' : 'New table request from ') + b.name, { ref: b.id });
  return b;
}

const ALLOWED_STATUS = ['new', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'];

/* ------------------------------------------------------------ website content */
let build = null;
function cms() { if (!build) build = { b: require('../tools/cms/build'), lib: require('../tools/cms/lib') }; return build; }
function pageInfo(name) { const p = cms().lib.PAGES.find(x => x.name === name); if (!p) fail(404, 'No such page.'); return p; }
function schemaFor(p) {
  return cms().lib.readSchema(p.file).sections.map(s => ({
    key: s.key, label: s.label,
    fields: s.fields.map(f => ({ key: f.key, label: f.label, type: f.type, long: !!f.long, mobile: !!f.mobile })),
    lists: s.lists.map(l => ({ key: l.key, label: l.label, item: l.item, fields: l.fields.map(f => ({ key: f.key, label: f.label, type: f.type, long: !!f.long })) })),
    rich: s.rich.map(r => ({ key: r.key, label: r.label }))
  }));
}
async function readJsonFile(p, fallback) { const t = await files.read(p); try { return t ? JSON.parse(t) : fallback; } catch (e) { return fallback; } }

/* ------------------------------------------------------------ handlers */
const routes = {};

routes.me = async (req, user) => {
  const users = await store.all('users').catch(() => ({}));
  return {
    user: publicUser(user), roles: Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, v.label])),
    setup: { needsOwner: !Object.keys(users).length, local: store.LOCAL, database: store.READY, database_live: store.REMOTE, files: files.READY, files_live: files.USE_GITHUB, secret: !!store.secret(), code: !!process.env.ADMIN_SETUP_CODE }
  };
};

routes.setup = async (req) => {
  const b = await body(req);
  if (Object.keys(await store.all('users')).length) fail(400, 'The first account already exists. Please sign in.');
  if (!store.LOCAL && (!process.env.ADMIN_SETUP_CODE || b.code !== process.env.ADMIN_SETUP_CODE)) fail(403, 'That setup code is not right.');
  if (!store.secret()) fail(503, 'SESSION_SECRET is missing.');
  const email = clean(b.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || String(b.password || '').length < 8) fail(400, 'Use a real email and a password of at least 8 characters.');
  const u = Object.assign({ email, name: clean(b.name, 60) || email, role: 'admin', created: now() }, hashPassword(b.password));
  await store.set('users', email, u);
  return { ok: true, _cookie: sessionCookie(u), user: publicUser(u) };
};

routes.login = async (req) => {
  const b = await body(req);
  const email = clean(b.email, 120).toLowerCase();
  if ((await store.hit('login:' + email, 900)) > 8) fail(429, 'Too many tries. Please wait 15 minutes.');
  const u = await store.get('users', email);
  const ok = u && !u.disabled && crypto.timingSafeEqual(Buffer.from(hashPassword(b.password || '', u.salt).hash, 'hex'), Buffer.from(u.hash, 'hex'));
  if (!ok) fail(401, 'That email and password do not match.');
  u.last_login = now();
  await store.set('users', email, u);
  return { ok: true, _cookie: sessionCookie(u), user: publicUser(u) };
};
routes.logout = async () => ({ ok: true, _cookie: COOKIE + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });

routes.password = async (req, user) => {
  if (!user) fail(401, 'Please sign in.');
  const b = await body(req);
  if (hashPassword(b.current || '', user.salt).hash !== user.hash) fail(400, 'Your current password is not right.');
  if (String(b.next || '').length < 8) fail(400, 'Use at least 8 characters.');
  Object.assign(user, hashPassword(b.next));
  await store.set('users', user.email, user);
  return { ok: true, _cookie: sessionCookie(user) };
};

/* team */
routes.users = async (req, user) => {
  need(user, 'team');
  if (req.method === 'GET') return { users: Object.values(await store.all('users')).map(publicUser) };
  const b = await body(req);
  const email = clean(b.email, 120).toLowerCase();
  if (req.method === 'POST') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Please enter a valid email.');
    if (await store.get('users', email)) fail(400, 'That person already has an account.');
    if (!ROLES[b.role]) fail(400, 'Choose a role.');
    const temp = crypto.randomBytes(6).toString('base64url');
    const u = Object.assign({ email, name: clean(b.name, 60) || email, role: b.role, created: now(), invited_by: user.name }, hashPassword(temp));
    await store.set('users', email, u);
    await log(user, 'team', 'Added ' + u.name + ' as ' + ROLES[b.role].label);
    return { user: publicUser(u), password: temp };
  }
  const u = await store.get('users', email);
  if (!u) fail(404, 'No such person.');
  if (req.method === 'PATCH') {
    if (b.role && ROLES[b.role]) { if (u.email === user.email && b.role !== 'admin') fail(400, 'You cannot remove your own admin role.'); u.role = b.role; }
    if (typeof b.disabled === 'boolean') { if (u.email === user.email) fail(400, 'You cannot switch off your own account.'); u.disabled = b.disabled; }
    let temp;
    if (b.reset) { temp = crypto.randomBytes(6).toString('base64url'); Object.assign(u, hashPassword(temp)); }
    await store.set('users', email, u);
    return { user: publicUser(u), password: temp };
  }
  if (req.method === 'DELETE') {
    if (u.email === user.email) fail(400, 'You cannot delete your own account.');
    await store.del('users', email);
    await log(user, 'team', 'Removed ' + u.name);
    return { ok: true };
  }
};

/* bookings */
routes.bookings = async (req, user) => {
  if (req.method === 'GET') { need(user, 'dashboard'); return { bookings: Object.values(await store.all('bookings')) }; }
  need(user, 'bookings');
  const b = await body(req);
  if (req.method === 'POST') return { booking: await createBooking(b, b.source || 'phone', user) };
  const cur = await store.get('bookings', b.id);
  if (!cur) fail(404, 'That booking no longer exists.');
  if (req.method === 'PATCH') {
    for (const k of ['name', 'phone', 'email', 'date', 'time', 'notes', 'staff_note', 'table']) if (k in b) cur[k] = clean(b[k], k === 'notes' || k === 'staff_note' ? 1200 : 120);
    if ('guests' in b) cur.guests = Math.max(0, parseInt(b.guests, 10) || 0);
    if (b.status && b.status !== cur.status) {
      if (!ALLOWED_STATUS.includes(b.status)) fail(400, 'Unknown status.');
      cur.status = b.status;
      cur.history = (cur.history || []).concat({ at: now(), by: user.name, status: b.status });
      await log(user, 'booking', 'Marked ' + cur.name + ' as ' + b.status.replace('_', ' '), { ref: cur.id });
    }
    await store.set('bookings', cur.id, cur);
    return { booking: cur };
  }
  if (req.method === 'DELETE') { await store.del('bookings', cur.id); await log(user, 'booking', 'Deleted the booking for ' + cur.name); return { ok: true }; }
};

/* customers */
routes.customers = async (req, user) => {
  need(user, 'customers');
  if (req.method === 'GET') return { customers: Object.values(await store.all('customers')) };
  const b = await body(req);
  if (req.method === 'POST') {
    const key = phoneKey(b.phone);
    if (key.length < 7) fail(400, 'Please enter a phone number with the country code.');
    if (await store.get('customers', key)) fail(400, 'A customer with that number already exists.');
    const c = { key, name: clean(b.name, 80), phone: clean(b.phone, 30), email: clean(b.email, 120).toLowerCase(), first_seen: now(), last_seen: now(), bookings: 0, guests: 0, tags: (b.tags || []).map(t => clean(t, 30)).filter(Boolean),
      consent: { email: !!b.consent_email, whatsapp: !!b.consent_whatsapp, at: now(), source: 'Added by ' + user.name }, notes: clean(b.notes, 1200) };
    await store.set('customers', key, c);
    return { customer: c };
  }
  const c = await store.get('customers', b.key);
  if (!c) fail(404, 'No such customer.');
  if (req.method === 'PATCH') {
    for (const k of ['name', 'email', 'notes']) if (k in b) c[k] = clean(b[k], k === 'notes' ? 1200 : 120);
    if (Array.isArray(b.tags)) c.tags = b.tags.map(t => clean(t, 30)).filter(Boolean);
    if (b.consent) {
      c.consent = Object.assign({}, c.consent, { email: !!b.consent.email, whatsapp: !!b.consent.whatsapp, at: now(), source: 'Changed by ' + user.name });
      if (b.consent.email && c.unsubscribed) delete c.unsubscribed.email;
    }
    await store.set('customers', c.key, c);
    return { customer: c };
  }
  if (req.method === 'DELETE') {
    // A person's request to be forgotten: remove them and their bookings.
    const all = await store.all('bookings');
    for (const bk of Object.values(all)) if (bk.customer === c.key) await store.del('bookings', bk.id);
    await store.del('customers', c.key);
    await log(user, 'customer', 'Deleted customer ' + (c.name || c.phone) + ' and their bookings');
    return { ok: true };
  }
};

routes.activity = async (req, user) => {
  need(user, 'dashboard');
  const a = Object.values(await store.all('activity')).sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, 60);
  return { activity: a };
};

/* website: pages, drafts, preview, settings, media */
routes.pages = async (req, user) => {
  need(user, 'dashboard');
  const drafts = await store.all('drafts').catch(() => ({}));
  return { pages: cms().lib.PAGES.map(p => ({ name: p.name, label: p.label, file: p.file, draft: !!drafts['page:' + p.name], draft_at: drafts['page:' + p.name] && drafts['page:' + p.name].at, draft_by: drafts['page:' + p.name] && drafts['page:' + p.name].by })) };
};
routes.page = async (req, user) => {
  need(user, 'website');
  const q = query(req);
  const p = pageInfo(q.name);
  const filePath = 'content/pages/' + p.name + '.json';
  if (req.method === 'GET') {
    const published = await readJsonFile(filePath, {});
    const draft = await store.get('drafts', 'page:' + p.name);
    return { page: { name: p.name, label: p.label, file: p.file }, published, draft: draft && draft.content, draft_at: draft && draft.at, draft_by: draft && draft.by, schema: schemaFor(p) };
  }
  const b = await body(req);
  if (b.action === 'draft') { await store.set('drafts', 'page:' + p.name, { at: now(), by: user.name, content: b.content }); return { ok: true, at: now() }; }
  if (b.action === 'discard') { await store.del('drafts', 'page:' + p.name); return { ok: true }; }
  if (b.action === 'publish') {
    await files.write(filePath, JSON.stringify(b.content, null, 2) + '\n', 'Update ' + p.label + ' page (' + user.name + ')', user);
    await store.del('drafts', 'page:' + p.name);
    await log(user, 'website', 'Published the ' + p.label + ' page');
    return { ok: true, live: files.USE_GITHUB ? 'soon' : 'now' };
  }
  fail(400, 'Unknown action.');
};
routes.render = async (req, user) => {
  need(user, 'website');
  const b = await body(req);
  const p = pageInfo(b.name);
  const { b: bld } = cms();
  const site = Object.assign({}, bld.DEFAULT_SITE, b.site || await readJsonFile('content/site.json', {}));
  const menus = (await readJsonFile('content/menus.json', null)) || bld.loadMenus();
  return send.raw(bld.renderPage(p, b.content || {}, site, menus, { edit: true }));
};
routes.settings = async (req, user) => {
  need(user, 'website');
  const q = query(req);
  const which = q.file === 'menus' ? 'menus' : 'site';
  const p = 'content/' + which + '.json';
  if (req.method === 'GET') return { data: await readJsonFile(p, which === 'site' ? cms().b.DEFAULT_SITE : {}) };
  const b = await body(req);
  await files.write(p, JSON.stringify(b.data, null, 2) + '\n', 'Update ' + (which === 'site' ? 'contact details and hours' : 'menus') + ' (' + user.name + ')', user);
  await log(user, 'website', which === 'site' ? 'Updated contact details and opening hours' : 'Updated the menus');
  return { ok: true, live: files.USE_GITHUB ? 'soon' : 'now' };
};
routes.media = async (req, user) => {
  need(user, 'website');
  const q = query(req);
  if (req.method === 'GET') {
    const dir = q.dir === 'menus' ? 'assets/menus' : q.dir === 'menu-pages' ? 'assets/img/menus' : 'assets/img';
    return { files: (await files.list(dir)).filter(f => /\.(jpe?g|png|webp|gif|svg|pdf)$/i.test(f.name)) };
  }
  const b = await body(req);
  if (req.method === 'POST') {
    const dir = b.dir === 'menus' ? 'assets/menus' : b.dir === 'menu-pages' ? 'assets/img/menus' : 'assets/img';
    const base = path.basename(String(b.name || 'picture')).toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'picture';
    const ext = (/\.([a-z0-9]+)$/i.exec(b.name || '') || [])[1] || 'jpg';
    const existing = new Set((await files.list(dir)).map(f => f.name));
    let name = base + '.' + ext.toLowerCase(), n = 2;
    while (existing.has(name)) name = base + '-' + (n++) + '.' + ext.toLowerCase();
    const buf = Buffer.from(String(b.data || '').replace(/^data:[^,]+,/, ''), 'base64');
    if (!buf.length) fail(400, 'That file is empty.');
    if (buf.length > 5.5e6) fail(413, 'That file is over 5 MB.');
    await files.write(dir + '/' + name, buf, 'Upload ' + name + ' (' + user.name + ')', user);
    await log(user, 'media', 'Uploaded ' + name);
    return { file: { name, path: '/' + dir + '/' + name, size: buf.length } };
  }
  if (req.method === 'DELETE') {
    const p = String(b.path || '').replace(/^\//, '');
    files.check(p);
    // Refuse if a page or setting still uses it.
    const { lib } = cms();
    const used = [];
    for (const pg of lib.PAGES) {
      const c = await files.read('content/pages/' + pg.name + '.json') || '';
      const t = require('fs').readFileSync(path.join(lib.ROOT, pg.file), 'utf8');
      if (c.includes(p) || t.includes(p)) used.push(pg.label);
    }
    if (((await files.read('content/menus.json')) || '').includes(p)) used.push('Menus');
    if (used.length) fail(400, 'Still used on: ' + used.join(', ') + '. Replace it there first.');
    await files.remove(p, 'Delete ' + p + ' (' + user.name + ')');
    await log(user, 'media', 'Deleted ' + path.basename(p));
    return { ok: true };
  }
};
// Files saved but not yet on the live site (it republishes in about a minute).
routes.raw = async (req, user) => {
  need(user, 'website');
  const p = String(query(req).path || '').replace(/^\//, '');
  files.check(p);
  const buf = await files.read(p, true);
  if (!buf) fail(404, 'Not found');
  const ext = path.extname(p).toLowerCase();
  return send.file(buf, { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' }[ext] || 'application/octet-stream');
};

/* sample data, on this computer only */
routes.sample = async (req, user) => {
  need(user, 'team');
  if (!store.LOCAL) fail(400, 'Sample data is only for the preview on your computer.');
  const b = await body(req);
  for (const n of ['bookings', 'customers', 'activity']) await store.clear(n);
  if (b.action === 'clear') return { ok: true };
  await require('./sample').fill(store);
  return { ok: true };
};

send.raw = html => ({ _raw: html });
send.file = (buf, type) => ({ _file: buf, _type: type });

async function handleAdmin(req, res) {
  try {
    const a = query(req).a;
    const fn = routes[a];
    if (!fn) return send(res, 404, { error: 'Unknown request.' });
    // Changes only from the admin page itself (no cross-site form posts).
    if (req.method !== 'GET') {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) return send(res, 403, { error: 'Blocked.' });
      if (!/json/.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'Send JSON.' });
    }
    const user = await currentUser(req).catch(() => null);
    const out = await fn(req, user);
    if (out && out._raw) return send(res, 200, out._raw);
    if (out && out._file) { res.statusCode = 200; res.setHeader('Content-Type', out._type); res.setHeader('Cache-Control', 'private, max-age=300'); return res.end(out._file); }
    const headers = {};
    if (out && out._cookie) { headers['Set-Cookie'] = out._cookie; delete out._cookie; }
    send(res, 200, out || { ok: true }, headers);
  } catch (e) {
    if (!e.status) console.error(e);
    send(res, e.status || 500, { error: e.status ? e.message : 'Something went wrong on our side. Please try again.' });
  }
}

/* ------------------------------------------------------------ public */
async function handleBook(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
    const b = await body(req);
    if (b.company) return send(res, 200, { ok: true }); // the hidden field: a bot filled it in
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if ((await store.hit('book:' + ip, 3600)) > 12) return send(res, 429, { error: 'Too many requests. Please call us.' });
    const booking = await createBooking(b, 'website', null);
    // Let the team know by email when sending is set up.
    const to = process.env.NOTIFY_EMAIL;
    if (to) {
      const esc = s => String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
      messages.sendEmail({ to, subject: 'Table request: ' + booking.name + (booking.date ? ', ' + booking.date : ''), replyTo: booking.email || undefined,
        html: '<p><b>' + esc(booking.name) + '</b> · ' + esc(booking.phone) + (booking.email ? ' · ' + esc(booking.email) : '') + '</p><p>' + esc(booking.date || 'No date') + ' ' + esc(booking.time) + ' · ' + booking.guests + ' guests</p><p>' + esc(booking.notes) + '</p><p><a href="' + messages.SITE + '/admin/#/bookings">Open bookings</a></p>' }).catch(() => {});
    }
    send(res, 200, { ok: true });
  } catch (e) {
    if (!e.status) console.error(e);
    send(res, e.status || 500, { error: e.message });
  }
}

module.exports = { handleAdmin, handleBook, ROLES };
