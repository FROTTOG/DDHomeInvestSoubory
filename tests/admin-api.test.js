import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { onRequest as middleware } from '../functions/_middleware.js';
import { DEFAULT_CONTENT } from '../src/default-content.js';
import { DEFAULT_PBKDF2_ITERATIONS } from '../src/admin-api.js';

const ADMIN_PASSWORD = 'AsD123+--+321DsA';
const ADMIN_SALT = 'ae7bae85c5d35028b2037b2efeae8ed3';

/** Stejný výpočet jako src/admin-api.js (PBKDF2-SHA256 nad UTF-8 solí). */
const pbkdf2Hex = (password, salt, iterations) =>
  crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

class MockStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.params = [];
  }

  bind(...params) {
    this.params = params;
    return this;
  }

  async first() {
    return this.db.first(this.sql, this.params);
  }

  async run() {
    return this.db.run(this.sql, this.params);
  }

  async all() {
    return this.db.all(this.sql, this.params);
  }
}

class MockDB {
  constructor({ failWith = null, tables = null } = {}) {
    this.content = null;
    this.theme = null;
    this.failWith = failWith;
    this.tables = tables || [
      'admin_sessions',
      'admin_users',
      'app_content',
      'app_theme',
      'contact_messages',
      'content_draft',
      'content_versions',
      'watch_subscribers',
      'email_notifications',
      'analytics_events',
    ];
    this.users = new Map([
      [
        'honza2555',
        {
          username: 'honza2555',
          // hash z migrations/0002_login_cpu_safe.sql (25 000 iterací – vejde se do CPU limitu Workers)
          password_hash: pbkdf2Hex(ADMIN_PASSWORD, ADMIN_SALT, DEFAULT_PBKDF2_ITERATIONS),
          password_salt: ADMIN_SALT,
          iterations: DEFAULT_PBKDF2_ITERATIONS,
        },
      ],
    ]);
    this.sessions = new Map();
    this.messages = [];
  }

  prepare(sql) {
    this.guard();
    return new MockStatement(this, sql);
  }

  /** Simulace chyby D1 (např. chybějící tabulky na produkci). */
  guard() {
    if (this.failWith) throw new Error(this.failWith);
  }

  async first(sql, params) {
    if (sql.includes('SELECT COUNT(*) AS count FROM admin_users')) {
      return { count: this.users.size };
    }
    if (sql.includes('SELECT username, password_hash, password_salt, iterations FROM admin_users')) {
      return this.users.get(params[0]) || null;
    }
    if (sql.includes('SELECT username, expires_at FROM admin_sessions')) {
      return this.sessions.get(params[0]) || null;
    }
    if (sql.includes('SELECT data FROM app_content')) {
      return this.content ? { data: this.content } : null;
    }
    if (sql.includes('SELECT data FROM app_theme')) {
      return this.theme ? { data: this.theme } : null;
    }
    throw new Error(`Unhandled first SQL: ${sql}`);
  }

  async run(sql, params) {
    if (sql.includes('UPDATE admin_users SET password_hash')) {
      const user = this.users.get(params[2]);
      if (user) {
        user.password_hash = params[0];
        user.iterations = params[1];
      }
      return { success: true };
    }
    if (sql.includes('INSERT OR REPLACE INTO admin_sessions')) {
      this.sessions.set(params[0], { username: params[1], expires_at: params[2] });
      return { success: true };
    }
    if (sql.includes('DELETE FROM admin_sessions WHERE token_hash = ?')) {
      this.sessions.delete(params[0]);
      return { success: true };
    }
    if (sql.includes('INSERT INTO contact_messages')) {
      this.messages.unshift({
        id: this.messages.length + 1,
        name: params[0],
        email: params[1],
        phone: params[2],
        message: params[3],
        source_url: params[4],
        created_at: new Date().toISOString(),
      });
      return { success: true };
    }
    if (sql.includes('INSERT INTO app_content')) {
      this.content = params[0];
      return { success: true };
    }
    if (sql.includes('INSERT INTO app_theme')) {
      this.theme = params[0];
      return { success: true };
    }
    throw new Error(`Unhandled run SQL: ${sql}`);
  }

  async all(sql) {
    if (sql.includes('SELECT name FROM sqlite_master')) {
      return { results: this.tables.map((name) => ({ name })) };
    }
    if (sql.includes('SELECT username, password_hash, password_salt, iterations FROM admin_users')) {
      // přihlášení pouze heslem – API bere prvního administrátora
      return { results: [...this.users.values()] };
    }
    if (sql.includes('FROM contact_messages ORDER BY id DESC')) {
      return { results: this.messages.map((message) => ({ status: 'new', admin_note: '', ...message })) };
    }
    throw new Error(`Unhandled all SQL: ${sql}`);
  }
}

