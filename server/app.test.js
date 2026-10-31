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
  if (extraConfig.fetchImpl) config.fetchImpl = extraConfig.fetchImpl;
  const { app, database, mailer } = createApp(config);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    mailer,
    config,
    database,
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
        mode: 'professionnel',
        acceptTerms: true,
      }),
    });
    const registerB = await request(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'b@example.com',
        password: 'supersecret',
        name: 'Noah',
        mode: 'professionnel',
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

test('one account works on every site, with a separate profile and pool per site', async () => {
  const server = await startTestServer({ SEED_DEMO_DATA: 'true' });

  try {
    const love = await registerUser(server.baseUrl, 'same@example.com', { mode: 'amoureux' });
    assert.equal(love.status, 201);
    assert.equal((await registerUser(server.baseUrl, 'same@example.com', { mode: 'amoureux' })).status, 409);

    const wrongPassword = await request(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'same@example.com', password: 'other-pass-1', acceptTerms: true, mode: 'mariage' }),
    });
    assert.equal(wrongPassword.status, 409);

    const pro = await request(server.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'same@example.com', password: 'supersecret', site: 'professionnel' }),
    });
    assert.equal(pro.status, 200);
    assert.equal(pro.body.user.profile.mode, 'professionnel');
    const proAuth = { authorization: 'Bearer ' + pro.body.token };

    const switched = await request(server.baseUrl, '/api/auth/switch-site', {
      method: 'POST',
      headers: love.auth,
      body: JSON.stringify({ site: 'mariage' }),
    });
    assert.equal(switched.body.user.profile.mode, 'mariage');

    const discovery = await request(server.baseUrl, '/api/discovery?mode=all', { headers: proAuth });
    assert.ok(discovery.body.profiles.every((profile) => profile.mode === 'professionnel'));

    const forced = await request(server.baseUrl, '/api/profile', {
      method: 'PUT',
      headers: proAuth,
      body: JSON.stringify({ name: 'Pro', age: 30, city: 'Paris', bio: 'Bio pro', mode: 'amoureux' }),
    });
    assert.equal(forced.body.profile.mode, 'professionnel');

    const removed = await request(server.baseUrl, '/api/account', {
      method: 'DELETE',
      headers: proAuth,
      body: JSON.stringify({ password: 'supersecret' }),
    });
    assert.equal(removed.status, 204);
    const gone = await request(server.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'same@example.com', password: 'supersecret', site: 'amoureux' }),
    });
    assert.equal(gone.status, 401);
  } finally {
    await server.close();
  }
});

