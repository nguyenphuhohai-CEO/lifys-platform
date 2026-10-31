import crypto from 'node:crypto';

const STATE_TTL_MS = 10 * 60 * 1000;
export const OAUTH_COOKIE = 'lifys_oauth';

const PROVIDERS = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
  },
  facebook: {
    authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    profileUrl: 'https://graph.facebook.com/v19.0/me?fields=id,name,email',
    scope: 'email,public_profile',
  },
};

const b64 = (value) => Buffer.from(value).toString('base64url');

export function createOAuth(config) {
  const settings = config.oauth ?? {};
  const sign = (payload) => crypto.createHmac('sha256', config.jwtSecret).update(payload).digest('base64url');

  const isEnabled = (name) => Boolean(PROVIDERS[name] && settings[name]?.clientId && settings[name]?.clientSecret);
  const redirectUri = (name) => `${config.appUrl}/api/auth/oauth/${name}/callback`;

  function createState(provider, site) {
    const nonce = crypto.randomBytes(16).toString('hex');
    const payload = b64(JSON.stringify({ provider, site, nonce, exp: Date.now() + STATE_TTL_MS }));
    return { nonce, state: `${payload}.${sign(payload)}` };
  }

  function readState(state, provider, cookieNonce) {
    const [payload, signature] = `${state ?? ''}`.split('.');
    if (!payload || !signature) return null;
    const expected = Buffer.from(sign(payload));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (data.provider !== provider || data.exp < Date.now() || !cookieNonce || data.nonce !== cookieNonce) return null;
      return data;
    } catch {
      return null;
    }
  }

  function authorizeUrl(name, state) {
    const params = new URLSearchParams({
      client_id: settings[name].clientId,
      redirect_uri: redirectUri(name),
      response_type: 'code',
      scope: PROVIDERS[name].scope,
      state,
    });
    return `${PROVIDERS[name].authorizeUrl}?${params.toString()}`;
  }

  async function fetchIdentity(name, code, fetchImpl = fetch) {
    const provider = PROVIDERS[name];
    const tokenResponse = await fetchImpl(provider.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: settings[name].clientId,
        client_secret: settings[name].clientSecret,
        redirect_uri: redirectUri(name),
        grant_type: 'authorization_code',
      }).toString(),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) throw new Error('token_exchange_failed');

    const profileResponse = await fetchImpl(provider.profileUrl, { headers: { authorization: `Bearer ${tokens.access_token}` } });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.email) throw new Error('email_missing');
    if (name === 'google' && profile.email_verified !== true) throw new Error('email_unverified');

    return { email: `${profile.email}`.trim().toLowerCase(), name: `${profile.name ?? profile.given_name ?? ''}`.trim() };
  }

  return { isEnabled, createState, readState, authorizeUrl, fetchIdentity, providers: () => Object.fromEntries(Object.keys(PROVIDERS).map((name) => [name, isEnabled(name)])) };
}

export function readCookie(req, name) {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}
