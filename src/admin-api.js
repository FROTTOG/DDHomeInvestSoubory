import { DEFAULT_CONTENT, DEFAULT_THEME, withComputedDefaults } from './default-content.js';

const SESSION_TTL_DAYS = 7;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

/**
 * Cloudflare Pages Functions – jádro administrace a API.
 *
 * Logika je sdílená s testy (tests/admin-api.test.js). Stručný přehled:
 *  - /api/login, /api/logout          – přihlášení (PBKDF2 hash v D1) a odhlášení
 *  - /api/content, /api/theme         – čtení/ukládání obsahu webu a vzhledu (D1)
 *  - /api/upload, /media/...          – nahrávání obrázků do R2 a jejich servírování
 *  - /api/contact, /api/contact-messages – kontaktní formulář (D1)
 *  - /_next/static/chunks/580.*.js    – dynamický chunk obsahu webu generovaný z D1
 */

export function isDynamicContentChunk(pathname) {
  return /^\/_next\/static\/chunks\/580\.[^/]+\.js$/.test(pathname);
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname.startsWith('/api/')) {
    return handleApi(request, env, url);
  }

  if (pathname.startsWith('/media/')) {
    return handleMedia(env, pathname);
  }

  if (isDynamicContentChunk(pathname)) {
    const content = await getContent(env);
    return new Response(buildContentChunk(content), {
      headers: {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': 'no-store, max-age=0',
      },
    });
  }

  return null;
}

async function handleApi(request, env, url) {
  const { pathname } = url;

  if (pathname === '/api/login' && request.method === 'POST') {
    return handleLogin(request, env);
  }

  if (pathname === '/api/logout' && request.method === 'POST') {
    return handleLogout(request, env);
  }

  if (pathname === '/api/content') {
    if (request.method === 'GET') {
      return jsonResponse(await getContent(env), 200, noStoreHeaders());
    }
    if (request.method === 'PUT') {
      const session = await requireAuth(request, env);
      if (!session.ok) return session.response;

      const body = await readJson(request);
      const content = withComputedDefaults(body);
      await saveJson(env.DB, 'app_content', content);
      return jsonResponse({ ok: true, updatedBy: session.username }, 200, noStoreHeaders());
    }
  }

  if (pathname === '/api/theme') {
    if (request.method === 'GET') {
      return jsonResponse(await getTheme(env), 200, noStoreHeaders());
    }
    if (request.method === 'PUT') {
      const session = await requireAuth(request, env);
      if (!session.ok) return session.response;

      const body = await readJson(request);
      const theme = {
        ...DEFAULT_THEME,
        ...body,
        colors: { ...DEFAULT_THEME.colors, ...(body.colors || {}) },
        fonts: { ...DEFAULT_THEME.fonts, ...(body.fonts || {}) },
      };
      await saveJson(env.DB, 'app_theme', theme);
      return jsonResponse({ ok: true, updatedBy: session.username }, 200, noStoreHeaders());
    }
  }

  if (pathname === '/api/upload' && request.method === 'POST') {
    const session = await requireAuth(request, env);
    if (!session.ok) return session.response;

    return handleUpload(request, env, session.username);
  }

  if (pathname === '/api/contact' && request.method === 'POST') {
    return handleContact(request, env, url);
  }

  if (pathname === '/api/contact-messages' && request.method === 'GET') {
    const session = await requireAuth(request, env);
    if (!session.ok) return session.response;

    const rows = await env.DB.prepare(
      'SELECT id, name, email, phone, message, source_url, created_at FROM contact_messages ORDER BY id DESC LIMIT 100',
    ).all();

    return jsonResponse(rows.results || [], 200, noStoreHeaders());
  }

  return jsonResponse({ error: 'Not Found' }, 404, noStoreHeaders());
}

