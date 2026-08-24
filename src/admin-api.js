import { DEFAULT_CONTENT, DEFAULT_THEME, withComputedDefaults } from './default-content.js';

const SESSION_TTL_DAYS = 7;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

/**
 * Počet iterací PBKDF2 pro hash hesla.
 *
 * DŮLEŽITÉ: Cloudflare Workers má na free plánu limit 10 ms CPU na požadavek.
 * PBKDF2-SHA256 s 210 000 iteracemi trvá ~40 ms CPU → přihlášení by spadlo
 * na "Worker exceeded CPU time limit". 25 000 iterací je ~5 ms CPU a do
 * limitu se vejde. Na placeném plánu lze hodnotu zvýšit proměnnou
 * ADMIN_PBKDF2_ITERATIONS (a znovu založit hash přes migraci).
 */
export const DEFAULT_PBKDF2_ITERATIONS = 25000;
const MIN_PBKDF2_ITERATIONS = 1000;
const MAX_PBKDF2_ITERATIONS = 600000;

/** Jednoduchá ochrana proti hádání hesla (per isolate, tedy per kolokačnímu bodu). */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map();

/** Chyba, kterou chceme vrátit klientovi s konkrétním stavovým kódem a textem. */
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Cloudflare Pages Functions – jádro administrace a API.
 *
 * Logika je sdílená s testy (tests/admin-api.test.js). Stručný přehled:
 *  - /api/login, /api/logout          – přihlášení (PBKDF2 hash v D1) a odhlášení
 *  - /api/content, /api/theme         – čtení/ukládání obsahu webu a vzhledu (D1)
 *  - /api/upload, /media/...          – nahrávání obrázků do R2 a jejich servírování
 *  - /api/contact, /api/contact-messages – kontaktní formulář (D1 + přeposlání na Formspree)
 *  - /api/health                      – diagnostika bindingů a tabulek (bez přihlášení)
 *
 * Obsah webu si Next.js aplikace načítá za běhu z GET /api/content,
 * takže se změny z administrace projeví okamžitě bez rebuildů.
 */

export async function handleRequest(request, env, ctx = {}) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname.startsWith('/api/')) {
    return handleApi(request, env, url, ctx);
  }

  if (pathname.startsWith('/media/')) {
    try {
      return await handleMedia(env, pathname);
    } catch (error) {
      return mediaError(error);
    }
  }

  return null;
}

