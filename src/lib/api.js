const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function parseResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(data?.error || 'Une erreur serveur est survenue.', response.status, data);
  }

  return data;
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return parseResponse(response);
}

export const api = {
  healthcheck() {
    return apiRequest('/api/health');
  },
  register(payload) {
    return apiRequest('/api/auth/register', { method: 'POST', body: payload });
  },
  login(payload) {
    return apiRequest('/api/auth/login', { method: 'POST', body: payload });
  },
  switchSite(token, site) {
    return apiRequest('/api/auth/switch-site', { method: 'POST', token, body: { site } });
  },
  getSession(token) {
    return apiRequest('/api/auth/session', { token });
  },
  getBootstrap(token) {
    return apiRequest('/api/bootstrap', { token });
  },
  getProfile(token) {
    return apiRequest('/api/profile', { token });
  },
  updateProfile(token, payload) {
    return apiRequest('/api/profile', { method: 'PUT', token, body: payload });
  },
  async uploadPhoto(token, file) {
    const response = await fetch(`${API_BASE_URL}/api/profile/photo`, {
      method: 'POST',
      headers: { 'Content-Type': file.type, Authorization: 'Bearer ' + token },
      body: file,
    });
    return parseResponse(response);
  },
  getDiscovery(token, filters) {
    const search = new URLSearchParams({
      mode: filters.activeMode ?? 'all',
      query: filters.query ?? '',
      city: filters.city ?? '',
    });
    return apiRequest(`/api/discovery?${search.toString()}`, { token });
  },
  likeProfile(token, profileId) {
    return apiRequest('/api/interactions/like', { method: 'POST', token, body: { profileId } });
  },
  passProfile(token, profileId) {
    return apiRequest('/api/interactions/pass', { method: 'POST', token, body: { profileId } });
  },
  getMatches(token) {
    return apiRequest('/api/matches', { token });
  },
  getConversations(token) {
    return apiRequest('/api/conversations', { token });
  },
  sendMessage(token, conversationId, text) {
    return apiRequest(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      token,
      body: { text },
    });
  },
  resetPrototype(token) {
    return apiRequest('/api/prototype/reset', { method: 'POST', token });
  },
  verifyEmail(verificationToken) {
    return apiRequest('/api/auth/verify-email', { method: 'POST', body: { token: verificationToken } });
  },
  resendVerification(token, lang) {
    return apiRequest('/api/auth/resend-verification', { method: 'POST', token, body: { lang } });
  },
  getPlans() {
    return apiRequest('/api/billing/plans');
  },
  startCheckout(token) {
    return apiRequest('/api/billing/checkout', { method: 'POST', token });
  },
  openBillingPortal(token) {
    return apiRequest('/api/billing/portal', { method: 'POST', token });
  },
  reportProfile(token, payload) {
    return apiRequest('/api/reports', { method: 'POST', token, body: payload });
  },
  blockProfile(token, profileId) {
    return apiRequest('/api/blocks', { method: 'POST', token, body: { profileId } });
  },
  exportAccount(token) {
    return apiRequest('/api/account/export', { token });
  },
  deleteAccount(token, password) {
    return apiRequest('/api/account', { method: 'DELETE', token, body: { password } });
  },
};

