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
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError('Réponse serveur invalide.', response.status, { code: 'INVALID_JSON_RESPONSE' });
    }
  }

  if (!response.ok) {
    throw new ApiError(data?.error || 'Une erreur serveur est survenue.', response.status, data);
  }

  return data;
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
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
  refreshSession() {
    return apiRequest('/api/auth/refresh', { method: 'POST' });
  },
  logout() {
    return apiRequest('/api/auth/logout', { method: 'POST' });
  },
  getSession(token) {
    return apiRequest('/api/auth/session', { token });
  },
  requestEmailVerification(token) {
    return apiRequest('/api/auth/verify-email/request', { method: 'POST', token });
  },
  confirmEmailVerification(tokenValue) {
    return apiRequest('/api/auth/verify-email/confirm', { method: 'POST', body: { token: tokenValue } });
  },
  requestPasswordReset(email) {
    return apiRequest('/api/auth/password-reset/request', { method: 'POST', body: { email } });
  },
  confirmPasswordReset(tokenValue, password) {
    return apiRequest('/api/auth/password-reset/confirm', {
      method: 'POST',
      body: { token: tokenValue, password },
    });
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
};
