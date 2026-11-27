/* Where the admin keeps bookings, customers, users and drafts.

   Live site: a Redis database added to the Vercel project (Storage tab), which
   sets KV_REST_API_URL and KV_REST_API_TOKEN. On this computer, without
   those, everything is kept in .data/ (git ignores it).

   Each collection is a hash: id -> JSON record. */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, '.data');
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const REMOTE = !!(URL_ && TOKEN);
const LOCAL = !process.env.VERCEL;
const READY = REMOTE || LOCAL;
const PREFIX = 'talisman:';

async function cmd(args) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('Database error: ' + (j.error || r.status));
  return j.result;
}
function notReady() { const e = new Error('The database is not connected yet.'); e.status = 503; throw e; }

/* ---- local files ---- */
function file(name) { return path.join(DATA, name.replace(/[^a-z0-9_-]/gi, '') + '.json'); }
function readLocal(name) { try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch (e) { return {}; } }
function writeLocal(name, obj) { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(file(name), JSON.stringify(obj, null, 1)); }

async function all(name) {
  if (REMOTE) {
    const flat = await cmd(['HGETALL', PREFIX + name]) || [];
    const out = {};
    for (let i = 0; i < flat.length; i += 2) { try { out[flat[i]] = JSON.parse(flat[i + 1]); } catch (e) {} }
    return out;
  }
  if (!LOCAL) notReady();
  return readLocal(name);
}
async function get(name, id) {
  if (REMOTE) { const v = await cmd(['HGET', PREFIX + name, id]); return v ? JSON.parse(v) : null; }
  if (!LOCAL) notReady();
  return readLocal(name)[id] || null;
}
async function set(name, id, value) {
  if (REMOTE) return cmd(['HSET', PREFIX + name, id, JSON.stringify(value)]);
  if (!LOCAL) notReady();
  const o = readLocal(name); o[id] = value; writeLocal(name, o);
}
async function del(name, id) {
  if (REMOTE) return cmd(['HDEL', PREFIX + name, id]);
  if (!LOCAL) notReady();
  const o = readLocal(name); delete o[id]; writeLocal(name, o);
}
async function clear(name) {
  if (REMOTE) return cmd(['DEL', PREFIX + name]);
  writeLocal(name, {});
}
// Counter that resets after `ttl` seconds (rate limits).
async function hit(key, ttl) {
  if (!REMOTE) return 1;
  const n = await cmd(['INCR', PREFIX + 'rl:' + key]);
  if (n === 1) await cmd(['EXPIRE', PREFIX + 'rl:' + key, String(ttl)]);
  return n;
}

// A secret for signing sign-in cookies.
let localSecret = null;
function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (!LOCAL) return null;
  if (localSecret) return localSecret;
  const p = path.join(DATA, 'secret');
  try { localSecret = fs.readFileSync(p, 'utf8'); } catch (e) {
    localSecret = require('crypto').randomBytes(32).toString('hex');
    fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(p, localSecret);
  }
  return localSecret;
}

function id(prefix) { return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

module.exports = { all, get, set, del, clear, hit, secret, id, REMOTE, LOCAL, READY, ROOT, DATA };
