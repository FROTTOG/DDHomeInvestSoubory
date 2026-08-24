import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { onRequest as middleware } from '../functions/_middleware.js';
import { DEFAULT_CONTENT } from '../src/default-content.js';

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
  constructor() {
    this.content = null;
    this.theme = null;
    this.users = new Map([
      [
        'honza2555',
        {
          username: 'honza2555',
          password_hash: '941bb31cce0dd299760f278bc1ebcd611505b8c1453be236a797b74e47012856',
          password_salt: '8ebfff49ef27e1f70d351bbf4b7b7fca',
          iterations: 210000,
        },
      ],
    ]);
    this.sessions = new Map();
    this.messages = [];
  }

  prepare(sql) {
    return new MockStatement(this, sql);
  }

  async first(sql, params) {
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
    if (sql.includes('SELECT id, name, email, phone, message, source_url, created_at FROM contact_messages')) {
      return { results: this.messages };
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

function createEnv() {
  return {
    DB: new MockDB(),
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

  const response = await middleware({
    request,
    env,
    next: async () => {
      nextCalled = true;
      return new Response('static-asset', { status: 200, headers: { 'content-type': 'text/plain' } });
    },
  });

  return { response, nextCalled };
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
  assert.match(contentHook, /fetch\('\/api\/content'/);
});

test('admin page (Next.js) saves content via API with Bearer token', async () => {
  const adminPage = readFileSync(path.join(repoRoot, 'app/admin/page.tsx'), 'utf-8');
  assert.match(adminPage, /fetch\('\/api\/content'/);
  assert.match(adminPage, /method: 'PUT'/);
  assert.match(adminPage, /authorization: `Bearer \$\{token\}`/);
  assert.match(adminPage, /\/api\/upload/);
  assert.match(adminPage, /\/api\/contact-messages/);
});

test('repo does not ship prebuilt static export in git root', async () => {
  // web se builduje přes `next build` do out/ – v kořeni repozitáře nesmí být
  // starý ručně commitnutý export
  assert.equal(existsSync(path.join(repoRoot, 'index.html')), false);
  assert.equal(existsSync(path.join(repoRoot, '_next')), false);
});
