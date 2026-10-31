import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';

import { createApp } from './app.js';
import { getConfig } from './config.js';
import { verifyStripeSignature } from './billing.js';

const WEBHOOK_SECRET = 'whsec_test';

async function startServer() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifys-billing-'));
  const config = getConfig({
    NODE_ENV: 'test',
    PORT: 0,
    DATABASE_FILE: path.join(tempDir, 'lifys.sqlite'),
    JWT_SECRET: 'test-secret',
    STATIC_DIR: path.join(tempDir, 'dist'),
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  });
  const { app, database } = createApp(config);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    database,
    async close() {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      database.db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

const json = async (response) => ({ status: response.status, body: await response.json() });

function sign(payload, secret = WEBHOOK_SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

test('free plan by default, premium after a signed checkout webhook, free again after cancellation', async () => {
  const server = await startServer();

  try {
    const plans = await json(await fetch(`${server.baseUrl}/api/billing/plans`));
    assert.deepEqual(plans.body.plans.map((plan) => [plan.id, plan.ads]), [['free', true], ['premium', false]]);
    assert.equal(plans.body.checkoutAvailable, false);

    const registered = await json(await fetch(`${server.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'pay@example.com', password: 'supersecret', name: 'Pay', acceptTerms: true }),
    }));
    assert.equal(registered.body.user.profile.plan, 'free');
    const auth = { authorization: `Bearer ${registered.body.token}`, 'content-type': 'application/json' };
    const userId = database(server).getUserByEmail('pay@example.com').id;

    const checkout = await json(await fetch(`${server.baseUrl}/api/billing/checkout`, { method: 'POST', headers: auth }));
    assert.equal(checkout.status, 503);

    const send = (event, headers = {}) => fetch(`${server.baseUrl}/api/billing/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(event),
    });

    const completed = { type: 'checkout.session.completed', data: { object: { client_reference_id: `${userId}`, customer: 'cus_1', subscription: 'sub_1' } } };
    assert.equal((await send(completed)).status, 400);
    assert.equal((await send(completed, { 'stripe-signature': sign(JSON.stringify(completed), 'wrong') })).status, 400);
    assert.equal((await send(completed, { 'stripe-signature': sign(JSON.stringify(completed)) })).status, 200);

    const premium = await json(await fetch(`${server.baseUrl}/api/auth/session`, { headers: auth }));
    assert.equal(premium.body.user.profile.plan, 'premium');

    const deleted = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', customer: 'cus_1' } } };
    assert.equal((await send(deleted, { 'stripe-signature': sign(JSON.stringify(deleted)) })).status, 200);
    const free = await json(await fetch(`${server.baseUrl}/api/auth/session`, { headers: auth }));
    assert.equal(free.body.user.profile.plan, 'free');
  } finally {
    await server.close();
  }
});

function database(server) {
  return server.database;
}

test('stripe signatures reject stale timestamps and tampered bodies', () => {
  const body = '{"a":1}';
  const now = Date.now();
  const ts = Math.floor(now / 1000);
  assert.equal(verifyStripeSignature(body, sign(body, WEBHOOK_SECRET, ts), WEBHOOK_SECRET, now), true);
  assert.equal(verifyStripeSignature('{"a":2}', sign(body, WEBHOOK_SECRET, ts), WEBHOOK_SECRET, now), false);
  assert.equal(verifyStripeSignature(body, sign(body, WEBHOOK_SECRET, ts - 4000), WEBHOOK_SECRET, now), false);
  assert.equal(verifyStripeSignature(body, undefined, WEBHOOK_SECRET, now), false);
});
