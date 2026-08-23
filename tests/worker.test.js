import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import { DEFAULT_CONTENT } from '../src/default-content.js';

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
    if (sql.includes('DELETE FROM admin_sessions WHERE expires_at <= CURRENT_TIMESTAMP')) {
      const now = Date.now();
      for (const [key, value] of this.sessions.entries()) {
        if (new Date(value.expires_at).getTime() <= now) this.sessions.delete(key);
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
    const bytes = body instanceof ReadableStream ? await new Response(body).arrayBuffer() : await body.arrayBuffer();
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

class MockAssets {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/index.html' || url.pathname === '/') {
      return new Response('<!doctype html><html><head></head><body><section id="kontakt"><form><button type="submit">Odeslat</button></form></section></body></html>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } });
  }
}

function createEnv() {
  return {
    DB: new MockDB(),
    MEDIA: new MockR2(),
    ASSETS: new MockAssets(),
  };
}

test('admin login returns token', async () => {
  const env = createEnv();
  const response = await worker.fetch(
    new Request('https://example.com/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'honza2555', password: 'AsD123+--+321DsA' }),
    }),
    env,
  );

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.ok(data.token.length > 20);
});

test('content update requires authorization', async () => {
  const env = createEnv();
  const response = await worker.fetch(
    new Request('https://example.com/api/content', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(DEFAULT_CONTENT),
    }),
    env,
  );

  assert.equal(response.status, 401);
});

test('authorized content update changes generated chunk', async () => {
  const env = createEnv();
  const loginResponse = await worker.fetch(
    new Request('https://example.com/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'honza2555', password: 'AsD123+--+321DsA' }),
    }),
    env,
  );
  const { token } = await loginResponse.json();

  const updated = {
    ...DEFAULT_CONTENT,
    heroContent: {
      ...DEFAULT_CONTENT.heroContent,
      title: 'NOVÝ TITULEK',
    },
  };

  const saveResponse = await worker.fetch(
    new Request('https://example.com/api/content', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updated),
    }),
    env,
  );

  assert.equal(saveResponse.status, 200);

  const chunkResponse = await worker.fetch(
    new Request('https://example.com/_next/static/chunks/580.ec199d0bfe52a281.js'),
    env,
  );
  const chunkText = await chunkResponse.text();

  assert.equal(chunkResponse.status, 200);
  assert.match(chunkText, /NOVÝ TITULEK/);
});

test('contact form stores message in D1', async () => {
  const env = createEnv();
  const contactResponse = await worker.fetch(
    new Request('https://example.com/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Jan Test',
        email: 'jan@example.com',
        phone: '+420123456789',
        message: 'Dobrý den, mám zájem o byt.',
      }),
    }),
    env,
  );

  assert.equal(contactResponse.status, 200);
  assert.equal(env.DB.messages.length, 1);
  assert.equal(env.DB.messages[0].name, 'Jan Test');
});

test('public html gets injected SEO and contact script', async () => {
  const env = createEnv();
  const response = await worker.fetch(new Request('https://example.com/'), env);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /canonical/);
  assert.match(html, /\/api\/contact/);
});

test('authorized upload stores image in R2 and serves it back', async () => {
  const env = createEnv();
  const loginResponse = await worker.fetch(
    new Request('https://example.com/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'honza2555', password: 'AsD123+--+321DsA' }),
    }),
    env,
  );
  const { token } = await loginResponse.json();

  const formData = new FormData();
  formData.set('directory', 'gallery/aktualni');
  formData.set('file', new File([new Uint8Array([137, 80, 78, 71])], 'test.png', { type: 'image/png' }));

  const uploadResponse = await worker.fetch(
    new Request('https://example.com/api/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: formData,
    }),
    env,
  );

  assert.equal(uploadResponse.status, 200);
  const upload = await uploadResponse.json();
  assert.match(upload.path, /^\/media\//);

  const mediaResponse = await worker.fetch(new Request(`https://example.com${upload.path}`), env);
  assert.equal(mediaResponse.status, 200);
  assert.equal(mediaResponse.headers.get('content-type'), 'image/png');
});