class MockR2 {
  constructor() {
    this.objects = new Map();
  }

  async put(key, body, options = {}) {
    const bytes =
      body instanceof ReadableStream ? await new Response(body).arrayBuffer() : await body.arrayBuffer();
    this.objects.set(key, { bytes, options });
  }

  async get(key) {
    const object = this.objects.get(key);
    if (!object) return null;
    return {
      body: object.bytes,
      httpEtag: 'mock-etag',
      writeHttpMetadata(headers) {
        if (object.options.httpMetadata?.contentType) {
          headers.set('content-type', object.options.httpMetadata.contentType);
        }
      },
    };
  }
}

function createEnv(dbOptions = {}) {
  return {
    DB: new MockDB(dbOptions),
    MEDIA: new MockR2(),
  };
}

async function callMiddleware(env, path, options = {}) {
  let nextCalled = false;
  const request =
    options.request ||
    new Request(`https://example.com${path}`, {
      method: options.method || (options.body ? 'POST' : 'GET'),
      headers: options.headers,
      body: options.body,
    });

  const background = [];
  const response = await middleware({
    request,
    env,
    next: async () => {
      nextCalled = true;
      return new Response('static-asset', { status: 200, headers: { 'content-type': 'text/plain' } });
    },
    waitUntil: (promise) => background.push(promise),
  });

  return { response, nextCalled, background };
}

async function login(env, { username = 'honza2555', password = 'AsD123+--+321DsA' } = {}) {
  const { response } = await callMiddleware(env, '/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  assert.equal(response.status, 200, `login should succeed, got ${response.status}: ${JSON.stringify(data)}`);
  return data.token;
}

test('admin login returns token (correct credentials)', async () => {
  const env = createEnv();
  const { response } = await callMiddleware(env, '/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'honza2555', password: 'AsD123+--+321DsA' }),
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.username, 'honza2555');
  assert.ok(data.token.length > 20);
});

test('admin login rejects wrong password or unknown user', async () => {
  const env = createEnv();

  const wrongPassword = await callMiddleware(env, '/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'honza2555', password: 'nepravne-heslo' }),
  });
  assert.equal(wrongPassword.response.status, 401);

  const unknownUser = await callMiddleware(env, '/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'nikdo', password: 'xyz' }),
  });
  assert.equal(unknownUser.response.status, 401);
});

test('public content and theme endpoints work without auth', async () => {
  const env = createEnv();

  const content = await callMiddleware(env, '/api/content');
  assert.equal(content.response.status, 200);
  const contentData = await content.response.json();
  assert.ok(contentData.siteConfig);

  const theme = await callMiddleware(env, '/api/theme');
  assert.equal(theme.response.status, 200);
  const themeData = await theme.response.json();
  assert.ok(themeData.colors);
});

test('content and theme update require authorization', async () => {
  const env = createEnv();

  const content = await callMiddleware(env, '/api/content', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(DEFAULT_CONTENT),
  });
  assert.equal(content.response.status, 401);

  const theme = await callMiddleware(env, '/api/theme', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ colors: { navy: '#000000' } }),
  });
  assert.equal(theme.response.status, 401);
});

test('authorized content update is stored and returned by /api/content', async () => {
  const env = createEnv();
  const token = await login(env);

  const updated = {
    ...DEFAULT_CONTENT,
    heroContent: {
      ...DEFAULT_CONTENT.heroContent,
      title: 'NOVÝ TITULEK',
    },
  };

  const saveResponse = await callMiddleware(env, '/api/content', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updated),
  });
  assert.equal(saveResponse.response.status, 200);

  // veřejný web čte obsah z GET /api/content – změna musí být okamžitě vidět
  const readBack = await callMiddleware(env, '/api/content');
  assert.equal(readBack.response.status, 200);
  const data = await readBack.response.json();
  assert.equal(data.heroContent.title, 'NOVÝ TITULEK');
  // no-store, aby prohlížeč nikdy nedržel starý obsah
  assert.match(readBack.response.headers.get('cache-control') || '', /no-store/);
});

test('contact form stores message in D1', async () => {
  const env = createEnv();
  const { response } = await callMiddleware(env, '/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Jan Test',
      email: 'jan@example.com',
      phone: '+420123456789',
      message: 'Dobrý den, mám zájem o byt.',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(env.DB.messages.length, 1);
  assert.equal(env.DB.messages[0].name, 'Jan Test');

  const invalid = await callMiddleware(env, '/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'x', email: 'neplatny', message: 'y' }),
  });
  assert.equal(invalid.response.status, 400);
});

