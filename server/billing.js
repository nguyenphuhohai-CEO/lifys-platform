import crypto from 'node:crypto';

const STRIPE_API = 'https://api.stripe.com/v1';
const SIGNATURE_TOLERANCE_S = 300;

export function getPlans(config) {
  return [
    { id: 'free', priceCents: 0, currency: config.billing.currency, interval: null, ads: true },
    { id: 'premium', priceCents: config.billing.premiumPriceCents, currency: config.billing.currency, interval: 'month', ads: false },
  ];
}

export function verifyStripeSignature(rawBody, header, secret, now = Date.now()) {
  if (!secret || typeof header !== 'string') {
    return false;
  }

  const parts = Object.fromEntries(header.split(',').map((item) => item.split('=')));
  const timestamp = Number(parts.t);
  if (!parts.v1 || !Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > SIGNATURE_TOLERANCE_S) {
    return false;
  }

  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  const received = Buffer.from(parts.v1, 'hex');
  const wanted = Buffer.from(expected, 'hex');
  return received.length === wanted.length && crypto.timingSafeEqual(received, wanted);
}

async function stripeRequest(config, pathName, params) {
  const response = await fetch(`${STRIPE_API}${pathName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.billing.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'Stripe request failed');
  }
  return data;
}

export async function createCheckoutSession(config, { userId, email, customerId }) {
  const params = {
    mode: 'subscription',
    'line_items[0][price]': config.billing.premiumPriceId,
    'line_items[0][quantity]': '1',
    client_reference_id: `${userId}`,
    success_url: `${config.appUrl}/?billing=success`,
    cancel_url: `${config.appUrl}/?billing=cancel`,
  };
  if (customerId) {
    params.customer = customerId;
  } else {
    params.customer_email = email;
  }
  const session = await stripeRequest(config, '/checkout/sessions', params);
  return session.url;
}

export async function createPortalSession(config, customerId) {
  const session = await stripeRequest(config, '/billing_portal/sessions', {
    customer: customerId,
    return_url: `${config.appUrl}/`,
  });
  return session.url;
}

// Applique un événement Stripe vérifié ; retourne true si un compte a été mis à jour.
export function applyStripeEvent(database, event) {
  const object = event?.data?.object ?? {};

  if (event.type === 'checkout.session.completed') {
    const userId = Number(object.client_reference_id);
    return Number.isInteger(userId) && database.setUserPlan({
      userId,
      customerId: object.customer,
      subscriptionId: object.subscription,
      plan: 'premium',
      planUntil: null,
    });
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const active = event.type === 'customer.subscription.updated' && ['active', 'trialing', 'past_due'].includes(object.status);
    const periodEnd = object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : null;
    return database.setUserPlan({
      customerId: object.customer,
      subscriptionId: object.id,
      plan: active ? 'premium' : 'free',
      planUntil: active ? periodEnd : null,
    });
  }

  return false;
}
