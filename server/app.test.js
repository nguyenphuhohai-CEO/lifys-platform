import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';

import { createApp } from './app.js';
import { getConfig } from './config.js';

async function startTestServer(extraConfig = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifys-server-'));
  const config = getConfig({
    NODE_ENV: 'test',
    PORT: 0,
    DATABASE_FILE: path.join(tempDir, 'lifys.sqlite'),
    JWT_SECRET: 'test-secret',
    STATIC_DIR: path.join(tempDir, 'dist'),
    ...extraConfig,
  });
  const { app, database, mailer } = createApp(config);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    mailer,
    async close() {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      database.db.close();
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
        acceptTerms: true,
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

test('discovery hides private identifiers and reset keeps real-user matches intact', async () => {
  const server = await startTestServer();

  try {
    const registerA = await request(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'a@example.com',
        password: 'supersecret',
        name: 'Ava',
        acceptTerms: true,
      }),
    });
    const registerB = await request(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'b@example.com',
        password: 'supersecret',
        name: 'Noah',
        acceptTerms: true,
      }),
    });

    const authA = { authorization: 'Bearer ' + registerA.body.token };
    const authB = { authorization: 'Bearer ' + registerB.body.token };

    await request(server.baseUrl, '/api/profile', {
      method: 'PUT',
      headers: authA,
      body: JSON.stringify({
        name: 'Ava',
        age: 30,
        city: 'Paris',
        bio: 'Profil complet pour valider la persistance et la sécurité du MVP.',
        interests: ['design'],
        mode: 'professionnel',
        avatar: '',
      }),
    });
    const profileB = await request(server.baseUrl, '/api/profile', {
      method: 'PUT',
      headers: authB,
      body: JSON.stringify({
        name: 'Noah',
        age: 31,
        city: 'Paris',
        bio: 'Second profil complet pour vérifier les matchs entre comptes réels.',
        interests: ['design'],
        mode: 'professionnel',
        avatar: '',
      }),
    });

    const discoveryA = await request(server.baseUrl, '/api/discovery?mode=professionnel', {
      headers: authA,
    });

    const discoveredRealProfile = discoveryA.body.profiles.find((profile) => profile.name === 'Noah');
    assert.ok(discoveredRealProfile);
    assert.equal('email' in discoveredRealProfile, false);
    assert.equal('userId' in discoveredRealProfile, false);
    assert.equal('userPublicId' in discoveredRealProfile, false);

    const profileA = await request(server.baseUrl, '/api/profile', { headers: authA });
    await request(server.baseUrl, '/api/interactions/like', {
      method: 'POST',
      headers: authB,
      body: JSON.stringify({ profileId: profileA.body.profile.id }),
    });
    await request(server.baseUrl, '/api/interactions/like', {
      method: 'POST',
      headers: authA,
      body: JSON.stringify({ profileId: profileB.body.profile.id }),
    });

    const matchesBeforeReset = await request(server.baseUrl, '/api/matches', { headers: authA });
    assert.equal(matchesBeforeReset.body.matches.length, 1);

    await request(server.baseUrl, '/api/prototype/reset', {
      method: 'POST',
      headers: authA,
    });

    const matchesAfterReset = await request(server.baseUrl, '/api/matches', { headers: authA });
    assert.equal(matchesAfterReset.body.matches.length, 1);
  } finally {
    await server.close();
  }
});

test('login with missing password returns 401 instead of leaking an internal error', async () => {
  const server = await startTestServer();

  try {
    await request(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'login-check@example.com',
        password: 'supersecret',
        name: 'Login Check',
        acceptTerms: true,
      }),
    });

    const response = await request(server.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'login-check@example.com',
      }),
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.error, 'Identifiants invalides.');
  } finally {
    await server.close();
  }
});

async function registerUser(baseUrl, email, extra = {}) {
  const response = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'supersecret', name: email.split('@')[0], acceptTerms: true, ...extra }),
  });
  return { ...response, auth: { authorization: `Bearer ${response.body?.token}` } };
}

test('registration requires accepting the terms', async () => {
  const server = await startTestServer();

  try {
    const response = await registerUser(server.baseUrl, 'noterms@example.com', { acceptTerms: false });
    assert.equal(response.status, 400);
  } finally {
    await server.close();
  }
});