async function handleApi(request, env, url, ctx) {
  const { pathname } = url;

  try {
    if (pathname === '/api/health' && request.method === 'GET') {
      return handleHealth(env);
    }

    if (pathname === '/api/login' && request.method === 'POST') {
      return await handleLogin(request, env);
    }

    if (pathname === '/api/logout' && request.method === 'POST') {
      return await handleLogout(request, env);
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

      return await handleUpload(request, env, session.username);
    }

    if (pathname === '/api/contact' && request.method === 'POST') {
      return await handleContact(request, env, url, ctx);
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
  } catch (error) {
    return apiErrorResponse(error, pathname);
  }
}

/**
 * Převede vyhozenou chybu na srozumitelnou odpověď.
 * Typické produkční příčiny 500 (chybějící binding / nenahrané migrace)
 * vracíme jako 503 s konkrétním návodem místo obecného "Internal Server Error".
 */
function apiErrorResponse(error, pathname) {
  if (error instanceof ApiError) {
    return jsonResponse(
      { error: error.message, message: error.details || error.message, path: pathname },
      error.status,
      noStoreHeaders(),
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  const mapped = mapDatabaseError(message);
  if (mapped) {
    console.error(`[admin-api] ${pathname}: ${message}`);
    return jsonResponse(
      { error: mapped.message, message, hint: mapped.hint, path: pathname },
      mapped.status,
      noStoreHeaders(),
    );
  }

  console.error(`[admin-api] ${pathname}: unexpected error`, error);
  return jsonResponse(
    { error: 'Internal Server Error', message, path: pathname },
    500,
    noStoreHeaders(),
  );
}

function mapDatabaseError(message) {
  const text = String(message || '');

  if (/no such table|no such column|D1_ERROR/i.test(text)) {
    return {
      status: 503,
      message: 'Databáze není připravená (chybí tabulky).',
      hint: 'Spusťte migrace: npx wrangler d1 execute ddhomeinvest --remote --file=migrations/0001_initial.sql a --file=migrations/0002_login_cpu_safe.sql',
    };
  }

  if (/binding|not defined|undefined is not an object|Cannot read propert/i.test(text)) {
    return {
      status: 503,
      message: 'Chybí binding D1/R2 (DB, MEDIA).',
      hint: 'Zkontrolujte v Cloudflare Pages → Settings → Functions → D1/R2 bindingy, nebo nasaďte s wrangler.toml (V2 build systém). Diagnostika: /api/health',
    };
  }

  return null;
}

function requireDb(env) {
  if (!env || !env.DB) {
    throw new ApiError(
      503,
      'Chybí D1 binding DB – administrace se nemůže přihlásit.',
      'V Cloudflare Pages → Settings → Functions přiřaďte D1 databázi ddhomeinvest jako binding DB (a R2 bucket jako MEDIA). Diagnostika: /api/health',
    );
  }
  return env.DB;
}

function requireMedia(env) {
  if (!env || !env.MEDIA) {
    throw new ApiError(
      503,
      'Chybí R2 binding MEDIA – obrázky nelze nahrávat.',
      'V Cloudflare Pages → Settings → Functions přiřaďte R2 bucket ddhomeinvestbucket jako binding MEDIA.',
    );
  }
  return env.MEDIA;
}

function mediaError(error) {
  if (error instanceof ApiError) {
    return jsonResponse({ error: error.message, message: error.details }, error.status, noStoreHeaders());
  }
  return new Response('Media unavailable', { status: 503 });
}

/**
 * Diagnostika nasazení – bez přihlášení, bez citlivých dat.
 * Přes /api/health je na první pohled vidět, jestli je D1/R2 v pořádku.
 */
async function handleHealth(env) {
  const report = {
    ok: false,
    db: 'ok',
    media: env && env.MEDIA ? 'ok' : 'chybí binding MEDIA',
    tables: [],
    adminUsers: 0,
    pbkdf2Iterations: resolveIterations(env),
    formspreeId: null,
  };

  try {
    const db = requireDb(env);
    const rows = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('app_content','app_theme','admin_users','admin_sessions','contact_messages') ORDER BY name",
      )
      .all();
    report.tables = (rows.results || []).map((row) => row.name);

    const required = ['admin_users', 'admin_sessions', 'app_content', 'app_theme', 'contact_messages'];
    const missing = required.filter((table) => !report.tables.includes(table));
    if (missing.length > 0) {
      report.db = `chybí tabulky: ${missing.join(', ')}`;
      report.hint =
        'Spusťte migrace: npx wrangler d1 execute ddhomeinvest --remote --file=migrations/0001_initial.sql a --file=migrations/0002_login_cpu_safe.sql';
    } else {
      const users = await db.prepare('SELECT COUNT(*) AS count FROM admin_users').first();
      report.adminUsers = Number(users?.count || 0);
      if (report.adminUsers === 0) {
        report.db = 'tabulky jsou, ale chybí administrátorský uživatel';
        report.hint = 'Spusťte znovu migrations/0001_initial.sql (zakládá uživatele honza2555).';
      }
    }

    // efektivní ID (uložené v D1, jinak výchozí z DEFAULT_CONTENT)
    report.formspreeId = (await resolveFormspreeId(env)) || null;
  } catch (error) {
    const mapped = mapDatabaseError(error instanceof Error ? error.message : String(error));
    report.db = mapped ? mapped.message : 'nedostupná';
    report.hint = mapped?.hint || (error instanceof Error ? error.message : String(error));
  }

  report.ok = report.db === 'ok' && report.media === 'ok';
  return jsonResponse(report, report.ok ? 200 : 503, noStoreHeaders());
}

async function handleMedia(env, pathname) {
  const media = requireMedia(env);
  const key = pathname.replace(/^\/media\//, '');
  if (!key) return new Response('Not found', { status: 404 });

  const object = await media.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
}

async function handleLogin(request, env) {
  const db = requireDb(env);
  const body = await readJson(request);
  const username = String(body.username || '').trim();
  const password = String(body.password || '');

  if (!password) {
    return jsonResponse({ error: 'Vyplňte heslo.' }, 400, noStoreHeaders());
  }

  const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const throttled = checkLoginThrottle(clientIp);
  if (!throttled.ok) {
    return jsonResponse(
      { error: 'Příliš mnoho pokusů o přihlášení. Zkuste to prosím znovu za chvíli.' },
      429,
      noStoreHeaders(),
    );
  }

  let user = null;

  if (username) {
    // přihlášení jménem a heslem
    user = await db
      .prepare('SELECT username, password_hash, password_salt, iterations FROM admin_users WHERE username = ? LIMIT 1')
      .bind(username)
      .first();
  } else {
    // přihlášení pouze heslem (web má jediného administrátora)
    const users = await db
      .prepare('SELECT username, password_hash, password_salt, iterations FROM admin_users LIMIT 1')
      .all();
    user = users.results && users.results.length > 0 ? users.results[0] : null;
  }

  if (!user) {
    return jsonResponse(
      {
        error: 'Neplatné přihlašovací údaje.',
        message: 'V D1 není žádný administrátorský uživatel – spusťte migrations/0001_initial.sql.',
      },
      401,
      noStoreHeaders(),
    );
  }

  const iterations = clampIterations(user.iterations);
  const computedHash = await hashPassword(password, user.password_salt, iterations);
  if (!timingSafeEqualHex(computedHash, user.password_hash)) {
    registerFailedLogin(clientIp);
    return jsonResponse({ error: 'Neplatné přihlašovací údaje.' }, 401, noStoreHeaders());
  }

  clearLoginThrottle(clientIp);

  // Pokud je hash levnější než aktuální výchozí nastavení, při úspěšném
  // přihlášení ho rovnou posílíme (bez znalosti hesla to nejde).
  const targetIterations = resolveIterations(env);
  if (iterations < targetIterations) {
    const upgradedHash = await hashPassword(password, user.password_salt, targetIterations);
    await db
      .prepare('UPDATE admin_users SET password_hash = ?, iterations = ? WHERE username = ?')
      .bind(upgradedHash, targetIterations, user.username)
      .run();
  }

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await db
    .prepare('INSERT OR REPLACE INTO admin_sessions (token_hash, username, expires_at) VALUES (?, ?, ?)')
    .bind(tokenHash, user.username, expiresAt)
    .run();

  const headers = new Headers(noStoreHeaders());
  headers.append(
    'set-cookie',
    `dd_admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_DAYS * 24 * 60 * 60}`,
  );

  // Při přihlášení pouze heslem username klientovi neposíláme.
  const responseData = username ? { ok: true, token, username: user.username } : { ok: true, token };
  return jsonResponse(responseData, 200, headers);
}

function resolveIterations(env) {
  const fromEnv = Number(env?.ADMIN_PBKDF2_ITERATIONS);
  if (Number.isFinite(fromEnv) && fromEnv >= MIN_PBKDF2_ITERATIONS) {
    return Math.min(Math.floor(fromEnv), MAX_PBKDF2_ITERATIONS);
  }
  return DEFAULT_PBKDF2_ITERATIONS;
}

function clampIterations(value) {
  const iterations = Number(value);
  if (!Number.isFinite(iterations) || iterations < MIN_PBKDF2_ITERATIONS) return DEFAULT_PBKDF2_ITERATIONS;
  return Math.min(Math.floor(iterations), MAX_PBKDF2_ITERATIONS);
}

function checkLoginThrottle(key) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    return { ok: true };
  }
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true };
}