async function handleMedia(env, pathname) {
  const key = pathname.replace(/^\/media\//, '');
  if (!key) return new Response('Not found', { status: 404 });

  const object = await env.MEDIA.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
}

async function handleLogin(request, env) {
  const body = await readJson(request);
  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();

  // Support password-only login for admin (single admin user scenario)
  // If username is not provided, use the first admin user
  if (!password) {
    return jsonResponse({ error: 'Vyplňte heslo.' }, 400, noStoreHeaders());
  }

  let user = null;
  
  if (username) {
    // Traditional login with username
    user = await env.DB.prepare(
      'SELECT username, password_hash, password_salt, iterations FROM admin_users WHERE username = ? LIMIT 1',
    )
      .bind(username)
      .first();
  } else {
    // Password-only login - get the first admin user
    const users = await env.DB.prepare(
      'SELECT username, password_hash, password_salt, iterations FROM admin_users LIMIT 1',
    ).all();
    
    if (users.results && users.results.length > 0) {
      user = users.results[0];
    }
  }

  if (!user) {
    return jsonResponse({ error: 'Neplatné přihlašovací údaje.' }, 401, noStoreHeaders());
  }

  const computedHash = await hashPassword(password, user.password_salt, user.iterations);
  if (computedHash !== user.password_hash) {
    return jsonResponse({ error: 'Neplatné přihlašovací údaje.' }, 401, noStoreHeaders());
  }

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    'INSERT OR REPLACE INTO admin_sessions (token_hash, username, expires_at) VALUES (?, ?, ?)',
  )
    .bind(tokenHash, user.username, expiresAt)
    .run();

  const headers = new Headers(noStoreHeaders());
  headers.append(
    'set-cookie',
    `dd_admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_DAYS * 24 * 60 * 60}`,
  );

  // Don't return username in response for password-only login
  const responseData = username ? { ok: true, token, username: user.username } : { ok: true, token };
  return jsonResponse(responseData, 200, headers);
}

async function handleLogout(request, env) {
  const token = getSessionToken(request);
  if (token) {
    const tokenHash = await sha256Hex(token);
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).run();
  }

  const headers = new Headers(noStoreHeaders());
  headers.append('set-cookie', 'dd_admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
  return jsonResponse({ ok: true }, 200, headers);
}

async function handleUpload(request, env, username) {
  const formData = await request.formData();
  const file = formData.get('file');
  const rawDirectory = String(formData.get('directory') || 'uploads');
  const directory = sanitizePathPart(rawDirectory || 'uploads');

  if (!(file instanceof File)) {
    return jsonResponse({ error: 'Soubor nebyl nahrán.' }, 400, noStoreHeaders());
  }

  if (!file.type.startsWith('image/')) {
    return jsonResponse({ error: 'Povoleny jsou jen obrázky.' }, 400, noStoreHeaders());
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return jsonResponse({ error: 'Soubor je větší než 10 MB.' }, 400, noStoreHeaders());
  }

  const cleanName = sanitizeFileName(file.name || `upload.${guessExtension(file.type)}`);
  const objectKey = `${directory}/${Date.now()}-${cleanName}`;

  await env.MEDIA.put(objectKey, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      uploadedBy: username,
    },
  });

  return jsonResponse(
    {
      ok: true,
      key: objectKey,
      path: `/media/${objectKey}`,
      size: file.size,
      type: file.type,
    },
    200,
    noStoreHeaders(),
  );
}

async function handleContact(request, env, url) {
  let payload = {};
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    payload = await readJson(request);
  } else {
    const formData = await request.formData();
    payload = Object.fromEntries(formData.entries());
  }

  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim();
  const phone = String(payload.phone || '').trim();
  const message = String(payload.message || '').trim();

  if (!name || !email || !message) {
    return jsonResponse({ error: 'Vyplňte prosím jméno, e-mail a zprávu.' }, 400, noStoreHeaders());
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Zadejte platný e-mail.' }, 400, noStoreHeaders());
  }

  await env.DB.prepare(
    'INSERT INTO contact_messages (name, email, phone, message, source_url) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(name, email, phone, message, url.pathname)
    .run();

  return jsonResponse({ ok: true, message: 'Děkujeme, zpráva byla odeslána.' }, 200, noStoreHeaders());
}

