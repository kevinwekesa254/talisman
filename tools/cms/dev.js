#!/usr/bin/env node
/* Local preview with the admin.

     npm run dev
     → site:  http://localhost:8788
     → admin: http://localhost:8788/admin/

   On this computer the admin saves pages and pictures straight into this
   folder, and keeps bookings, customers and team accounts in .data/.
   Nothing goes live until it is committed and pushed. */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { build } = require('./build');
const { ROOT } = require('./lib');
const api = require('../../server/api');

const PORT = Number(process.env.PORT || 8788);
const DIST = path.join(ROOT, 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon', '.gif': 'image/gif' };

function safeBuild() { try { build(); } catch (e) { console.error('Build failed:', e.message); } }
safeBuild();

http.createServer((req, res) => {
  const p0 = req.url.split('?')[0];
  if (p0 === '/api/admin') return api.handleAdmin(req, res);
  if (p0 === '/api/book') return api.handleBook(req, res);
  let p = decodeURIComponent(p0);
  if (p.endsWith('/')) p += 'index.html';
  let file = path.join(DIST, p);
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': TYPES['.html'] }); return res.end(fs.readFileSync(path.join(DIST, '404.html'))); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log('\n  Site:  http://localhost:' + PORT + '\n  Admin: http://localhost:' + PORT + '/admin/\n');
});

// Rebuild when content, templates or assets change.
let timer = null;
fs.watch(ROOT, { recursive: true }, (ev, name) => {
  if (!name || /^(dist|node_modules|\.git|\.data|server|api|Talisman Website Images)(\/|$)/.test(name) || /\.DS_Store$/.test(name)) return;
  clearTimeout(timer);
  timer = setTimeout(() => { console.log('Changed: ' + name); safeBuild(); }, 250);
});
