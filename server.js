/*
  VYRO Athletics server
  ---------------------
  Serves the site and a small JSON API for accounts, wishlist, addresses,
  orders and settings, stored in SQLite (Node's built-in node:sqlite, no npm
  packages needed).

    node server.js                      # http://localhost:3000
    PORT=8080 DB_PATH=./data/vyro.db node server.js

  Password reset emails: there is no email provider wired up yet. Reset links
  are printed to the server log, and outside production (NODE_ENV !==
  'production') the API also returns the link so it can be tested. Hook your
  provider into sendResetEmail() below.
*/
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'vyro.db');
const PROD = process.env.NODE_ENV === 'production';
const SESSION_DAYS = 30;
const RESET_MINUTES = 60;

/* ------------------------------------------------------------------ *
 * Catalogue: prices are read from js/shop.js so orders can't be priced
 * by the browser
 * ------------------------------------------------------------------ */
const CATALOGUE = (function loadCatalogue() {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'shop.js'), 'utf8');
  const out = {};
  const re = /slug: '([a-z0-9-]+)',[\s\S]*?name: '([^']+)',[\s\S]*?price: (\d+(?:\.\d+)?),[\s\S]*?sizes: (TOPS|BOTTOMS)/g;
  let m;
  while ((m = re.exec(src))) {
    out[m[1]] = { name: m[2], price: Number(m[3]), sizes: m[4] === 'TOPS' ? ['XS', 'S', 'M', 'L', 'XL', 'XXL'] : ['S', 'M', 'L', 'XL', 'XXL'] };
  }
  return out;
})();
const COLORS = ['black', 'navy', 'gray'];
const FREE_SHIPPING = 80;
const SHIPPING_FEE = 5.95;

/* ------------------------------------------------------------------ *
 * Database
 * ------------------------------------------------------------------ */
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    pass_hash TEXT NOT NULL,
    marketing INTEGER NOT NULL DEFAULT 0,
    units TEXT NOT NULL DEFAULT 'metric',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS wishlist (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, slug)
  );
  CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, line1 TEXT NOT NULL, line2 TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL, postcode TEXT NOT NULL, country TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    is_default INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    number TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    items TEXT NOT NULL,
    address TEXT NOT NULL,
    subtotal REAL NOT NULL, shipping REAL NOT NULL, total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Processing',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const token = () => crypto.randomBytes(32).toString('base64url');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return 'scrypt$' + salt.toString('hex') + '$' + key.toString('hex');
}
function checkPassword(pw, stored) {
  const [, saltHex, keyHex] = String(stored).split('$');
  if (!saltHex || !keyHex) return false;
  const key = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const want = Buffer.from(keyHex, 'hex');
  return want.length === key.length && crypto.timingSafeEqual(want, key);
}

class HttpError extends Error {
  constructor(status, message, field) { super(message); this.status = status; this.field = field; }
}
const bad = (msg, field) => new HttpError(400, msg, field);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function str(v, max, label, field, required = true) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw bad('Enter your ' + label + '.', field);
  if (s.length > max) throw bad(label[0].toUpperCase() + label.slice(1) + ' is too long.', field);
  return s;
}
function email(v) {
  const e = str(v, 254, 'email address', 'email').toLowerCase();
  if (!EMAIL_RE.test(e)) throw bad('Enter a valid email address, like name@example.com.', 'email');
  return e;
}
function password(v, field = 'password') {
  if (typeof v !== 'string' || v.length < 8) throw bad('Use at least 8 characters for your password.', field);
  if (v.length > 200) throw bad('That password is too long.', field);
  return v;
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, marketing: !!u.marketing, units: u.units, createdAt: u.created_at };
}