test('contact messages list requires authorization', async () => {
  const env = createEnv();
  const token = await login(env);
  await callMiddleware(env, '/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Jan Test', email: 'jan@example.com', message: 'Ahoj' }),
  });

  const unauthorized = await callMiddleware(env, '/api/contact-messages');
  assert.equal(unauthorized.response.status, 401);

  const authorized = await callMiddleware(env, '/api/contact-messages', {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(authorized.response.status, 200);
  const messages = await authorized.response.json();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].name, 'Jan Test');
});

test('authorized upload stores image in R2 and serves it back', async () => {
  const env = createEnv();
  const token = await login(env);

  const formData = new FormData();
  formData.set('directory', 'gallery/aktualni');
  formData.set('file', new File([new Uint8Array([137, 80, 78, 71])], 'test.png', { type: 'image/png' }));

  const upload = await callMiddleware(env, '/api/upload', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: formData,
  });
  assert.equal(upload.response.status, 200);
  const uploadData = await upload.response.json();
  assert.match(uploadData.path, /^\/media\//);

  const media = await callMiddleware(env, uploadData.path);
  assert.equal(media.response.status, 200);
  assert.equal(media.response.headers.get('content-type'), 'image/png');
});

test('upload requires authorization and image files only', async () => {
  const env = createEnv();

  const unauthorized = await callMiddleware(env, '/api/upload', {
    method: 'POST',
    body: new FormData(),
  });
  assert.equal(unauthorized.response.status, 401);

  const token = await login(env);
  const textFile = new FormData();
  textFile.set('directory', 'uploads');
  textFile.set('file', new File([new TextEncoder().encode('text')], 'poznamka.txt', { type: 'text/plain' }));
  const rejected = await callMiddleware(env, '/api/upload', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: textFile,
  });
  assert.equal(rejected.response.status, 400);
});

test('logout invalidates session', async () => {
  const env = createEnv();
  const token = await login(env);

  const afterLogout = await callMiddleware(env, '/api/content', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(DEFAULT_CONTENT),
  });
  assert.equal(afterLogout.response.status, 200);

  const logout = await callMiddleware(env, '/api/logout', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(logout.response.status, 200);

  const rejected = await callMiddleware(env, '/api/content', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(DEFAULT_CONTENT),
  });
  assert.equal(rejected.response.status, 401);
});

test('cookie based session is accepted', async () => {
  const env = createEnv();
  const token = await login(env);

  const { response } = await callMiddleware(env, '/api/content', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      cookie: `dd_admin_session=${token}`,
    },
    body: JSON.stringify(DEFAULT_CONTENT),
  });
  assert.equal(response.status, 200);
});

test('static files bypass middleware (next is called)', async () => {
  const env = createEnv();
  for (const pathName of ['/', '/index.html', '/builder/', '/_next/static/css/05751101c3fd5530.css', '/admin/', '/admin/login/']) {
    const { response, nextCalled } = await callMiddleware(env, pathName);
    assert.equal(nextCalled, true, `expected next() for ${pathName}`);
    assert.equal(response.status, 200);
  }

  // neexistující API endpoint
  const missing = await callMiddleware(env, '/api/nic');
  assert.equal(missing.response.status, 404);
  assert.equal(missing.nextCalled, false);
});

