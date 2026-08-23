import { DEFAULT_CONTENT, DEFAULT_THEME, withComputedDefaults } from './default-content.js';

const SESSION_TTL_DAYS = 7;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const { pathname } = url;

      if (pathname === '/admin/login' || pathname === '/admin/login/' || pathname === '/admin/login/index.html') {
        return htmlResponse(buildLoginPageHtml(), {
          'cache-control': 'no-store, max-age=0',
        });
      }

      if (pathname.startsWith('/api/')) {
        return handleApi(request, env, url);
      }

      if (pathname.startsWith('/media/')) {
        return handleMedia(request, env, pathname);
      }

      if (/^\/_next\/static\/chunks\/580\.[^/]+\.js$/.test(pathname)) {
        const content = await getContent(env);
        return new Response(buildContentChunk(content), {
          headers: {
            'content-type': 'application/javascript; charset=utf-8',
            'cache-control': 'no-store, max-age=0',
          },
        });
      }

      return handleAssetRequest(request, env, url);
    } catch (error) {
      return jsonResponse(
        {
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500,
      );
    }
  },
};

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

async function handleAssetRequest(request, env, url) {
  let assetResponse = await env.ASSETS.fetch(request);

  if (assetResponse.status === 404 && !hasFileExtension(url.pathname)) {
    const fallbackUrl = new URL('/index.html', url.origin);
    assetResponse = await env.ASSETS.fetch(new Request(fallbackUrl.toString(), request));
  }

  const contentType = assetResponse.headers.get('content-type') || '';
  const headers = new Headers(assetResponse.headers);

  if (contentType.includes('text/html')) {
    const content = await getContent(env);
    let html = await assetResponse.text();
    html = enhanceHtml(html, url, content);
    headers.set('cache-control', 'no-store, max-age=0');
    return new Response(html, {
      status: assetResponse.status,
      headers,
    });
  }

  if (/^\/_next\/static\/chunks\/580\.[^/]+\.js$/.test(url.pathname)) {
    headers.set('cache-control', 'no-store, max-age=0');
  } else if (contentType.includes('javascript') || contentType.includes('css')) {
    headers.set('cache-control', 'public, max-age=300, must-revalidate');
  } else if (/(image|font)\//.test(contentType) || /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname)) {
    headers.set('cache-control', 'public, max-age=600, must-revalidate');
  }

  return new Response(assetResponse.body, {
    status: assetResponse.status,
    headers,
  });
}

async function handleMedia(request, env, pathname) {
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
  const password = String(body.password || '');

  if (!username || !password) {
    return jsonResponse({ error: 'Vyplňte uživatelské jméno i heslo.' }, 400, noStoreHeaders());
  }

  const user = await env.DB.prepare(
    'SELECT username, password_hash, password_salt, iterations FROM admin_users WHERE username = ? LIMIT 1',
  )
    .bind(username)
    .first();

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

  return jsonResponse({ ok: true, token, username: user.username }, 200, headers);
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

  return `"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[580],{4580:function(e,t,n){n.r(t),n.d(t,{aboutContent:function(){return aboutContent},contactContent:function(){return contactContent},currentProjects:function(){return currentProjects},footerContent:function(){return footerContent},galleryContent:function(){return galleryContent},heroContent:function(){return heroContent},philosophyContent:function(){return philosophyContent},siteConfig:function(){return siteConfig},soldProjects:function(){return soldProjects},teamMembers:function(){return teamMembers}});let siteConfig=${siteConfig},heroContent=${heroContent},aboutContent=${aboutContent},teamMembers=${teamMembers},philosophyContent=${philosophyContent},galleryContent=${galleryContent},currentProjects=${currentProjects},soldProjects=${soldProjects},contactContent=${contactContent},footerContent=${footerContent}}]);`;
}