// Very small in-memory rate limit for login / reset attempts
const attempts = new Map();
function limit(key, max, windowMs) {
  const now = Date.now();
  const a = (attempts.get(key) || []).filter((t) => now - t < windowMs);
  if (a.length >= max) throw new HttpError(429, 'Too many attempts. Wait a few minutes and try again.');
  a.push(now);
  attempts.set(key, a);
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
function sessionCookie(value, maxAgeSec) {
  return `vyro_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}` + (PROD ? '; Secure' : '');
}
function startSession(res, userId) {
  const t = token();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(t), userId, Date.now() + SESSION_DAYS * 864e5);
  res.setHeader('Set-Cookie', sessionCookie(t, SESSION_DAYS * 86400));
}
function currentUser(req) {
  const t = parseCookies(req).vyro_session;
  if (!t) return null;
  const row = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').get(sha256(t), Date.now());
  return row || null;
}
function requireUser(req) {
  const u = currentUser(req);
  if (!u) throw new HttpError(401, 'Log in to continue.');
  return u;
}

function sendResetEmail(to, link) {
  // Hook your email provider here (Postmark, SendGrid, Resend, SES...).
  console.log(`[password reset] ${to}: ${link}`);
}

function orderNumber() {
  return 'VY-' + Date.now().toString(36).toUpperCase().slice(-5) + crypto.randomBytes(2).toString('hex').toUpperCase();
}

function addressFrom(b) {
  return {
    name: str(b.name, 120, 'full name', 'name'),
    line1: str(b.line1, 200, 'address', 'line1'),
    line2: str(b.line2, 200, 'address line 2', 'line2', false),
    city: str(b.city, 120, 'town or city', 'city'),
    postcode: str(b.postcode, 20, 'postcode', 'postcode'),
    country: str(b.country, 80, 'country', 'country'),
    phone: str(b.phone, 40, 'phone number', 'phone', false)
  };
}
const addressOut = (a) => ({ id: a.id, name: a.name, line1: a.line1, line2: a.line2, city: a.city, postcode: a.postcode, country: a.country, phone: a.phone, isDefault: !!a.is_default });

/* ------------------------------------------------------------------ *
 * API routes
 * ------------------------------------------------------------------ */