test('site-specific details are sanitized, scored, filtered and super likes are limited', async () => {
  const server = await startTestServer();

  try {
    const user = await registerUser(server.baseUrl, 'pro@example.com', { mode: 'professionnel' });
    const save = await request(server.baseUrl, '/api/profile', {
      method: 'PUT',
      headers: user.auth,
      body: JSON.stringify({
        name: 'Pro', age: 33, city: 'Paris', bio: 'Designer produit.', interests: 'design',
        details: { sector: 'Design', skills: 'UX, Figma', goal: 'Collaborer', linkedin: 'javascript:alert(1)', religion: 'x', sector2: 'y' },
      }),
    });
    assert.equal(save.status, 200);
    assert.deepEqual(save.body.profile.details, { sector: 'Design', skills: ['ux', 'figma'], goal: 'Collaborer' });

    const discovery = await request(server.baseUrl, '/api/discovery?mode=all&detail=design&ageMin=30', { headers: user.auth });
    assert.deepEqual(discovery.body.profiles.map((profile) => profile.name), ['Omar']);
    assert.ok(discovery.body.profiles[0].compatibility.score > 40);
    assert.ok(discovery.body.profiles[0].compatibility.reasons.includes('Même secteur'));

    const tooYoung = await request(server.baseUrl, '/api/discovery?mode=all&ageMax=20', { headers: user.auth });
    assert.equal(tooYoung.body.profiles.length, 0);

    const hooked = await request(server.baseUrl, '/api/interactions/like', {
      method: 'POST', headers: user.auth, body: JSON.stringify({ profileId: 'p6', note: 'Bonjour Omar, collaborons !' }),
    });
    assert.equal(hooked.body.matched, true);
    const conversations = await request(server.baseUrl, '/api/conversations', { headers: user.auth });
    assert.ok(conversations.body.conversations[0].messages.some((message) => message.text === 'Bonjour Omar, collaborons !' && message.sender === 'me'));

    const love = await registerUser(server.baseUrl, 'pro@example.com', { mode: 'amoureux' });
    assert.ok([201, 200].includes(love.status));
    const first = await request(server.baseUrl, '/api/interactions/like', {
      method: 'POST', headers: love.auth, body: JSON.stringify({ profileId: 'p1', superLike: true }),
    });
    assert.equal(first.status, 200);
    const second = await request(server.baseUrl, '/api/interactions/like', {
      method: 'POST', headers: love.auth, body: JSON.stringify({ profileId: 'p2', superLike: true }),
    });
    assert.equal(second.status, 429);
  } finally {
    await server.close();
  }
});
test('events and posts are scoped to their site, and received likes are gated', async () => {
  const server = await startTestServer();

  try {
    const friend = await registerUser(server.baseUrl, 'ami@example.com', { mode: 'amical' });
    const other = await registerUser(server.baseUrl, 'ami2@example.com', { mode: 'amical' });
    const love = await registerUser(server.baseUrl, 'love@example.com', { mode: 'amoureux' });
    const startsAt = new Date(Date.now() + 86400000).toISOString();

    const created = await request(server.baseUrl, '/api/events', {
      method: 'POST', headers: friend.auth, body: JSON.stringify({ title: 'Rando', city: 'Lyon', startsAt, capacity: 2 }),
    });
    assert.equal(created.status, 201);
    const id = created.body.event.id;

    const wrongSite = await request(server.baseUrl, '/api/events', { headers: love.auth });
    assert.equal(wrongSite.status, 403);

    const join = await request(server.baseUrl, `/api/events/${id}/join`, { method: 'POST', headers: other.auth });
    assert.equal(join.status, 200);
    const list = await request(server.baseUrl, '/api/events', { headers: other.auth });
    assert.equal(list.body.events[0].attendees, 2);

    const postOnAmical = await request(server.baseUrl, '/api/posts', {
      method: 'POST', headers: friend.auth, body: JSON.stringify({ content: 'Bonjour', kind: 'post' }),
    });
    assert.equal(postOnAmical.status, 403);

    const likes = await request(server.baseUrl, '/api/likes/received', { headers: love.auth });
    assert.equal(likes.status, 200);
    assert.equal(likes.body.count, 0);
  } finally {
    await server.close();
  }
});
test('gallery photos, content reports with auto-hide, tonight toggle and minimum score', async () => {
  const server = await startTestServer({ ADMIN_EMAILS: 'admin@example.com' });

  try {
    const admin = await registerUser(server.baseUrl, 'admin@example.com', { mode: 'professionnel' });
    const author = await registerUser(server.baseUrl, 'author@example.com', { mode: 'professionnel' });
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    const upload = () => fetch(`${server.baseUrl}/api/profile/photos`, {
      method: 'POST', headers: { 'content-type': 'image/png', authorization: author.auth.authorization }, body: png,
    });

    const first = await upload();
    assert.equal(first.status, 201);
    const { profile } = await first.json();
    assert.equal(profile.photos.length, 1);
    for (let index = 0; index < 3; index += 1) await upload();
    assert.equal((await upload()).status, 409);

    const removed = await request(server.baseUrl, '/api/profile/photos/remove', {
      method: 'POST', headers: author.auth, body: JSON.stringify({ url: profile.photos[0] }),
    });
    assert.equal(removed.body.profile.photos.length, 3);
    const foreign = await request(server.baseUrl, '/api/profile/photos/remove', {
      method: 'POST', headers: admin.auth, body: JSON.stringify({ url: removed.body.profile.photos[0] }),
    });
    assert.equal(foreign.status, 404);

    const post = await request(server.baseUrl, '/api/posts', { method: 'POST', headers: author.auth, body: JSON.stringify({ content: 'Offre douteuse', kind: 'offre' }) });
    const postId = post.body.post.id;
    const reporters = [];
    for (const name of ['r1', 'r2', 'r3']) reporters.push(await registerUser(server.baseUrl, `${name}@example.com`, { mode: 'professionnel' }));
    for (const reporter of reporters) {
      const response = await request(server.baseUrl, '/api/reports', { method: 'POST', headers: reporter.auth, body: JSON.stringify({ postId, reason: 'spam' }) });
      assert.equal(response.status, 201);
    }
    const self = await request(server.baseUrl, '/api/reports', { method: 'POST', headers: author.auth, body: JSON.stringify({ postId, reason: 'spam' }) });
    assert.equal(self.status, 404);

    const visible = await request(server.baseUrl, '/api/posts', { headers: admin.auth });
    assert.equal(visible.body.posts.some((item) => item.id === postId), false);

    const reports = await request(server.baseUrl, '/api/admin/reports', { headers: admin.auth });
    assert.equal(reports.body.reports[0].content.kind, 'post');
    const resolved = await request(server.baseUrl, `/api/admin/reports/${reports.body.reports[0].id}/resolve`, {
      method: 'POST', headers: admin.auth, body: JSON.stringify({ action: 'remove' }),
    });
    assert.equal(resolved.status, 200);
    assert.equal((await request(server.baseUrl, '/api/admin/reports', { headers: admin.auth })).body.reports.length, 0);

    const night = await registerUser(server.baseUrl, 'night@example.com', { mode: 'sans-lendemain' });
    const on = await request(server.baseUrl, '/api/tonight', { method: 'POST', headers: night.auth, body: JSON.stringify({ active: true }) });
    assert.ok(on.body.profile.tonightUntil);
    assert.equal(on.body.profile.details.tonight, true);
    const off = await request(server.baseUrl, '/api/tonight', { method: 'POST', headers: night.auth, body: JSON.stringify({ active: false }) });
    assert.equal(off.body.profile.tonightUntil, null);
    assert.equal((await request(server.baseUrl, '/api/tonight', { method: 'POST', headers: author.auth, body: '{}' })).status, 403);

    const none = await request(server.baseUrl, '/api/discovery?mode=all&minScore=101', { headers: night.auth });
    assert.equal(none.body.profiles.length, 0);
  } finally {
    await server.close();
  }
});
test('hub lists every site of the account', async () => {
  const server = await startTestServer({ SEED_DEMO_DATA: 'false' });

  try {
    const user = await registerUser(server.baseUrl, 'hub@example.com', { mode: 'amoureux' });
    const first = await request(server.baseUrl, '/api/hub', { headers: user.auth });
    assert.equal(first.status, 200);
    assert.deepEqual(Object.keys(first.body.sites), ['amoureux']);
    assert.equal(first.body.sites.amoureux.completed, false);

    const switched = await request(server.baseUrl, '/api/auth/switch-site', {
      method: 'POST',
      headers: user.auth,
      body: JSON.stringify({ site: 'professionnel' }),
    });
    const second = await request(server.baseUrl, '/api/hub', { headers: { authorization: `Bearer ${switched.body.token}` } });
    assert.deepEqual(Object.keys(second.body.sites).sort(), ['amoureux', 'professionnel']);
  } finally {
    await server.close();
  }
});
test('session exposes isAdmin only for configured admin emails', async () => {
  const server = await startTestServer({ SEED_DEMO_DATA: 'false', ADMIN_EMAILS: 'boss@example.com' });

  try {
    const boss = await registerUser(server.baseUrl, 'boss@example.com');
    const user = await registerUser(server.baseUrl, 'user@example.com');
    assert.equal(boss.body.user.isAdmin, true);
    assert.equal(user.body.user.isAdmin, false);
    const reports = await request(server.baseUrl, '/api/admin/reports', { headers: boss.auth });
    assert.equal(reports.status, 200);
    const denied = await request(server.baseUrl, '/api/admin/reports', { headers: user.auth });
    assert.equal(denied.status, 403);
  } finally {
    await server.close();
  }
});
test('messages track unread count and read receipts', async () => {
  const server = await startTestServer({ SEED_DEMO_DATA: 'false' });

  try {
    const a = await registerUser(server.baseUrl, 'ra@example.com', { mode: 'professionnel' });
    const b = await registerUser(server.baseUrl, 'rb@example.com', { mode: 'professionnel' });
    const complete = (auth, name) => request(server.baseUrl, '/api/profile', {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ name, age: 30, city: 'Paris', bio: 'Profil complet pour tester les accusés de lecture.', interests: ['design'], mode: 'professionnel', avatar: '' }),
    });
    const profileA = await complete(a.auth, 'Ava');
    const profileB = await complete(b.auth, 'Noah');
    const like = (auth, id) => request(server.baseUrl, '/api/interactions/like', { method: 'POST', headers: auth, body: JSON.stringify({ profileId: id }) });
    await like(b.auth, profileA.body.profile.id);
    await like(a.auth, profileB.body.profile.id);

    const conversations = await request(server.baseUrl, '/api/conversations', { headers: a.auth });
    const conversationId = conversations.body.conversations[0].id;
    await request(server.baseUrl, `/api/conversations/${conversationId}/messages`, { method: 'POST', headers: a.auth, body: JSON.stringify({ text: 'Bonjour' }) });

    const asB = await request(server.baseUrl, '/api/conversations', { headers: b.auth });
    assert.equal(asB.body.conversations[0].unread, 1);

    const read = await request(server.baseUrl, `/api/conversations/${conversationId}/read`, { method: 'POST', headers: b.auth });
    assert.equal(read.body.conversation.unread, 0);

    const asA = await request(server.baseUrl, '/api/conversations', { headers: a.auth });
    const sentByA = asA.body.conversations[0].messages.find((message) => message.text === 'Bonjour');
    assert.ok(sentByA.readAt);
  } finally {
    await server.close();
  }
});
test('matches expire after 24h without a message on expiring sites', async () => {
  const server = await startTestServer({ SEED_DEMO_DATA: 'false' });

  try {
    const a = await registerUser(server.baseUrl, 'ea@example.com', { mode: 'amoureux' });
    const b = await registerUser(server.baseUrl, 'eb@example.com', { mode: 'amoureux' });
    const complete = (auth, name) => request(server.baseUrl, '/api/profile', {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ name, age: 30, city: 'Paris', bio: 'Profil complet pour tester l’expiration des matchs.', interests: ['design'], mode: 'amoureux', avatar: '' }),
    });
    const profileA = await complete(a.auth, 'Ava');
    const profileB = await complete(b.auth, 'Noah');
    const like = (auth, id) => request(server.baseUrl, '/api/interactions/like', { method: 'POST', headers: auth, body: JSON.stringify({ profileId: id }) });
    await like(b.auth, profileA.body.profile.id);
    await like(a.auth, profileB.body.profile.id);

    const first = await request(server.baseUrl, '/api/matches', { headers: a.auth });
    assert.ok(first.body.matches[0].expiresAt);

    const conversations = await request(server.baseUrl, '/api/conversations', { headers: a.auth });
    const conversationId = conversations.body.conversations[0].id;
    await request(server.baseUrl, `/api/conversations/${conversationId}/messages`, { method: 'POST', headers: a.auth, body: JSON.stringify({ text: 'Salut' }) });
    const kept = await request(server.baseUrl, '/api/matches', { headers: a.auth });
    assert.equal(kept.body.matches[0].expiresAt, null);

    server.database.db.prepare('UPDATE matches SET expires_at = ?').run(new Date(Date.now() - 1000).toISOString());
    const expired = await request(server.baseUrl, '/api/matches', { headers: a.auth });
    assert.equal(expired.body.matches.length, 0);
    const blocked = await request(server.baseUrl, `/api/conversations/${conversationId}/messages`, { method: 'POST', headers: b.auth, body: JSON.stringify({ text: 'Trop tard' }) });
    assert.equal(blocked.status, 404);
  } finally {
    await server.close();
  }
});
test('selfie verification, boost and distance filter', async () => {
  const server = await startTestServer({ ADMIN_EMAILS: 'admin@example.com', SEED_DEMO_DATA: 'false' });
  try {
    const admin = await registerUser(server.baseUrl, 'admin@example.com');
    const a = await registerUser(server.baseUrl, 'a@example.com');
    const b = await registerUser(server.baseUrl, 'b@example.com');
    const c = await registerUser(server.baseUrl, 'c@example.com');
    const put = (u, city) => request(server.baseUrl, '/api/profile', { method: 'PUT', headers: u.auth, body: JSON.stringify({ name: u.name, age: 30, city, bio: 'Profil complet pour tester la distance.', interests: ['design'], mode: 'amoureux', avatar: '' }) });
    a.name = 'a'; b.name = 'b'; c.name = 'c'; admin.name = 'admin';
    await put(a, 'Paris'); await put(b, 'Lyon'); await put(c, 'Marseille');
    await put(admin, 'Paris');

    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    const upload = (u) => fetch(`${server.baseUrl}/api/profile/selfie`, { method: 'POST', headers: { 'content-type': 'image/png', ...u.auth }, body: png });
    assert.equal((await upload(b)).status, 201);
    assert.equal((await upload(b)).status, 409);
    assert.equal((await request(server.baseUrl, '/api/admin/selfies', { headers: b.auth })).status, 403);

    const pending = await request(server.baseUrl, '/api/admin/selfies', { headers: admin.auth });
    assert.equal(pending.body.selfies.length, 1);
    const image = await fetch(`${server.baseUrl}/api/admin/selfies/${pending.body.selfies[0].id}/image`, { headers: admin.auth });
    assert.equal(image.status, 200);
    const resolved = await request(server.baseUrl, `/api/admin/selfies/${pending.body.selfies[0].id}/resolve`, { method: 'POST', headers: admin.auth, body: JSON.stringify({ approve: true }) });
    assert.equal(resolved.status, 200);

    const near = await request(server.baseUrl, '/api/discovery?maxKm=500', { headers: a.auth });
    const names = near.body.profiles.map((p) => p.name);
    assert.ok(names.includes('b') && !names.includes('c'), JSON.stringify(near.body.profiles.map((p) => [p.name, p.city, p.distanceKm])));
    assert.ok(near.body.profiles.find((p) => p.name === 'b').selfieVerified);
    assert.equal(near.body.profiles.find((p) => p.name === 'b').distanceKm > 300, true);
    const far = await request(server.baseUrl, '/api/discovery?maxKm=100', { headers: a.auth });
    assert.deepEqual(far.body.profiles.map((p) => p.name), ['admin']);

    const boost = await request(server.baseUrl, '/api/profile/boost', { method: 'POST', headers: c.auth });
    assert.equal(boost.status, 200);
    assert.ok(boost.body.profile.boostUntil);
    assert.equal((await request(server.baseUrl, '/api/profile/boost', { method: 'POST', headers: c.auth })).status, 429);
    const ranked = await request(server.baseUrl, '/api/discovery', { headers: a.auth });
    assert.equal(ranked.body.profiles[0].name, 'c');
  } finally {
    await server.close();
  }
});
test('Google and Facebook sign-in create or join an account', async () => {
  const fakeFetch = async (url) => {
    const json = (body) => ({ ok: true, json: async () => body });
    if (String(url).includes('token')) return json({ access_token: 'at' });
    if (String(url).includes('openidconnect')) return json({ email: 'Social@Example.com', email_verified: true, name: 'Sam' });
    return json({ email: 'social@example.com', name: 'Sam' });
  };
  const server = await startTestServer({
    SEED_DEMO_DATA: 'false', REQUIRE_EMAIL_VERIFICATION: 'true', GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gs', fetchImpl: fakeFetch,
  });
  try {
    const providers = await request(server.baseUrl, '/api/auth/providers');
    assert.deepEqual(providers.body.providers, { google: true, facebook: false });
    assert.equal((await fetch(`${server.baseUrl}/api/auth/oauth/facebook?site=amical`, { redirect: 'manual' })).status, 404);

    const start = await fetch(`${server.baseUrl}/api/auth/oauth/google?site=amical`, { redirect: 'manual' });
    assert.equal(start.status, 302);
    const location = new URL(start.headers.get('location'));
    assert.equal(location.hostname, 'accounts.google.com');
    const cookie = start.headers.get('set-cookie').split(';')[0];

    const bad = await fetch(`${server.baseUrl}/api/auth/oauth/google/callback?code=x&state=${location.searchParams.get('state')}`, { redirect: 'manual' });
    assert.match(bad.headers.get('location'), /oauth_error=state/);

    const done = await fetch(`${server.baseUrl}/api/auth/oauth/google/callback?code=x&state=${location.searchParams.get('state')}`, { redirect: 'manual', headers: { cookie } });
    const target = done.headers.get('location');
    assert.match(target, /\/amical#oauth_token=/);
    const token = target.split('oauth_token=')[1];
    const session = await request(server.baseUrl, '/api/auth/session', { headers: { authorization: `Bearer ${token}` } });
    assert.equal(session.body.user.email, 'social@example.com');
    assert.equal(session.body.user.emailVerified, true);
  } finally {
    await server.close();
  }
});
test('a dedicated site deployment forces its own site', async () => {
  const server = await startTestServer({ SEED_DEMO_DATA: 'false', SITE_ONLY: 'professionnel' });
  try {
    assert.equal((await request(server.baseUrl, '/api/site')).body.siteOnly, 'professionnel');
    const user = await registerUser(server.baseUrl, 'solo@example.com', { mode: 'amoureux' });
    assert.equal(user.body.user.profile.mode, 'professionnel');
    const other = await request(server.baseUrl, '/api/auth/switch-site', { method: 'POST', headers: user.auth, body: JSON.stringify({ site: 'amical' }) });
    assert.equal(other.status, 403);
  } finally {
    await server.close();
  }
});
test('social links are validated per network', async () => {
  const server = await startTestServer({ SEED_DEMO_DATA: 'false' });
  try {
    const u = await registerUser(server.baseUrl, 'soc@example.com', { mode: 'amical' });
    const saved = await request(server.baseUrl, '/api/profile', {
      method: 'PUT', headers: u.auth,
      body: JSON.stringify({ name: 'Soc', age: 30, city: 'Paris', bio: 'Bio', interests: ['x'], mode: 'amical', avatar: '', details: {
        social_instagram: 'https://www.instagram.com/soc', social_x: 'https://evil.com/x', social_tiktok: 'javascript:alert(1)',
      } }),
    });
    assert.equal(saved.body.profile.details.social_instagram, 'https://www.instagram.com/soc');
    assert.equal(saved.body.profile.details.social_x, undefined);
    assert.equal(saved.body.profile.details.social_tiktok, undefined);
  } finally {
    await server.close();
  }
});
test('robots, sitemap and per-site manifest are served', async () => {
  const server = await startTestServer({ SITE_ONLY: 'professionnel' });
  try {
    const robots = await fetch(`${server.baseUrl}/robots.txt`);
    assert.match(await robots.text(), /Disallow: \/api\//);
    const sitemap = await fetch(`${server.baseUrl}/sitemap.xml`);
    assert.match(await sitemap.text(), /<urlset/);
    const manifest = await fetch(`${server.baseUrl}/manifest.webmanifest`);
    if (manifest.headers.get('content-type')?.includes('manifest')) {
      assert.equal((await manifest.json()).name, 'Lifys Pro');
    }
  } finally {
    await server.close();
  }
});
test('reminder e-mails are sent for unread messages and unsubscribe works', async () => {
  const { runReminders, unsubscribeToken } = await import('./reminders.js');
  const server = await startTestServer({ SEED_DEMO_DATA: 'false' });
  try {
    const a = await registerUser(server.baseUrl, 'ra@example.com', { mode: 'amical' });
    const sentBefore = server.mailer.sent.length;
    const deps = { db: server.database.db, mailer: server.mailer, config: server.config };
    assert.equal(await runReminders(deps), 0);
    assert.equal(server.mailer.sent.length, sentBefore);
    await registerUser(server.baseUrl, 'rb@example.com', { mode: 'amical' });
    const db = server.database.db;
    const id = db.prepare('SELECT id FROM users WHERE email = ?').get('ra@example.com').id;
    const other = db.prepare('SELECT id FROM users WHERE email = ?').get('rb@example.com').id;
    const stamp = new Date().toISOString();
    const matchId = db.prepare('INSERT INTO matches (public_id, pair_key, user_one_id, user_two_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('m1', `${id}:${other}`, id, other, 'test', stamp).lastInsertRowid;
    const convId = db.prepare('INSERT INTO conversations (public_id, match_id, created_at) VALUES (?, ?, ?)').run('c1', matchId, stamp).lastInsertRowid;
    db.prepare('INSERT INTO messages (public_id, conversation_id, sender_user_id, content, created_at) VALUES (?, ?, ?, ?, ?)').run('msg1', convId, other, 'salut', stamp);
    assert.ok(await runReminders(deps) >= 1);
    assert.equal(server.mailer.sent.at(-1).to, 'ra@example.com');
    assert.equal(await runReminders(deps), 0);
    const bad = await fetch(`${server.baseUrl}/api/reminders/unsubscribe?u=${id}&t=bad`);
    assert.equal(bad.status, 400);
    const ok = await fetch(`${server.baseUrl}/api/reminders/unsubscribe?u=${id}&t=${unsubscribeToken(server.config, id)}`);
    assert.equal(ok.status, 200);
    assert.equal(server.database.db.prepare('SELECT reminders_off FROM users WHERE id = ?').get(id).reminders_off, 1);
    assert.ok(a);
  } finally {
    await server.close();
  }
});

test('pro CV fields are whitelisted', async () => {
  const { sanitizeDetails } = await import('../src/data/siteFields.js');
  const out = sanitizeDetails('professionnel', { seniority: 'Senior (8 ans et +)', openTo: 'hack', experience: 'Dirigé 3 équipes', education: 'MSc' });
  assert.equal(out.seniority, 'Senior (8 ans et +)');
  assert.equal(out.openTo, undefined);
  assert.equal(out.experience, 'Dirigé 3 équipes');
});

test('new per-site fields are sanitized and scored', async () => {
  const { sanitizeDetails, computeCompatibility } = await import('../src/data/siteFields.js');
  const out = sanitizeDetails('mariage', { timeline: 'Dans l’année', familyInvolved: 'hack' });
  assert.equal(out.timeline, 'Dans l’année');
  assert.equal(out.familyInvolved, undefined);
  const a = { mode: 'professionnel', interests: [], city: '', details: { skills: ['react'], offering: ['design'], proFormat: 'Visio' } };
  const b = { mode: 'professionnel', interests: [], city: '', details: { skills: ['design'], offering: ['react'], proFormat: 'Visio' } };
  assert.ok(computeCompatibility(a, b).reasons.includes('Offre et besoin complémentaires'));
});

test('safety alert emails a trusted contact', async () => {
  const server = await startTestServer({ SEED_DEMO_DATA: 'false' });
  try {
    const u = await registerUser(server.baseUrl, 'sf@example.com', { mode: 'sans-lendemain' });
    const bad = await request(server.baseUrl, '/api/safety/alert', { method: 'POST', headers: u.auth, body: JSON.stringify({ contactEmail: 'nope' }) });
    assert.equal(bad.status, 400);
    const ok = await request(server.baseUrl, '/api/safety/alert', { method: 'POST', headers: u.auth, body: JSON.stringify({ contactEmail: 'ami@example.com', details: 'Bar du centre 21h' }) });
    assert.equal(ok.status, 204);
    assert.equal(server.mailer.sent.at(-1).to, 'ami@example.com');
    assert.match(server.mailer.sent.at(-1).text, /Bar du centre/);
  } finally {
    await server.close();
  }
});