test('login page (Next.js) posts to /api/login and stores session', async () => {
  const loginPage = readFileSync(path.join(repoRoot, 'app/admin/login/page.tsx'), 'utf-8');
  assert.match(loginPage, /fetch\('\/api\/login'/);
  assert.match(loginPage, /localStorage\.setItem\('dd_admin_session'/);
});

test('home page (Next.js) loads content from API and submits contact form to API', async () => {
  const homePage = readFileSync(path.join(repoRoot, 'app/page.tsx'), 'utf-8');
  assert.match(homePage, /fetch\('\/api\/contact'/);
  assert.match(homePage, /useSiteContent/);

  const contentHook = readFileSync(path.join(repoRoot, 'app/lib/use-content.ts'), 'utf-8');
  assert.match(contentHook, /'\/api\/content'/);
});

test('admin page saves drafts, publishes and authenticates API calls', async () => {
  const adminPage = readFileSync(path.join(repoRoot, 'app/admin/page.tsx'), 'utf-8');
  assert.match(adminPage, /\/api\/draft/);
  assert.match(adminPage, /\/api\/publish/);
  assert.match(adminPage, /method: 'PUT'/);
  assert.match(adminPage, /authorization: `Bearer/);
  assert.match(adminPage, /\/api\/upload/);
  assert.match(adminPage, /\/api\/contact-messages/);
});

test('repo does not ship prebuilt static export in git root', async () => {
  // web se builduje přes `next build` do out/ – v kořeni repozitáře nesmí být
  // starý ručně commitnutý export
  assert.equal(existsSync(path.join(repoRoot, 'index.html')), false);
  assert.equal(existsSync(path.join(repoRoot, '_next')), false);
});

// ---------------------------------------------------------------------------
// Regrese: Internal Server Error na /admin/login
// ---------------------------------------------------------------------------

test('login funguje i bez jména (přesně tak to posílá přihlašovací stránka)', async () => {
  const env = createEnv();
  const { response } = await callMiddleware(env, '/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });

  const data = await response.json();
  assert.equal(response.status, 200, `password-only login má projít: ${JSON.stringify(data)}`);
  assert.equal(data.ok, true);
  assert.ok(data.token.length > 20);
  assert.equal(data.username, undefined, 'username se bez přihlašovacího jména neposílá');
});

test('hash z migrace 0002 (25 000 iterací) se ověří a hash z 0001 (210 000) také', async () => {
  const env = createEnv();

  // výchozí uživatel = migrace 0002
  const fresh = await callMiddleware(env, '/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  assert.equal(fresh.response.status, 200);

  // legacy hash z 0001 (210 000 iterací) musí jít stále ověřit
  const legacySalt = '8ebfff49ef27e1f70d351bbf4b7b7fca';
  env.DB.users.set('legacy', {
    username: 'legacy',
    password_hash: pbkdf2Hex(ADMIN_PASSWORD, legacySalt, 210000),
    password_salt: legacySalt,
    iterations: 210000,
  });
  const legacy = await callMiddleware(env, '/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'legacy', password: ADMIN_PASSWORD }),
  });
  assert.equal(legacy.response.status, 200);
});

test('slabý hash se při přihlášení posílí na výchozí počet iterací', async () => {
  const env = createEnv();
  const weakSalt = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  env.DB.users.set('honza2555', {
    username: 'honza2555',
    password_hash: pbkdf2Hex(ADMIN_PASSWORD, weakSalt, 10000),
    password_salt: weakSalt,
    iterations: 10000,
  });

  const { response } = await callMiddleware(env, '/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  assert.equal(response.status, 200);

  const upgraded = env.DB.users.get('honza2555');
  assert.equal(upgraded.iterations, DEFAULT_PBKDF2_ITERATIONS);
  assert.equal(upgraded.password_hash, pbkdf2Hex(ADMIN_PASSWORD, weakSalt, DEFAULT_PBKDF2_ITERATIONS));
});

test('chybějící tabulky v D1 vrací srozumitelnou chybu místo Internal Server Error', async () => {
  // přesně ten stav, který na produkci hlásil "Internal Server Error"
  const env = createEnv({ failWith: 'D1_ERROR: no such table: admin_users: SQLITE_ERROR' });

  const { response } = await callMiddleware(env, '/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.notEqual(data.error, 'Internal Server Error');
  assert.match(data.error, /Databáze není připravená/);
  assert.match(data.hint, /wrangler d1 execute/);
});

test('chybějící D1 binding vrací návod místo Internal Server Error', async () => {
  const env = { MEDIA: new MockR2() }; // DB binding chybí

  const { response } = await callMiddleware(env, '/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.match(data.error, /Chybí D1 binding DB/);
});

test('opakovane spatne heslo skonci na 429 (ochrana proti hádání)', async () => {
  const env = createEnv();
  let last;
  for (let i = 0; i < 12; i += 1) {
    last = await callMiddleware(env, '/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
      body: JSON.stringify({ password: 'spatne-heslo' }),
    });
  }
  assert.equal(last.response.status, 429);
});

test('/api/health hlásí stav bindingů a tabulek', async () => {
  const healthy = await callMiddleware(createEnv(), '/api/health');
  assert.equal(healthy.response.status, 200);
  const report = await healthy.response.json();
  assert.equal(report.ok, true);
  assert.deepEqual(report.tables, [
    'admin_sessions',
    'admin_users',
    'app_content',
    'app_theme',
    'contact_messages',
    'content_draft',
    'content_versions',
    'watch_subscribers',
    'email_notifications',
    'analytics_events',
  ]);
  assert.equal(report.adminUsers, 1);
  assert.equal(report.pbkdf2Iterations, DEFAULT_PBKDF2_ITERATIONS);

  const broken = await callMiddleware(createEnv({ failWith: 'D1_ERROR: no such table: admin_users' }), '/api/health');
  assert.equal(broken.response.status, 503);
  const brokenReport = await broken.response.json();
  assert.equal(brokenReport.ok, false);
  assert.match(brokenReport.db, /chybí tabulky|Databáze není připravená/);
});

// ---------------------------------------------------------------------------
// Kontaktní formulář: D1 + Formspree
// ---------------------------------------------------------------------------

test('kontaktní formulář se uloží do D1 a přepošle na Formspree', async () => {
  const env = createEnv();
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const { response, background } = await callMiddleware(env, '/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Jan Test',
        email: 'jan@example.com',
        phone: '+420123456789',
        message: 'Dobrý den, mám zájem o byt.',
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(env.DB.messages.length, 1);

    await Promise.all(background);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `https://formspree.io/f/${DEFAULT_CONTENT.siteConfig.formspreeId}`);
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.email, 'jan@example.com');
    assert.equal(body._replyto, 'jan@example.com');
    assert.match(body._subject, /Nová zpráva z webu/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('když D1 spadne, zpráva projde alespoň přes Formspree', async () => {
  const env = createEnv({ failWith: 'D1_ERROR: no such table: contact_messages: SQLITE_ERROR' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"ok":true}', { status: 200 });

  try {
    const { response, background } = await callMiddleware(env, '/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Jan', email: 'jan@example.com', message: 'Ahoj' }),
    });
    const data = await response.json();
    assert.equal(response.status, 200, JSON.stringify(data));
    assert.equal(data.stored, false);
    assert.equal(data.forwarded, true);
    await Promise.all(background);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('bez D1 i bez Formspree formulář přizná chybu', async () => {
  const env = createEnv({ failWith: 'D1_ERROR: no such table: contact_messages: SQLITE_ERROR' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('error', { status: 500 });

  try {
    const { response } = await callMiddleware(env, '/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Jan', email: 'jan@example.com', message: 'Ahoj' }),
    });
    assert.equal(response.status, 503);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// Regrese: neviditelné texty a odebrané animace
// ---------------------------------------------------------------------------

test('tailwind config obsahuje tokeny, kvůli kterým mizel text', () => {
  const config = readFileSync(path.join(repoRoot, 'tailwind.config.js'), 'utf-8');
  assert.match(config, /'off-white': '#f8f6f1'/, 'bg-off-white musí existovat (sekce O nás / Galerie / Kontakt)');
  assert.match(config, /DEFAULT: '#6f6a64'/, 'text-gray musí mít vlastní barvu (texty v kartách týmu)');
  assert.match(config, /copper: '#b87333'/, 'to-copper musí existovat (gradient v kartě týmu)');
  assert.match(config, /light: '#e8e4dc'/, 'gray-light odpovídá původní paletě');
});

test('globals.css vrací animace (morph, border, shake, reveal) a fonty', () => {
  const css = readFileSync(path.join(repoRoot, 'app/globals.css'), 'utf-8');
  assert.match(css, /\.morph-shape \{[\s\S]*?animation: morph/);
  assert.match(css, /\.morph-shape-alt \{[\s\S]*?animation: morphAlt/);
  assert.match(css, /\.animated-border::before/);
  assert.match(css, /@keyframes borderGradient/);
  assert.match(css, /\.shake-animation/);
  assert.match(css, /\.js \.reveal \{/, 'reveal se schová jen když běží JS');
  assert.match(css, /--font-body:/, 'bez --font-body by body spadlo na serif');
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('úvodní stránka používá nový oddělovač sekcí místo plného tmavého pruhu', () => {
  const home = readFileSync(path.join(repoRoot, 'app/page.tsx'), 'utf-8');
  assert.doesNotMatch(home, /<div className="w-full bg-navy">/, 'starý oddělovač má být pryč');
  assert.match(home, /const SectionDivider = /);
  assert.ok((home.match(/<SectionDivider/g) || []).length >= 4, 'oddělovače mezi sekcemi');
  assert.match(home, /morph-shape/, 'hero dekorace mají animovaný morph');
});

test('migrace 0002 obsahuje hash, který odpovídá heslu z dokumentace', () => {
  const migration = readFileSync(path.join(repoRoot, 'migrations/0002_login_cpu_safe.sql'), 'utf-8');
  const hash = pbkdf2Hex(ADMIN_PASSWORD, ADMIN_SALT, DEFAULT_PBKDF2_ITERATIONS);
  assert.ok(migration.includes(hash), 'migrace musí obsahovat platný hash');
  assert.match(migration, /iterations = 25000/);
});
