import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';

import { createApp } from './app.js';
import { getConfig } from './config.js';

async function startTestServer(overrides = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifys-server-'));
  const config = getConfig({
    NODE_ENV: 'test',
    PORT: 0,
    DATABASE_FILE: path.join(tempDir, 'lifys.sqlite'),
    JWT_SECRET: 'test-secret',
    STATIC_DIR: path.join(tempDir, 'dist'),
    ...overrides,
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
    headers: response.headers,
  };
}

function getCookieHeader(response) {
  const setCookie = response.headers.get('set-cookie');
  return setCookie ? setCookie.split(';')[0] : '';
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

test('discovery hides private identifiers and reset keeps real-user matches intact', async () => {
  const server = await startTestServer();

  try {
    const registerA = await request(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'a@example.com',
        password: 'supersecret',
        name: 'Ava',
      }),
    });
    const registerB = await request(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'b@example.com',
        password: 'supersecret',
        name: 'Noah',
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

test('refresh cookie restores session and logout revokes it', async () => {
  const server = await startTestServer();

  try {
    const register = await request(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'cookie@example.com',
        password: 'supersecret',
        name: 'Cookie User',
      }),
    });
    const refreshCookie = getCookieHeader(register);

    assert.ok(refreshCookie.includes('lifys_refresh_token='));
    assert.equal(register.body.user.emailVerified, false);

    const refreshed = await request(server.baseUrl, '/api/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: refreshCookie,
      },
    });
    const rotatedCookie = getCookieHeader(refreshed);

    assert.equal(refreshed.status, 200);
    assert.ok(refreshed.body.token);
    assert.notEqual(rotatedCookie, refreshCookie);

    const logout = await fetch(`${server.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: rotatedCookie,
      },
    });

    assert.equal(logout.status, 204);

    const refreshAfterLogout = await request(server.baseUrl, '/api/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: rotatedCookie,
      },
    });
    assert.equal(refreshAfterLogout.status, 401);
    assert.equal(refreshAfterLogout.body.code, 'REFRESH_TOKEN_INVALID');
  } finally {
    await server.close();
  }
});

test('email verification request and confirm update the session user', async () => {
  const server = await startTestServer();

  try {
    const register = await request(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'verify@example.com',
        password: 'supersecret',
        name: 'Verify User',
      }),
    });
    const auth = { authorization: 'Bearer ' + register.body.token };

    assert.ok(register.body.previewEmailVerificationToken);

    const requestVerification = await request(server.baseUrl, '/api/auth/verify-email/request', {
      method: 'POST',
      headers: auth,
    });
    assert.equal(requestVerification.status, 200);
    assert.ok(requestVerification.body.previewToken);

    const confirmVerification = await request(server.baseUrl, '/api/auth/verify-email/confirm', {
      method: 'POST',
      body: JSON.stringify({
        token: requestVerification.body.previewToken,
      }),
    });
    assert.equal(confirmVerification.status, 200);
    assert.equal(confirmVerification.body.user.emailVerified, true);
  } finally {
    await server.close();
  }
});

test('password reset request and confirm issue a new session', async () => {
  const server = await startTestServer();

  try {
    await request(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'reset@example.com',
        password: 'supersecret',
        name: 'Reset User',
      }),
    });

    const requestReset = await request(server.baseUrl, '/api/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({
        email: 'reset@example.com',
      }),
    });

    assert.equal(requestReset.status, 200);
    assert.ok(requestReset.body.previewToken);

    const confirmReset = await request(server.baseUrl, '/api/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({
        token: requestReset.body.previewToken,
        password: 'newsupersecret',
      }),
    });

    assert.equal(confirmReset.status, 200);
    assert.ok(confirmReset.body.token);

    const login = await request(server.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'reset@example.com',
        password: 'newsupersecret',
      }),
    });
    assert.equal(login.status, 200);
  } finally {
    await server.close();
  }
});

test('register rejects malformed email structures', async () => {
  const server = await startTestServer();

  try {
    const response = await request(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@.example.com',
        password: 'supersecret',
        name: 'Malformed Email',
      }),
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'INVALID_EMAIL');
  } finally {
    await server.close();
  }
});

test('register accepts common tagged emails', async () => {
  const server = await startTestServer();

  try {
    const response = await request(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user+tag@example.com',
        password: 'supersecret',
        name: 'Tagged Email',
      }),
    });

    assert.equal(response.status, 201);
    assert.ok(response.body.token);
  } finally {
    await server.close();
  }
});

test('invalid session token returns a clean 401 payload', async () => {
  const server = await startTestServer();

  try {
    const response = await request(server.baseUrl, '/api/auth/session', {
      headers: {
        authorization: '******',
      },
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.error, 'Session expirée ou invalide.');
    assert.equal(response.body.code, 'SESSION_INVALID');
  } finally {
    await server.close();
  }
});

test('invalid JSON body returns 400 with a stable API error', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: '{"email": "broken@example.com"',
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, 'Corps JSON invalide.');
    assert.equal(body.code, 'INVALID_JSON');
  } finally {
    await server.close();
  }
});

test('auth rate limiting returns 429 after repeated login attempts', async () => {
  const server = await startTestServer({
    RATE_LIMIT_WINDOW_MS: 60_000,
    AUTH_RATE_LIMIT_MAX: 3,
  });

  try {
    await request(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'limit@example.com',
        password: 'supersecret',
        name: 'Limit Test',
      }),
    });

    const firstAttempt = await request(server.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'limit@example.com',
        password: 'wrong-password',
      }),
    });
    const secondAttempt = await request(server.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'limit@example.com',
        password: 'wrong-password',
      }),
    });
    const thirdResponse = await fetch(`${server.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'limit@example.com',
        password: 'wrong-password',
      }),
    });
    const thirdAttempt = await thirdResponse.json();

    assert.equal(firstAttempt.status, 401);
    assert.equal(secondAttempt.status, 401);
    assert.equal(thirdResponse.status, 429);
    assert.equal(thirdAttempt.code, 'RATE_LIMITED');
    assert.equal(thirdResponse.headers.get('retry-after'), '60');
  } finally {
    await server.close();
  }
});

