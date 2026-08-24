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

test('authorized content update changes generated chunk', async () => {
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

  // dynamický chunk 580 (obě verze hashů z webpack runtimeů)
  for (const chunkPath of ['/_next/static/chunks/580.ec199d0bfe52a281.js', '/_next/static/chunks/580.625fedceaff0ff6e.js']) {
    const chunkResponse = await callMiddleware(env, chunkPath);
    assert.equal(chunkResponse.response.status, 200);
    assert.equal(chunkResponse.nextCalled, false);
    assert.match(chunkResponse.response.headers.get('content-type'), /javascript/);
    const chunkText = await chunkResponse.response.text();
    assert.match(chunkText, /NOVÝ TITULEK/);
  }
});

test('generated chunk is valid JS with all content exports', async () => {
  const { Script } = await import('node:vm');
  const env = createEnv();

  const chunkResponse = await callMiddleware(env, '/_next/static/chunks/580.ec199d0bfe52a281.js');
  const chunkText = await chunkResponse.response.text();

  // regression: předchozí šablona chunku chyběl zavírací brace (SyntaxError v prohlížeči)
  assert.doesNotThrow(() => new Script(chunkText), 'chunk musí být platný JavaScript');

  // chunk musí registrovat webpack chunk 580 s modulem 4580
  const sandbox = { webpackChunk_N_E: [] };
  new Function('self', chunkText)({ webpackChunk_N_E: sandbox.webpackChunk_N_E });
  const [chunkId, modules] = sandbox.webpackChunk_N_E[0];
  assert.deepEqual([...chunkId], [580]);
  assert.deepEqual(Object.keys(modules), ['4580']);
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
  for (const pathName of ['/', '/index.html', '/builder/', '/_next/static/css/05751101c3fd5530.css', '/admin/', '/admin/login/', '/dd-contact.js']) {
    const { response, nextCalled } = await callMiddleware(env, pathName);
    assert.equal(nextCalled, true, `expected next() for ${pathName}`);
    assert.equal(response.status, 200);
  }

  // neexistující API endpoint
  const missing = await callMiddleware(env, '/api/nic');
  assert.equal(missing.response.status, 404);
  assert.equal(missing.nextCalled, false);
});

test('login page is a static working form', async () => {
  const loginHtml = readFileSync(path.join(repoRoot, 'admin/login/index.html'), 'utf-8');
  assert.match(loginHtml, /<form id="login-form">/);
  assert.match(loginHtml, /fetch\('\/api\/login'/);
  assert.match(loginHtml, /localStorage\.setItem\('dd_admin_session'/);
  assert.match(loginHtml, /window\.location\.href = '\/admin'/);
  assert.match(loginHtml, /noindex/);
});

test('home page loads static contact script wired to API', async () => {
  const homeHtml = readFileSync(path.join(repoRoot, 'index.html'), 'utf-8');
  assert.match(homeHtml, /<script src="\/dd-contact\.js" defer><\/script>/);

  const contactJs = readFileSync(path.join(repoRoot, 'dd-contact.js'), 'utf-8');
  assert.match(contactJs, /\/api\/contact/);
  assert.match(contactJs, /#kontakt form/);
});

test('dynamic content chunk is not shipped as static file anymore', async () => {
  const chunksDir = path.join(repoRoot, '_next/static/chunks');
  const static580 = existsSync(path.join(chunksDir, '580.ec199d0bfe52a281.js')) ||
    existsSync(path.join(chunksDir, '580.625fedceaff0ff6e.js'));
  assert.equal(static580, false, 'chunk 580 must be generated dynamically from D1');
});