function registerFailedLogin(key) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }

  // úklid, aby mapa nerostla bez hranic
  if (loginAttempts.size > 500) {
    for (const [mapKey, value] of loginAttempts) {
      if (value.resetAt <= now) loginAttempts.delete(mapKey);
    }
  }
}

function clearLoginThrottle(key) {
  loginAttempts.delete(key);
}

async function handleLogout(request, env) {
  const db = requireDb(env);
  const token = getSessionToken(request);
  if (token) {
    const tokenHash = await sha256Hex(token);
    await db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).run();
  }

  const headers = new Headers(noStoreHeaders());
  headers.append('set-cookie', 'dd_admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
  return jsonResponse({ ok: true }, 200, headers);
}

async function handleUpload(request, env, username) {
  const media = requireMedia(env);
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

  await media.put(objectKey, file.stream(), {
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

async function handleContact(request, env, url, ctx = {}) {
  let payload = {};
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    payload = await readJson(request);
  } else {
    const formData = await request.formData();
    payload = Object.fromEntries(formData.entries());
  }

  const name = String(payload.name || '').trim().slice(0, 200);
  const email = String(payload.email || '').trim().slice(0, 200);
  const phone = String(payload.phone || '').trim().slice(0, 60);
  const message = String(payload.message || '').trim().slice(0, 5000);

  if (!name || !email || !message) {
    return jsonResponse({ error: 'Vyplňte prosím jméno, e-mail a zprávu.' }, 400, noStoreHeaders());
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Zadejte platný e-mail.' }, 400, noStoreHeaders());
  }

  // E-mailová notifikace přes Formspree (stejně jako dřív) běží na pozadí,
  // aby odpověď formuláři nezdržovalo a aby chyba Formspree neshodila web.
  const formspreeId = await resolveFormspreeId(env);
  const forwardPromise = forwardToFormspree(formspreeId, { name, email, phone, message }, url).catch((error) => {
    console.error('[admin-api] formspree forward failed:', error instanceof Error ? error.message : error);
    return { forwarded: false };
  });
  if (typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(forwardPromise);
  }

  let stored = true;
  try {
    const db = requireDb(env);
    await db
      .prepare('INSERT INTO contact_messages (name, email, phone, message, source_url) VALUES (?, ?, ?, ?, ?)')
      .bind(name, email, phone, message, url.pathname)
      .run();
  } catch (error) {
    stored = false;
    console.error('[admin-api] /api/contact D1 insert failed:', error instanceof Error ? error.message : error);
  }

  if (stored) {
    // Zpráva je v D1 (viditelná v administraci) – na Formspree čekáme jen na pozadí.
    return jsonResponse({ ok: true, message: 'Děkujeme, zpráva byla odeslána.', stored: true }, 200, noStoreHeaders());
  }

  // Bez D1 bychom o zprávu přišli – počkáme na Formspree a výsledek přiznáme.
  const forwarded = await forwardPromise;
  if (!forwarded?.forwarded) {
    return jsonResponse(
      {
        error: 'Zprávu se nepodařilo uložit ani odeslat.',
        message: 'Zkontrolujte /api/health (D1) a nastavení Formspree.',
      },
      503,
      noStoreHeaders(),
    );
  }

  return jsonResponse(
    { ok: true, message: 'Děkujeme, zpráva byla odeslána.', stored: false, forwarded: true },
    200,
    noStoreHeaders(),
  );
}

async function resolveFormspreeId(env) {
  if (env?.FORMSPREE_ID) return String(env.FORMSPREE_ID).trim();
  try {
    const content = await getContent(env);
    // prázdná hodnota v administraci = přeposílání vypnuté
    return String(content?.siteConfig?.formspreeId ?? '').trim();
  } catch {
    // D1 nedostupná – použijeme výchozí ID, aby zpráva nepřišla nazmar
    return String(DEFAULT_CONTENT.siteConfig?.formspreeId ?? '').trim();
  }
}

/**
 * Přepošle zprávu na Formspree (https://formspree.io/f/<id>).
 * Vrací { forwarded: boolean, status?: number } – nikdy nevyhazuje.
 */
async function forwardToFormspree(formspreeId, { name, email, phone, message }, url) {
  const id = String(formspreeId || '').trim();
  if (!id) return { forwarded: false };

  const response = await fetch(`https://formspree.io/f/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      name,
      email,
      phone,
      message,
      _subject: `Nová zpráva z webu D&D HOMEINVEST – ${name}`,
      _replyto: email,
      _template: 'table',
      source: url?.origin || '',
    }),
  });

  return { forwarded: response.ok, status: response.status };
}

async function requireAuth(request, env) {
  const db = requireDb(env);
  const token = getSessionToken(request);
  if (!token) {
    return { ok: false, response: jsonResponse({ error: 'Unauthorized' }, 401, noStoreHeaders()) };
  }

  const tokenHash = await sha256Hex(token);
  const session = await db
    .prepare('SELECT username, expires_at FROM admin_sessions WHERE token_hash = ? LIMIT 1')
    .bind(tokenHash)
    .first();

  if (!session) {
    return { ok: false, response: jsonResponse({ error: 'Unauthorized' }, 401, noStoreHeaders()) };
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).run();
    return { ok: false, response: jsonResponse({ error: 'Session expired' }, 401, noStoreHeaders()) };
  }

  return { ok: true, username: session.username };
}

async function getContent(env) {
  const db = requireDb(env);
  const row = await db.prepare('SELECT data FROM app_content WHERE id = 1 LIMIT 1').first();
  if (!row?.data) return withComputedDefaults(DEFAULT_CONTENT);

  try {
    return withComputedDefaults(JSON.parse(row.data));
  } catch {
    return withComputedDefaults(DEFAULT_CONTENT);
  }
}

async function getTheme(env) {
  const db = requireDb(env);
  const row = await db.prepare('SELECT data FROM app_theme WHERE id = 1 LIMIT 1').first();
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
      salt: encoder.encode(String(saltHex)),
      iterations: clampIterations(iterations),
    },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(derivedBits));
}

/** Porovnání hashů v konstantním čase (bez early-exitu podle délky prefixu). */
function timingSafeEqualHex(a, b) {
  const left = String(a || '').toLowerCase();
  const right = String(b || '').toLowerCase();
  if (left.length !== right.length || left.length === 0) return false;

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
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

function sanitizePathPart(value) {
  return (
    value
      .split('/')
      .map((segment) => segment.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
      .filter(Boolean)
      .join('/') || 'uploads'
  );
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
