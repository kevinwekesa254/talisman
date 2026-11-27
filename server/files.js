/* Reading and saving the site's files (content/*.json, pictures, menu PDFs).

   On this computer they are written straight into the project folder and the
   preview rebuilds. On the live site each save is a commit to the GitHub
   repository (GITHUB_TOKEN), and Vercel republishes the site in about a
   minute. */

const fs = require('fs');
const path = require('path');
const { ROOT, LOCAL } = require('./store');

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPO || 'kevinwekesa254/talisman';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const USE_GITHUB = !!TOKEN && !(LOCAL && !process.env.FORCE_GITHUB);
const READY = USE_GITHUB || LOCAL;

// Only these parts of the project can be changed from the admin.
const ALLOWED = [/^content\/pages\/[a-z0-9-]+\.json$/, /^content\/(site|menus)\.json$/,
  /^assets\/img\/[a-z0-9][a-z0-9._ -]*\.(jpe?g|png|webp|gif|svg)$/i, /^assets\/img\/menus\/[a-z0-9][a-z0-9._ -]*\.(jpe?g|png|webp)$/i,
  /^assets\/menus\/[a-z0-9][a-z0-9._-]*\.pdf$/i];
function check(p) {
  const clean = String(p || '').replace(/^\/+/, '');
  if (clean.includes('..') || !ALLOWED.some(r => r.test(clean))) { const e = new Error('That file cannot be changed here.'); e.status = 400; throw e; }
  return clean;
}

async function gh(method, url, body) {
  const r = await fetch('https://api.github.com/repos/' + REPO + url, {
    method, headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'talisman-admin', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (r.status === 404) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error('Could not save to the site files (' + (j.message || r.status) + ').'); e.status = 502; throw e; }
  return j;
}
const enc = p => p.split('/').map(encodeURIComponent).join('/');

async function read(p, asBuffer) {
  p = String(p).replace(/^\/+/, '');
  if (USE_GITHUB) {
    const j = await gh('GET', '/contents/' + enc(p) + '?ref=' + BRANCH);
    if (!j) return null;
    let buf;
    if (j.content) buf = Buffer.from(j.content, 'base64');
    else { // files over 1 MB come without content
      const b = await gh('GET', '/git/blobs/' + j.sha);
      buf = Buffer.from(b.content, 'base64');
    }
    return asBuffer ? buf : buf.toString('utf8');
  }
  try { const buf = fs.readFileSync(path.join(ROOT, p)); return asBuffer ? buf : buf.toString('utf8'); } catch (e) { return null; }
}

async function write(p, data, message, who) {
  p = check(p);
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
  if (USE_GITHUB) {
    const cur = await gh('GET', '/contents/' + enc(p) + '?ref=' + BRANCH);
    const body = { message: message || ('Update ' + p), content: buf.toString('base64'), branch: BRANCH };
    if (cur && cur.sha) body.sha = cur.sha;
    if (who && who.email) body.committer = body.author = { name: who.name || who.email, email: who.email };
    await gh('PUT', '/contents/' + enc(p), body);
    return;
  }
  if (!LOCAL) { const e = new Error('Saving is not connected yet.'); e.status = 503; throw e; }
  const full = path.join(ROOT, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buf);
}

async function remove(p, message) {
  p = check(p);
  if (USE_GITHUB) {
    const cur = await gh('GET', '/contents/' + enc(p) + '?ref=' + BRANCH);
    if (cur) await gh('DELETE', '/contents/' + enc(p), { message: message || ('Delete ' + p), sha: cur.sha, branch: BRANCH });
    return;
  }
  fs.rmSync(path.join(ROOT, p), { force: true });
}

async function list(dir) {
  dir = dir.replace(/^\/+|\/+$/g, '');
  if (USE_GITHUB) {
    const j = await gh('GET', '/contents/' + enc(dir) + '?ref=' + BRANCH);
    return (j || []).filter(f => f.type === 'file').map(f => ({ name: f.name, path: f.path, size: f.size }));
  }
  try {
    return fs.readdirSync(path.join(ROOT, dir)).filter(n => !n.startsWith('.'))
      .map(n => ({ n, st: fs.statSync(path.join(ROOT, dir, n)) })).filter(x => x.st.isFile())
      .map(x => ({ name: x.n, path: dir + '/' + x.n, size: x.st.size, modified: x.st.mtimeMs }));
  } catch (e) { return []; }
}

module.exports = { read, write, remove, list, check, USE_GITHUB, READY, REPO };