const routes = {
  'GET /api/health': () => ({ ok: true }),

  'GET /api/auth/me': (req) => {
    const u = currentUser(req);
    return { user: u ? publicUser(u) : null };
  },

  'POST /api/auth/register': (req, res, body) => {
    const name = str(body.name, 120, 'name', 'name');
    const e = email(body.email);
    const pw = password(body.password);
    limit('reg:' + req.socket.remoteAddress, 10, 15 * 60e3);
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(e)) throw bad('An account with this email already exists. Log in instead.', 'email');
    const r = db.prepare('INSERT INTO users (email, name, pass_hash, marketing) VALUES (?, ?, ?, ?)').run(e, name, hashPassword(pw), body.marketing ? 1 : 0);
    startSession(res, Number(r.lastInsertRowid));
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid)) };
  },

  'POST /api/auth/login': (req, res, body) => {
    const e = email(body.email);
    limit('login:' + e, 8, 15 * 60e3);
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(e);
    if (!u || !checkPassword(String(body.password || ''), u.pass_hash)) throw new HttpError(401, 'That email and password don\'t match. Try again or reset your password.');
    startSession(res, u.id);
    return { user: publicUser(u) };
  },

  'POST /api/auth/logout': (req, res) => {
    const t = parseCookies(req).vyro_session;
    if (t) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(t));
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    return { ok: true };
  },

  'POST /api/auth/forgot': (req, res, body) => {
    const e = email(body.email);
    limit('forgot:' + e, 5, 15 * 60e3);
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(e);
    const out = { ok: true };
    if (u) {
      const t = token();
      db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(t), u.id, Date.now() + RESET_MINUTES * 60e3);
      const origin = (req.headers['x-forwarded-proto'] || 'http') + '://' + req.headers.host;
      const link = origin + '/account.html?reset=' + t;
      sendResetEmail(e, link);
      if (!PROD) out.devResetLink = link;
    }
    return out; // same answer whether or not the account exists
  },

  'POST /api/auth/reset': (req, res, body) => {
    const pw = password(body.password);
    const row = db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').get(sha256(String(body.token || '')));
    if (!row || row.used || row.expires_at < Date.now()) throw bad('This reset link has expired or was already used. Request a new one.');
    db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashPassword(pw), row.user_id);
    db.prepare('UPDATE password_resets SET used = 1 WHERE token_hash = ?').run(row.token_hash);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
    startSession(res, row.user_id);
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id)) };
  },

  'PUT /api/account/profile': (req, res, body) => {
    const u = requireUser(req);
    const name = str(body.name, 120, 'name', 'name');
    const e = email(body.email);
    const clash = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(e, u.id);
    if (clash) throw bad('Another account already uses this email.', 'email');
    db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, e, u.id);
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)) };
  },

  'PUT /api/account/settings': (req, res, body) => {
    const u = requireUser(req);
    const units = body.units === 'imperial' ? 'imperial' : 'metric';
    db.prepare('UPDATE users SET marketing = ?, units = ? WHERE id = ?').run(body.marketing ? 1 : 0, units, u.id);
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)) };
  },

  'PUT /api/account/password': (req, res, body) => {
    const u = requireUser(req);
    if (!checkPassword(String(body.current || ''), u.pass_hash)) throw bad('Your current password isn\'t right.', 'current');
    db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashPassword(password(body.password)), u.id);
    return { ok: true };
  },

  'DELETE /api/account': (req, res, body) => {
    const u = requireUser(req);
    if (!checkPassword(String(body.password || ''), u.pass_hash)) throw bad('Your password isn\'t right.', 'password');
    db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    return { ok: true };
  },

  'GET /api/wishlist': (req) => {
    const u = requireUser(req);
    return { items: db.prepare('SELECT slug, color, created_at AS createdAt FROM wishlist WHERE user_id = ? ORDER BY created_at DESC').all(u.id) };
  },
  'POST /api/wishlist': (req, res, body) => {
    const u = requireUser(req);
    if (!CATALOGUE[body.slug]) throw bad('Unknown product.');
    const color = COLORS.includes(body.color) ? body.color : 'black';
    db.prepare('INSERT INTO wishlist (user_id, slug, color) VALUES (?, ?, ?) ON CONFLICT(user_id, slug) DO UPDATE SET color = excluded.color').run(u.id, body.slug, color);
    return routes['GET /api/wishlist'](req);
  },
  'DELETE /api/wishlist': (req, res, body) => {
    const u = requireUser(req);
    db.prepare('DELETE FROM wishlist WHERE user_id = ? AND slug = ?').run(u.id, String(body.slug || ''));
    return routes['GET /api/wishlist'](req);
  },

  'GET /api/addresses': (req) => {
    const u = requireUser(req);
    return { items: db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id').all(u.id).map(addressOut) };
  },
  'POST /api/addresses': (req, res, body) => {
    const u = requireUser(req);
    const a = addressFrom(body);
    const count = db.prepare('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?').get(u.id).n;
    if (count >= 10) throw bad('You can save up to 10 addresses.');
    const makeDefault = body.isDefault || count === 0;
    if (makeDefault) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(u.id);
    db.prepare('INSERT INTO addresses (user_id, name, line1, line2, city, postcode, country, phone, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(u.id, a.name, a.line1, a.line2, a.city, a.postcode, a.country, a.phone, makeDefault ? 1 : 0);
    return routes['GET /api/addresses'](req);
  },
  'PUT /api/addresses': (req, res, body) => {
    const u = requireUser(req);
    const id = Number(body.id);
    if (!db.prepare('SELECT 1 FROM addresses WHERE id = ? AND user_id = ?').get(id, u.id)) throw new HttpError(404, 'Address not found.');
    const a = addressFrom(body);
    if (body.isDefault) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(u.id);
    db.prepare('UPDATE addresses SET name = ?, line1 = ?, line2 = ?, city = ?, postcode = ?, country = ?, phone = ?, is_default = CASE WHEN ? THEN 1 ELSE is_default END WHERE id = ? AND user_id = ?')
      .run(a.name, a.line1, a.line2, a.city, a.postcode, a.country, a.phone, body.isDefault ? 1 : 0, id, u.id);
    return routes['GET /api/addresses'](req);
  },
  'DELETE /api/addresses': (req, res, body) => {
    const u = requireUser(req);
    const row = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(Number(body.id), u.id);
    if (row) {
      db.prepare('DELETE FROM addresses WHERE id = ?').run(row.id);
      if (row.is_default) db.prepare('UPDATE addresses SET is_default = 1 WHERE id = (SELECT id FROM addresses WHERE user_id = ? ORDER BY id LIMIT 1)').run(u.id);
    }
    return routes['GET /api/addresses'](req);
  },

  'GET /api/orders': (req) => {
    const u = requireUser(req);
    return {
      items: db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(u.id).map((o) => ({
        number: o.number, status: o.status, createdAt: o.created_at, items: JSON.parse(o.items), address: JSON.parse(o.address),
        subtotal: o.subtotal, shipping: o.shipping, total: o.total
      }))
    };
  },

  // Test checkout: records the order, no payment is taken
  'POST /api/orders': (req, res, body) => {
    const u = currentUser(req);
    const e = u ? u.email : email(body.email);
    const address = addressFrom(body.address || {});
    if (!Array.isArray(body.items) || !body.items.length) throw bad('Your bag is empty.');
    if (body.items.length > 50) throw bad('Too many items.');
    const items = body.items.map((i) => {
      const p = CATALOGUE[i.slug];
      if (!p || !COLORS.includes(i.color) || !p.sizes.includes(i.size)) throw bad('One of the items in your bag is no longer available.');
      const qty = Math.max(1, Math.min(10, Math.floor(Number(i.qty) || 1)));
      return { slug: i.slug, name: p.name, color: i.color, size: i.size, qty, unit: p.price, line: p.price * qty };
    });
    const subtotal = items.reduce((n, i) => n + i.line, 0);
    const shipping = subtotal >= FREE_SHIPPING ? 0 : SHIPPING_FEE;
    const number = orderNumber();
    db.prepare('INSERT INTO orders (user_id, number, email, items, address, subtotal, shipping, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(u ? u.id : null, number, e, JSON.stringify(items), JSON.stringify(address), subtotal, shipping, subtotal + shipping);
    return { order: { number, email: e, items, address, subtotal, shipping, total: subtotal + shipping } };
  }
};

/* ------------------------------------------------------------------ *
 * Static files
 * ------------------------------------------------------------------ */
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};
// Clean URLs for the main pages
const ALIASES = { '/': '/index.html', '/shop': '/shop.html', '/cart': '/cart.html', '/account': '/account.html', '/product': '/product.html' };
const PUBLIC = /^\/(index|product|shop|cart|account)\.html$|^\/(css|js|assets)\//;

function serveStatic(req, res, pathname) {
  pathname = ALIASES[pathname] || pathname;
  if (!PUBLIC.test(pathname)) return notFound(res);
  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT + path.sep)) return notFound(res);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(res);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': /\.(jpg|png|webp|woff2)$/.test(file) ? 'public, max-age=604800' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 100e3) { reject(new HttpError(413, 'Request too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(bad('Invalid JSON.')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (!pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return notFound(res);
    return serveStatic(req, res, pathname);
  }
  const handler = routes[req.method + ' ' + pathname];
  if (!handler) return sendJSON(res, 404, { error: 'Not found.' });
  try {
    let body = {};
    if (req.method !== 'GET') {
      // CSRF guard: state-changing calls must be JSON from our own pages
      if (!String(req.headers['content-type'] || '').startsWith('application/json') || req.headers['x-vyro'] !== '1') {
        throw new HttpError(403, 'Forbidden.');
      }
      body = await readBody(req);
    }
    sendJSON(res, 200, await handler(req, res, body));
  } catch (e) {
    if (e instanceof HttpError) return sendJSON(res, e.status, { error: e.message, field: e.field });
    console.error(e);
    sendJSON(res, 500, { error: 'Something went wrong on our side. Try again.' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`VYRO running at http://localhost:${PORT} (database: ${path.relative(ROOT, DB_PATH)})`));
}
module.exports = { server, db };
