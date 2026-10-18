import assert from 'node:assert/strict';
import test from 'node:test';

import { createRateLimiter } from './rate-limit.js';

function run(limiter, ip) {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; },
  };
  let passed = false;
  limiter({ ip }, res, () => { passed = true; });
  return { res, passed };
}

test('rate limiter blocks after the maximum and isolates clients', () => {
  const limiter = createRateLimiter({ windowMs: 60000, max: 2, message: 'stop' });

  assert.equal(run(limiter, '1.1.1.1').passed, true);
  assert.equal(run(limiter, '1.1.1.1').passed, true);

  const blocked = run(limiter, '1.1.1.1');
  assert.equal(blocked.passed, false);
  assert.equal(blocked.res.statusCode, 429);
  assert.equal(blocked.res.body.error, 'stop');
  assert.ok(Number(blocked.res.headers['Retry-After']) > 0);

  assert.equal(run(limiter, '2.2.2.2').passed, true);
});
