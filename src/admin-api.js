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
const analyticsLimits = new Map();

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
        "SELECT id, name, email, phone, message, source_url, created_at, status, admin_note FROM contact_messages ORDER BY id DESC LIMIT 500",
      ).all();

      return jsonResponse(rows.results || [], 200, noStoreHeaders());
    }

    const messageMatch = pathname.match(/^\/api\/contact-messages\/(\d+)$/);
    if (messageMatch && request.method === 'PATCH') {
      const session = await requireAuth(request, env);
      if (!session.ok) return session.response;
      const body = await readJson(request);
      const status = ['new', 'contacted', 'resolved'].includes(body.status) ? body.status : 'new';
      const note = String(body.admin_note || '').slice(0, 3000);
      await env.DB.prepare('UPDATE contact_messages SET status = ?, admin_note = ? WHERE id = ?')
        .bind(status, note, Number(messageMatch[1])).run();
      return jsonResponse({ ok: true }, 200, noStoreHeaders());
    }

    if (pathname === '/api/draft') {
      const session = await requireAuth(request, env);
      if (!session.ok) return session.response;
      if (request.method === 'GET') return jsonResponse(await getDraft(env), 200, noStoreHeaders());
      if (request.method === 'PUT') {
        const content = withComputedDefaults(await readJson(request));
        await env.DB.prepare(
          `INSERT INTO content_draft (id, data, updated_at, updated_by) VALUES (1, ?, CURRENT_TIMESTAMP, ?)
           ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=CURRENT_TIMESTAMP, updated_by=excluded.updated_by`,
        ).bind(JSON.stringify(content), session.username).run();
        return jsonResponse({ ok: true }, 200, noStoreHeaders());
      }
    }

    if (pathname === '/api/publish' && request.method === 'POST') {
      const session = await requireAuth(request, env);
      if (!session.ok) return session.response;
      const body = await readJson(request);
      const next = withComputedDefaults(body.content || await getDraft(env));
      const previous = await getContent(env);
      await env.DB.prepare('INSERT INTO content_versions (data, created_by, note) VALUES (?, ?, ?)')
        .bind(JSON.stringify(previous), session.username, String(body.note || 'Předchozí publikovaná verze').slice(0, 300)).run();
      await saveJson(env.DB, 'app_content', next);
      const notification = await notifyProjectChanges(env, previous, next, new URL(request.url).origin, ctx);
      return jsonResponse({ ok: true, notification }, 200, noStoreHeaders());
    }

    if (pathname === '/api/versions' && request.method === 'GET') {
      const session = await requireAuth(request, env);
      if (!session.ok) return session.response;
      const rows = await env.DB.prepare('SELECT id, created_at, created_by, note FROM content_versions ORDER BY id DESC LIMIT 30').all();
      return jsonResponse(rows.results || [], 200, noStoreHeaders());
    }

    const versionMatch = pathname.match(/^\/api\/versions\/(\d+)$/);
    if (versionMatch && request.method === 'GET') {
      const session = await requireAuth(request, env);
      if (!session.ok) return session.response;
      const row = await env.DB.prepare('SELECT data FROM content_versions WHERE id = ?').bind(Number(versionMatch[1])).first();
      if (!row) return jsonResponse({ error: 'Verze nenalezena.' }, 404, noStoreHeaders());
      return jsonResponse(JSON.parse(row.data), 200, noStoreHeaders());
    }

    if (pathname === '/api/watch' && request.method === 'POST') return handleWatchSubscribe(request, env);
    if (pathname === '/api/watch/confirm' && request.method === 'GET') return handleWatchConfirm(url, env);
    if (pathname === '/api/watch/unsubscribe' && request.method === 'GET') return handleWatchUnsubscribe(url, env);

    if (pathname === '/api/watch-subscribers' && request.method === 'GET') {
      const session = await requireAuth(request, env);
      if (!session.ok) return session.response;
      const rows = await env.DB.prepare('SELECT id, email, confirmed, created_at, confirmed_at, unsubscribed_at FROM watch_subscribers ORDER BY id DESC').all();
      return jsonResponse(rows.results || [], 200, noStoreHeaders());
    }

    if (pathname === '/api/events' && request.method === 'POST') return handleAnalyticsEvent(request, env, url);
    if (pathname === '/api/analytics' && request.method === 'GET') {
      const session = await requireAuth(request, env);
      if (!session.ok) return session.response;
      return jsonResponse(await getAnalytics(env), 200, noStoreHeaders());
    }

    if (pathname === '/api/sitemap.xml' && request.method === 'GET') return dynamicSitemap(env, url.origin);

    // Nouzová bezpečná instalace schématu přes stávající admin session. Hodí se
    // pro Pages projekty, kde CI nemá Cloudflare API token pro `wrangler d1`.
    if (pathname === '/api/setup-features' && request.method === 'POST') {
      const session = await requireAuth(request, env);
      if (!session.ok) return session.response;
      return jsonResponse(await ensureFeatureSchema(env), 200, noStoreHeaders());
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
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('app_content','app_theme','admin_users','admin_sessions','contact_messages','content_draft','content_versions','watch_subscribers','email_notifications','analytics_events') ORDER BY name",
      )
      .all();
    report.tables = (rows.results || []).map((row) => row.name);

    const required = ['admin_users', 'admin_sessions', 'app_content', 'app_theme', 'contact_messages', 'content_draft', 'content_versions', 'watch_subscribers', 'email_notifications', 'analytics_events'];
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