async function requireAuth(request, env) {
  const token = getSessionToken(request);
  if (!token) {
    return { ok: false, response: jsonResponse({ error: 'Unauthorized' }, 401, noStoreHeaders()) };
  }

  const tokenHash = await sha256Hex(token);
  const session = await env.DB.prepare(
    'SELECT username, expires_at FROM admin_sessions WHERE token_hash = ? LIMIT 1',
  )
    .bind(tokenHash)
    .first();

  if (!session) {
    return { ok: false, response: jsonResponse({ error: 'Unauthorized' }, 401, noStoreHeaders()) };
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).run();
    return { ok: false, response: jsonResponse({ error: 'Session expired' }, 401, noStoreHeaders()) };
  }

  return { ok: true, username: session.username };
}

async function getContent(env) {
  const row = await env.DB.prepare('SELECT data FROM app_content WHERE id = 1 LIMIT 1').first();
  if (!row?.data) return withComputedDefaults(DEFAULT_CONTENT);

  try {
    return withComputedDefaults(JSON.parse(row.data));
  } catch {
    return withComputedDefaults(DEFAULT_CONTENT);
  }
}

async function getTheme(env) {
  const row = await env.DB.prepare('SELECT data FROM app_theme WHERE id = 1 LIMIT 1').first();
  if (!row?.data) return DEFAULT_THEME;

  try {
    const parsed = JSON.parse(row.data);
    return {
      ...DEFAULT_THEME,
      ...parsed,
      colors: { ...DEFAULT_THEME.colors, ...(parsed.colors || {}) },
      fonts: { ...DEFAULT_THEME.fonts, ...(parsed.fonts || {}) },
    };
  } catch {
    return DEFAULT_THEME;
  }
}

async function saveJson(db, table, data) {
  return db
    .prepare(
      `INSERT INTO ${table} (id, data, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(JSON.stringify(data))
    .run();
}

function buildContentChunk(content) {
  const c = withComputedDefaults(content);

  const siteConfig = serializeJs(c.siteConfig);
  const heroContent = serializeJs(c.heroContent);
  const aboutContent = serializeJs(c.aboutContent);
  const teamMembers = serializeJs(c.teamMembers);
  const philosophyContent = serializeJs(c.philosophyContent);
  const galleryContent = serializeJs(c.galleryContent);
  const currentProjects = serializeJs(c.currentProjects);
  const soldProjects = serializeJs(c.soldProjects);
  const contactContent = serializeJs(c.contactContent);
  const footerContent = serializeJs(c.footerContent);

  return `"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[580],{4580:function(e,t,n){n.r(t),n.d(t,{aboutContent:function(){return aboutContent},contactContent:function(){return contactContent},currentProjects:function(){return currentProjects},footerContent:function(){return footerContent},galleryContent:function(){return galleryContent},heroContent:function(){return heroContent},philosophyContent:function(){return philosophyContent},siteConfig:function(){return siteConfig},soldProjects:function(){return soldProjects},teamMembers:function(){return teamMembers}});let siteConfig=${siteConfig},heroContent=${heroContent},aboutContent=${aboutContent},teamMembers=${teamMembers},philosophyContent=${philosophyContent},galleryContent=${galleryContent},currentProjects=${currentProjects},soldProjects=${soldProjects},contactContent=${contactContent},footerContent=${footerContent}}}]);`;
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }

  return new Response(JSON.stringify(data), { status, headers });
}

function noStoreHeaders() {
  return {
    'cache-control': 'no-store, max-age=0',
  };
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function getSessionToken(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|; )dd_admin_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function hashPassword(password, saltHex, iterations) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(saltHex),
      iterations,
    },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(derivedBits));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function serializeJs(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

function sanitizePathPart(value) {
  return value
    .split('/')
    .map((segment) => segment.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('/') || 'uploads';
}

function sanitizeFileName(name) {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || `upload.${guessExtension('image/jpeg')}`;
}

function guessExtension(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/svg+xml') return 'svg';
  return 'jpg';
}