function buildLoginPageHtml() {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Administrace | D&D HOMEINVEST</title>
  <style>
    :root {
      --navy: #0a1628;
      --navy-light: #152238;
      --brass: #c9a84c;
      --text: rgba(255,255,255,.92);
      --muted: rgba(255,255,255,.58);
      --border: rgba(255,255,255,.1);
      --danger: #f87171;
      --success: #34d399;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: radial-gradient(circle at top, rgba(201,168,76,.12), transparent 25%), linear-gradient(180deg, #09111f 0%, var(--navy) 100%);
      color: var(--text);
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .card {
      width: min(100%, 420px);
      background: rgba(14, 24, 43, .88);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 32px;
      box-shadow: 0 24px 80px rgba(0,0,0,.35);
      backdrop-filter: blur(12px);
    }
    .brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      margin-bottom: 24px;
      text-align: center;
    }
    .badge {
      width: 68px;
      height: 68px;
      border-radius: 18px;
      display: grid;
      place-items: center;
      color: var(--brass);
      background: rgba(201,168,76,.12);
      border: 1px solid rgba(201,168,76,.24);
      font-weight: 800;
      font-size: 24px;
      letter-spacing: .06em;
    }
    h1 { margin: 0; font-size: 28px; }
    p { margin: 0; color: var(--muted); }
    form { display: grid; gap: 16px; }
    label { display: grid; gap: 8px; font-size: 14px; color: rgba(255,255,255,.75); }
    input {
      width: 100%;
      border: 1px solid var(--border);
      background: rgba(8, 16, 32, .85);
      color: var(--text);
      border-radius: 14px;
      padding: 14px 16px;
      outline: none;
      font-size: 15px;
    }
    input:focus {
      border-color: rgba(201,168,76,.45);
      box-shadow: 0 0 0 4px rgba(201,168,76,.1);
    }
    button {
      border: 0;
      border-radius: 14px;
      padding: 14px 18px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: transform .15s ease, opacity .15s ease, background .15s ease;
    }
    button:active { transform: translateY(1px); }
    .primary {
      background: var(--brass);
      color: var(--navy);
    }
    .primary[disabled] { opacity: .6; cursor: wait; }
    .secondary {
      background: transparent;
      color: var(--muted);
      border: 1px solid var(--border);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .stack { display: grid; gap: 12px; }
    .message {
      display: none;
      border-radius: 14px;
      padding: 12px 14px;
      font-size: 14px;
      line-height: 1.5;
      border: 1px solid transparent;
    }
    .message.error {
      display: block;
      color: #fecaca;
      background: rgba(239, 68, 68, .1);
      border-color: rgba(239,68,68,.25);
    }
    .message.success {
      display: block;
      color: #d1fae5;
      background: rgba(16, 185, 129, .1);
      border-color: rgba(16,185,129,.25);
    }
    .hint { margin-top: 16px; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <div class="badge">DD</div>
      <div>
        <h1>Administrace</h1>
        <p>D&D HOMEINVEST s.r.o.</p>
      </div>
    </div>
    <div id="message" class="message" role="alert"></div>
    <form id="login-form">
      <label>
        Uživatelské jméno
        <input name="username" autocomplete="username" required placeholder="honza2555" />
      </label>
      <label>
        Heslo
        <input name="password" type="password" autocomplete="current-password" required placeholder="••••••••••••" />
      </label>
      <div class="stack">
        <button class="primary" id="submit" type="submit">Přihlásit se</button>
        <a class="secondary" href="/">← Zpět na web</a>
      </div>
    </form>
    <p class="hint">Přihlášení je ověřováno na serveru a administrace používá D1 + R2.</p>
  </div>
  <script>
    const form = document.getElementById('login-form');
    const submit = document.getElementById('submit');
    const message = document.getElementById('message');

    const showMessage = (text, type) => {
      message.className = 'message ' + type;
      message.textContent = text;
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      submit.textContent = 'Přihlašuji...';
      message.className = 'message';
      message.textContent = '';

      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok || !data.token) {
          throw new Error(data.error || 'Přihlášení se nepodařilo.');
        }

        localStorage.setItem('dd_admin_session', data.token);
        showMessage('Přihlášení proběhlo úspěšně, přesměrovávám…', 'success');
        window.location.href = '/admin';
      } catch (error) {
        showMessage(error.message || 'Přihlášení se nepodařilo.', 'error');
        submit.disabled = false;
        submit.textContent = 'Přihlásit se';
      }
    });
  </script>
</body>
</html>`;
}

function enhanceHtml(html, url, content) {
  const canonicalPath = url.pathname === '/index.html' ? '/' : url.pathname;
  const canonical = `${url.origin}${canonicalPath}`;
  const seoTags = [
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${url.origin}/logo.png" />`,
    `<meta name="twitter:image" content="${url.origin}/logo.png" />`,
  ].join('');

  let enhanced = html.replace('</head>', `${seoTags}</head>`);
  enhanced = enhanced.replace(/\+420 123 456 789/g, content.siteConfig.phone);

  if (url.pathname === '/' || url.pathname === '/index.html') {
    enhanced = enhanced.replace('</body>', `${buildContactScript()}</body>`);
  }

  return enhanced;
}

function buildContactScript() {
  return `<script>
  (() => {
    const init = () => {
      const form = document.querySelector('#kontakt form');
      if (!form || form.dataset.ddBound === '1') return;
      form.dataset.ddBound = '1';

      const submitButton = form.querySelector('button[type="submit"]');
      const status = document.createElement('div');
      status.style.marginTop = '12px';
      status.style.fontSize = '14px';
      status.style.lineHeight = '1.5';
      form.appendChild(status);

      const setStatus = (text, color) => {
        status.textContent = text || '';
        status.style.color = color || '#9a9590';
      };

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const payload = Object.fromEntries(new FormData(form).entries());
        submitButton.disabled = true;
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Odesílám…';
        setStatus('Odesílám zprávu…', '#c9a84c');

        try {
          const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Zprávu se nepodařilo odeslat.');
          form.reset();
          setStatus(data.message || 'Děkujeme, zpráva byla odeslána.', '#10b981');
        } catch (error) {
          setStatus(error.message || 'Zprávu se nepodařilo odeslat.', '#ef4444');
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      }, true);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  })();
  </script>`;
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }

  return new Response(JSON.stringify(data), { status, headers });
}

function htmlResponse(html, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(html, { headers });
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

function hasFileExtension(pathname) {
  return /\.[a-z0-9]+$/i.test(pathname);
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
