import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';

import { createApp } from './app.js';
import { getConfig } from './config.js';
import { listBackups, runBackup } from './backup.js';
import { detectImageType } from './uploads.js';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);

async function startServer() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifys-upload-'));
  const config = getConfig({
    NODE_ENV: 'test',
    DATABASE_FILE: path.join(tempDir, 'lifys.sqlite'),
    JWT_SECRET: 'test-secret',
    STATIC_DIR: path.join(tempDir, 'dist'),
  });
  const { app, database } = createApp(config);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    database,
    config,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      database.db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

async function register(baseUrl, email) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'supersecret', name: 'Aya', acceptTerms: true }),
  });
  return (await response.json()).token;
}

const upload = (baseUrl, token, body, type = 'image/png') => fetch(`${baseUrl}/api/profile/photo`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': type },
  body,
});

const saveProfile = (baseUrl, token, avatar) => fetch(`${baseUrl}/api/profile`, {
  method: 'PUT',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'Aya', age: 28, city: 'Lyon', bio: 'Bonjour', interests: [], mode: 'amical', avatar }),
});

test('detectImageType reads magic bytes', () => {
  assert.equal(detectImageType(PNG), 'png');
  assert.equal(detectImageType(Buffer.from('<script>alert(1)</script>')), null);
});

test('photo upload: stored, served, attached to profile and removed on replace/delete', async () => {
  const server = await startServer();
  try {
    const token = await register(server.baseUrl, 'aya@example.com');

    const bad = await upload(server.baseUrl, token, Buffer.from('<html>not an image</html>'));
    assert.equal(bad.status, 415);
    const wrongType = await upload(server.baseUrl, token, PNG, 'text/html');
    assert.equal(wrongType.status, 415);
    const tooBig = await upload(server.baseUrl, token, Buffer.alloc(3 * 1024 * 1024 + 10, 1));
    assert.equal(tooBig.status, 413);
    const anonymous = await fetch(`${server.baseUrl}/api/profile/photo`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: PNG });
    assert.equal(anonymous.status, 401);

    const ok = await upload(server.baseUrl, token, PNG);
    assert.equal(ok.status, 201);
    const { url } = await ok.json();
    assert.match(url, /^\/uploads\/\d+-[a-f0-9]{32}\.png$/);

    const served = await fetch(`${server.baseUrl}${url}`);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), PNG);

    const saved = await saveProfile(server.baseUrl, token, url);
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).profile.avatar, url);

    const second = await (await upload(server.baseUrl, token, PNG)).json();
    await saveProfile(server.baseUrl, token, second.url);
    assert.equal((await fetch(`${server.baseUrl}${url}`)).status, 404);

    const otherToken = await register(server.baseUrl, 'bob@example.com');
    const hijack = await saveProfile(server.baseUrl, otherToken, second.url);
    assert.equal(hijack.status, 400);

    const del = await fetch(`${server.baseUrl}/api/account`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'supersecret' }),
    });
    assert.equal(del.status, 204);
    assert.equal((await fetch(`${server.baseUrl}${second.url}`)).status, 404);
  } finally {
    await server.close();
  }
});

test('runBackup creates a consistent copy and prunes old ones', async () => {
  const server = await startServer();
  try {
    const dir = path.join(path.dirname(server.config.databaseFile), 'backups');
    for (let i = 0; i < 4; i += 1) {
      await runBackup(server.database.db, { directory: dir, keep: 2, now: new Date(Date.UTC(2026, 0, 1 + i)) });
    }
    const files = listBackups(dir);
    assert.deepEqual(files, ['lifys-20260103-000000.sqlite', 'lifys-20260104-000000.sqlite']);
    assert.ok(fs.statSync(path.join(dir, files[1])).size > 0);
    assert.equal(fs.readdirSync(dir).some((name) => name.endsWith('.part')), false);
  } finally {
    await server.close();
  }
});
