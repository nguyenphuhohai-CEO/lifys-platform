import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';

import { createApp } from './app.js';
import { getConfig } from './config.js';

async function startTestServer() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifys-server-'));
  const config = getConfig({
    NODE_ENV: 'test',
    PORT: 0,
    DATABASE_FILE: path.join(tempDir, 'lifys.sqlite'),
    JWT_SECRET: 'test-secret',
    STATIC_DIR: path.join(tempDir, 'dist'),
  });
  const { app } = createApp(config);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

async function request(baseUrl, pathName, options = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

test('register, update profile, like demo profile and send message', async () => {
  const server = await startTestServer();

  try {
    const register = await request(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'aya@example.com',
        password: 'supersecret',
        name: 'Aya',
      }),
    });

    assert.equal(register.status, 201);
    const token = register.body.token;
    assert.ok(token);

    const authorization = { authorization: 'Bearer ' + token };

    const profileUpdate = await request(server.baseUrl, '/api/profile', {
      method: 'PUT',
      headers: authorization,
      body: JSON.stringify({
        name: 'Aya',
        age: 29,
        city: 'Lyon',
        bio: 'Créative, chaleureuse et prête à rencontrer les bonnes personnes.',
        interests: ['musique', 'cuisine'],
        mode: 'amoureux',
        avatar: 'https://example.com/avatar.jpg',
      }),
    });

    assert.equal(profileUpdate.status, 200);
    assert.equal(profileUpdate.body.profile.city, 'Lyon');

    const discovery = await request(server.baseUrl, '/api/discovery?mode=amoureux', {
      headers: authorization,
    });

    assert.equal(discovery.status, 200);
    assert.ok(discovery.body.profiles.some((profile) => profile.id === 'p2'));

    const like = await request(server.baseUrl, '/api/interactions/like', {
      method: 'POST',
      headers: authorization,
      body: JSON.stringify({ profileId: 'p2' }),
    });

    assert.equal(like.status, 200);
    assert.equal(like.body.matched, true);

    const conversations = await request(server.baseUrl, '/api/conversations', {
      headers: authorization,
    });

    assert.equal(conversations.status, 200);
    assert.ok(conversations.body.conversations.length >= 1);

    const conversationId = conversations.body.conversations[0].id;
    const sendMessage = await request(server.baseUrl, `/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: authorization,
      body: JSON.stringify({ text: 'Bonjour Lucas !' }),
    });

    assert.equal(sendMessage.status, 201);
    assert.equal(sendMessage.body.conversation.messages.at(-1).text, 'Bonjour Lucas !');
  } finally {
    await server.close();
  }
});