async function ensureFeatureSchema(env) {
  const db = requireDb(env);
  const statements = [
    "ALTER TABLE contact_messages ADD COLUMN status TEXT NOT NULL DEFAULT 'new'",
    "ALTER TABLE contact_messages ADD COLUMN admin_note TEXT NOT NULL DEFAULT ''",
    "CREATE TABLE IF NOT EXISTS content_draft (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL DEFAULT '')",
    "CREATE TABLE IF NOT EXISTS content_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '')",
    'CREATE INDEX IF NOT EXISTS idx_content_versions_created_at ON content_versions(created_at DESC)',
    "CREATE TABLE IF NOT EXISTS watch_subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE COLLATE NOCASE, token TEXT NOT NULL UNIQUE, confirmed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confirmed_at TEXT, unsubscribed_at TEXT)",
    'CREATE INDEX IF NOT EXISTS idx_watch_subscribers_active ON watch_subscribers(confirmed, unsubscribed_at)',
    "CREATE TABLE IF NOT EXISTS email_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, fingerprint TEXT NOT NULL, sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, recipients INTEGER NOT NULL DEFAULT 0, UNIQUE(project_id, fingerprint))",
    "CREATE TABLE IF NOT EXISTS analytics_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, path TEXT NOT NULL DEFAULT '', project_id TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    'CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at DESC)',
  ];
  let applied = 0;
  for (const sql of statements) {
    try { await db.prepare(sql).run(); applied += 1; }
    catch (error) {
      if (!/duplicate column name/i.test(error instanceof Error ? error.message : String(error))) throw error;
    }
  }
  return { ok: true, applied };
}

async function getDraft(env) {
  const row = await requireDb(env).prepare('SELECT data FROM content_draft WHERE id = 1').first();
  if (!row?.data) return getContent(env);
  try { return withComputedDefaults(JSON.parse(row.data)); } catch { return getContent(env); }
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function sendResend(env, { to, subject, html }) {
  if (!env?.RESEND_API) throw new Error('Chybí Cloudflare variable RESEND_API.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: 'D&D HOMEINVEST <notifications@ddhomeinvest.cz>', to: [to], subject, html }),
  });
  if (!response.ok) throw new Error(`Resend vrátil ${response.status}: ${await response.text()}`);
  return response.json();
}