test('write rate limiting throttles repeated authenticated profile updates', async () => {
  const server = await startTestServer({
    RATE_LIMIT_WINDOW_MS: 60_000,
    WRITE_RATE_LIMIT_MAX: 2,
  });

  try {
    const register = await request(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'writer@example.com',
        password: 'supersecret',
        name: 'Writer',
      }),
    });
    const auth = { authorization: 'Bearer ' + register.body.token };
    const payload = {
      name: 'Writer',
      age: 29,
      city: 'Paris',
      bio: 'Profil complet utilisé pour vérifier le rate limit d’écriture.',
      interests: ['produit'],
      mode: 'professionnel',
      avatar: '',
    };

    const firstUpdate = await request(server.baseUrl, '/api/profile', {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify(payload),
    });
    const secondUpdate = await request(server.baseUrl, '/api/profile', {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ ...payload, city: 'Lyon' }),
    });
    const thirdResponse = await fetch(`${server.baseUrl}/api/profile`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...auth,
      },
      body: JSON.stringify({ ...payload, city: 'Marseille' }),
    });
    const thirdUpdate = await thirdResponse.json();

    assert.equal(firstUpdate.status, 200);
    assert.equal(secondUpdate.status, 200);
    assert.equal(thirdResponse.status, 429);
    assert.equal(thirdUpdate.code, 'RATE_LIMITED');
  } finally {
    await server.close();
  }
});

test('CORS preflight rejects unknown origins and allows the configured one', async () => {
  const server = await startTestServer({
    CORS_ORIGIN: 'http://localhost:5173',
  });

  try {
    const deniedResponse = await fetch(`${server.baseUrl}/api/health`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://malicious.example',
      },
    });
    const deniedBody = await deniedResponse.json();

    assert.equal(deniedResponse.status, 403);
    assert.equal(deniedBody.code, 'CORS_ORIGIN_DENIED');

    const allowedResponse = await fetch(`${server.baseUrl}/api/health`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
      },
    });

    assert.equal(allowedResponse.status, 204);
    assert.equal(allowedResponse.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  } finally {
    await server.close();
  }
});

test('config rejects invalid numeric rate limit values', () => {
  assert.throws(
    () => getConfig({ RATE_LIMIT_WINDOW_MS: 'abc' }),
    /RATE_LIMIT_WINDOW_MS must be a positive number\./,
  );
});