test('email verification gates discovery until the link is used', async () => {
  const server = await startTestServer({ REQUIRE_EMAIL_VERIFICATION: 'true', SEED_DEMO_DATA: 'false' });

  try {
    const user = await registerUser(server.baseUrl, 'verify@example.com');
    assert.equal(user.body.user.emailVerified, false);

    const blocked = await request(server.baseUrl, '/api/discovery', { headers: user.auth });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, 'email_not_verified');

    const token = server.mailer.sent.at(-1).text.match(/token=([a-f0-9]+)/)[1];
    const bad = await request(server.baseUrl, '/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: 'nope' }) });
    assert.equal(bad.status, 400);

    const ok = await request(server.baseUrl, '/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
    assert.equal(ok.status, 200);

    const allowed = await request(server.baseUrl, '/api/discovery', { headers: user.auth });
    assert.equal(allowed.status, 200);
  } finally {
    await server.close();
  }
});

test('block, report and admin suspension', async () => {
  const server = await startTestServer({ ADMIN_EMAILS: 'admin@example.com', SEED_DEMO_DATA: 'false' });

  try {
    const admin = await registerUser(server.baseUrl, 'admin@example.com');
    const a = await registerUser(server.baseUrl, 'a@example.com');
    const b = await registerUser(server.baseUrl, 'b@example.com');
    const profileB = (await request(server.baseUrl, '/api/profile', { headers: b.auth })).body.profile;

    const forbidden = await request(server.baseUrl, '/api/admin/reports', { headers: a.auth });
    assert.equal(forbidden.status, 403);

    const report = await request(server.baseUrl, '/api/reports', {
      method: 'POST',
      headers: a.auth,
      body: JSON.stringify({ profileId: profileB.id, reason: 'spam' }),
    });
    assert.equal(report.status, 201);

    const reports = await request(server.baseUrl, '/api/admin/reports', { headers: admin.auth });
    assert.equal(reports.body.reports.length, 1);

    const resolved = await request(server.baseUrl, `/api/admin/reports/${reports.body.reports[0].id}/resolve`, {
      method: 'POST',
      headers: admin.auth,
      body: JSON.stringify({ action: 'suspend' }),
    });
    assert.equal(resolved.status, 200);

    const suspended = await request(server.baseUrl, '/api/auth/session', { headers: b.auth });
    assert.equal(suspended.status, 403);
    const login = await request(server.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'b@example.com', password: 'supersecret' }),
    });
    assert.equal(login.status, 403);
  } finally {
    await server.close();
  }
});

test('blocked profiles disappear and accounts can be exported and deleted', async () => {
  const server = await startTestServer({ SEED_DEMO_DATA: 'false' });

  try {
    const a = await registerUser(server.baseUrl, 'a@example.com');
    const b = await registerUser(server.baseUrl, 'b@example.com');
    const profileB = (await request(server.baseUrl, '/api/profile', { headers: b.auth })).body.profile;

    const before = await request(server.baseUrl, '/api/discovery', { headers: a.auth });
    assert.ok(before.body.profiles.some((profile) => profile.id === profileB.id));

    await request(server.baseUrl, '/api/blocks', { method: 'POST', headers: a.auth, body: JSON.stringify({ profileId: profileB.id }) });
    const after = await request(server.baseUrl, '/api/discovery', { headers: a.auth });
    assert.equal(after.body.profiles.some((profile) => profile.id === profileB.id), false);

    const exported = await request(server.baseUrl, '/api/account/export', { headers: a.auth });
    assert.equal(exported.body.account.email, 'a@example.com');

    const wrong = await request(server.baseUrl, '/api/account', { method: 'DELETE', headers: a.auth, body: JSON.stringify({ password: 'bad' }) });
    assert.equal(wrong.status, 401);
    const deleted = await request(server.baseUrl, '/api/account', { method: 'DELETE', headers: a.auth, body: JSON.stringify({ password: 'supersecret' }) });
    assert.equal(deleted.status, 204);
    const gone = await request(server.baseUrl, '/api/auth/session', { headers: a.auth });
    assert.equal(gone.status, 401);
  } finally {
    await server.close();
  }
});