async function sendResendBatch(env, messages) {
  if (!env?.RESEND_API) throw new Error('Chybí Cloudflare variable RESEND_API.');
  const response = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API}`, 'content-type': 'application/json' },
    body: JSON.stringify(messages.map((message) => ({ from: 'D&D HOMEINVEST <notifications@ddhomeinvest.cz>', ...message, to: [message.to] }))),
  });
  if (!response.ok) throw new Error(`Resend batch vrátil ${response.status}: ${await response.text()}`);
  return response.json();
}

async function handleWatchSubscribe(request, env) {
  const body = await readJson(request);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: 'Zadejte platný e-mail.' }, 400, noStoreHeaders());
  const token = randomToken();
  await requireDb(env).prepare(
    `INSERT INTO watch_subscribers (email, token, confirmed, unsubscribed_at) VALUES (?, ?, 0, NULL)
     ON CONFLICT(email) DO UPDATE SET token=excluded.token, confirmed=0, unsubscribed_at=NULL, created_at=CURRENT_TIMESTAMP`,
  ).bind(email, token).run();
  const origin = new URL(request.url).origin;
  await sendResend(env, {
    to: email,
    subject: 'Potvrďte hlídání nových projektů D&D HOMEINVEST',
    html: `<h2>Potvrzení odběru</h2><p>Kliknutím potvrďte, že chcete dostávat upozornění na nové projekty a změny ceny či stavu.</p><p><a href="${origin}/api/watch/confirm?token=${token}">Potvrdit odběr</a></p><p>Pokud jste se nepřihlásili, e-mail ignorujte.</p>`,
  });
  return jsonResponse({ ok: true, message: 'Na e-mail jsme poslali potvrzovací odkaz.' }, 200, noStoreHeaders());
}

async function handleWatchConfirm(url, env) {
  const token = String(url.searchParams.get('token') || '');
  const result = await requireDb(env).prepare(
    'UPDATE watch_subscribers SET confirmed=1, confirmed_at=CURRENT_TIMESTAMP, unsubscribed_at=NULL WHERE token=?',
  ).bind(token).run();
  return new Response(`<!doctype html><html lang="cs"><meta charset="utf-8"><title>Odběr potvrzen</title><body style="font-family:system-ui;max-width:640px;margin:80px auto;padding:24px"><h1>Odběr je potvrzen</h1><p>Upozorníme vás na nové projekty a důležité změny.</p><a href="/">Zpět na web</a></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function handleWatchUnsubscribe(url, env) {
  const token = String(url.searchParams.get('token') || '');
  await requireDb(env).prepare('UPDATE watch_subscribers SET unsubscribed_at=CURRENT_TIMESTAMP WHERE token=?').bind(token).run();
  return new Response('<!doctype html><html lang="cs"><meta charset="utf-8"><title>Odběr zrušen</title><body style="font-family:system-ui;max-width:640px;margin:80px auto;padding:24px"><h1>Odběr byl zrušen</h1><a href="/">Zpět na web</a></body></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function projectFingerprint(project) {
  return `${project.status || ''}|${project.price || ''}`;
}

async function notifyProjectChanges(env, previous, next, origin, ctx = {}) {
  const oldProjects = new Map([...(previous.currentProjects || []), ...(previous.soldProjects || [])].map((p) => [String(p.id), p]));
  const changed = (next.currentProjects || []).filter((project) => {
    const old = oldProjects.get(String(project.id));
    return !old || projectFingerprint(old) !== projectFingerprint(project);
  });
  if (!changed.length) return { changed: 0, queued: 0 };
  const rows = await requireDb(env).prepare('SELECT email, token FROM watch_subscribers WHERE confirmed=1 AND unsubscribed_at IS NULL').all();
  const subscribers = rows.results || [];
  const jobs = [];
  let queued = 0;
  for (const project of changed) {
    const fingerprint = projectFingerprint(project);
    const already = await env.DB.prepare('SELECT id FROM email_notifications WHERE project_id=? AND fingerprint=?').bind(String(project.id), fingerprint).first();
    if (already) continue;
    const slug = project.slug || slugify(project.title || String(project.id));
    const emails = subscribers.map((subscriber) => ({
      to: subscriber.email,
      subject: `${oldProjects.has(String(project.id)) ? 'Aktualizace' : 'Nový projekt'}: ${project.title}`,
      html: `<h2>${escapeHtml(project.title)}</h2><p>${escapeHtml(project.location)}</p><p>Stav: <strong>${escapeHtml(project.status)}</strong>${project.price ? `<br>Cena: <strong>${escapeHtml(project.price)}</strong>` : ''}</p><p><a href="${origin}/projekty/${encodeURIComponent(slug)}/">Zobrazit projekt</a></p><p style="font-size:12px"><a href="${origin}/api/watch/unsubscribe?token=${subscriber.token}">Odhlásit odběr</a></p>`,
    }));
    queued += emails.length;
    const batches = [];
    for (let offset = 0; offset < emails.length; offset += 100) {
      batches.push(sendResendBatch(env, emails.slice(offset, offset + 100)));
    }
    jobs.push(Promise.all(batches)
      .then(() => env.DB.prepare('INSERT OR IGNORE INTO email_notifications (project_id, fingerprint, recipients) VALUES (?, ?, ?)').bind(String(project.id), fingerprint, subscribers.length).run())
      .catch((error) => console.error('[watch]', error)));
  }
  const work = Promise.all(jobs);
  if (ctx.waitUntil) ctx.waitUntil(work); else await work;
  return { changed: changed.length, queued };
}

async function handleAnalyticsEvent(request, env, url) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const now = Date.now();
  const limit = analyticsLimits.get(ip) || { start: now, count: 0 };
  if (now - limit.start > 60_000) { limit.start = now; limit.count = 0; }
  limit.count += 1; analyticsLimits.set(ip, limit);
  if (limit.count > 120) return new Response(null, { status: 429, headers: noStoreHeaders() });
  const body = await readJson(request);
  const event = String(body.event || '').slice(0, 60).replace(/[^a-z0-9_-]/gi, '');
  const path = String(body.path || url.pathname).slice(0, 300);
  const projectId = String(body.projectId || '').slice(0, 100);
  if (!event) return jsonResponse({ error: 'Chybí událost.' }, 400, noStoreHeaders());
  const db = requireDb(env);
  await db.prepare('INSERT INTO analytics_events (event, path, project_id) VALUES (?, ?, ?)').bind(event, path, projectId).run();
  // Přibližně u 1 % požadavků uklidíme stará anonymní data (retence 90 dní).
  if (Math.random() < 0.01) await db.prepare("DELETE FROM analytics_events WHERE created_at < datetime('now','-90 days')").run();
  return new Response(null, { status: 204, headers: noStoreHeaders() });
}

async function getAnalytics(env) {
  const events = await requireDb(env).prepare(
    "SELECT event, COUNT(*) AS count FROM analytics_events WHERE created_at >= datetime('now','-30 days') GROUP BY event ORDER BY count DESC",
  ).all();
  const projects = await env.DB.prepare(
    "SELECT project_id, COUNT(*) AS count FROM analytics_events WHERE event='project_view' AND created_at >= datetime('now','-30 days') GROUP BY project_id ORDER BY count DESC LIMIT 20",
  ).all();
  return { periodDays: 30, events: events.results || [], projects: projects.results || [] };
}

function slugify(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projekt';
}

async function dynamicSitemap(env, origin) {
  const content = await getContent(env);
  const projects = [...(content.currentProjects || []), ...(content.soldProjects || [])];
  const urls = ['/', '/pravni-informace/', '/obchodni-podminky/', ...projects.map((p) => `/projekty/${p.slug || slugify(p.title)}/`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((path) => `<url><loc>${origin}${escapeHtml(path)}</loc><changefreq>${path === '/' ? 'weekly' : 'monthly'}</changefreq></url>`).join('')}</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
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
