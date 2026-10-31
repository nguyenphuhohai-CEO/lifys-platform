const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

try {
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref && /^user-[0-9a-f-]{12}$/.test(ref)) localStorage.setItem('lifys-ref', ref);
} catch { /* stockage indisponible */ }

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

export const OAUTH_BASE_URL = API_BASE_URL;

export const api = {
  getAuthProviders() {
    return apiRequest('/api/auth/providers');
  },
  healthcheck() {
    return apiRequest('/api/health');
  },
  register(payload) {
    let ref;
    try { ref = localStorage.getItem('lifys-ref') || undefined; } catch { /* stockage indisponible */ }
    return apiRequest('/api/auth/register', { method: 'POST', body: { ...payload, ref } });
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
  getAdminReports(token) {
    return apiRequest('/api/admin/reports', { token });
  },
  resolveAdminReport(token, reportId, action) {
    return apiRequest(`/api/admin/reports/${reportId}/resolve`, { method: 'POST', token, body: { action } });
  },
  markConversationRead(token, conversationId) {
    return apiRequest(`/api/conversations/${conversationId}/read`, { method: 'POST', token });
  },
  getHub(token) {
    return apiRequest('/api/hub', { token });
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
  async uploadSelfie(token, file) {
    const response = await fetch(`${API_BASE_URL}/api/profile/selfie`, {
      method: 'POST',
      headers: { 'Content-Type': file.type, Authorization: 'Bearer ' + token },
      body: file,
    });
    return parseResponse(response);
  },
  boostProfile(token) {
    return apiRequest('/api/profile/boost', { method: 'POST', token });
  },
  getAdminSelfies(token) {
    return apiRequest('/api/admin/selfies', { token });
  },
  async getAdminSelfieImage(token, id) {
    const response = await fetch(`${API_BASE_URL}/api/admin/selfies/${encodeURIComponent(id)}/image`, {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!response.ok) throw new Error('Image indisponible.');
    return response.blob();
  },
  resolveAdminSelfie(token, id, approve) {
    return apiRequest(`/api/admin/selfies/${encodeURIComponent(id)}/resolve`, { method: 'POST', token, body: { approve } });
  },
  async addPhoto(token, file) {
    const response = await fetch(`${API_BASE_URL}/api/profile/photos`, {
      method: 'POST',
      headers: { 'Content-Type': file.type, Authorization: 'Bearer ' + token },
      body: file,
    });
    return parseResponse(response);
  },
  removePhoto(token, url) {
    return apiRequest('/api/profile/photos/remove', { method: 'POST', token, body: { url } });
  },
  setTonight(token, active) {
    return apiRequest('/api/tonight', { method: 'POST', token, body: { active } });
  },
  reportContent(token, payload) {
    return apiRequest('/api/reports', { method: 'POST', token, body: payload });
  },
  getDiscovery(token, filters) {
    const search = new URLSearchParams({
      mode: filters.activeMode ?? 'all',
      query: filters.query ?? '',
      city: filters.city ?? '',
    });
    for (const key of ['ageMin', 'ageMax', 'detail', 'minScore', 'maxKm']) {
      if (filters[key]) search.set(key, filters[key]);
    }
    if (filters.tonight) search.set('tonight', '1');
    return apiRequest(`/api/discovery?${search.toString()}`, { token });
  },
  likeProfile(token, profileId, options = {}) {
    return apiRequest('/api/interactions/like', { method: 'POST', token, body: { profileId, ...options } });
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
  sendSafetyAlert(token, body) {
    return apiRequest('/api/safety/alert', { method: 'POST', token, body });
  },
  getFamilyLink(token) {
    return apiRequest('/api/family/link', { token });
  },
  getAdminStats(token) {
    return apiRequest('/api/admin/stats', { token });
  },
  getReferral(token) {
    return apiRequest('/api/referral', { token });
  },
  getPushKey() {
    return apiRequest('/api/push/key');
  },
  pushSubscribe(token, subscription) {
    return apiRequest('/api/push/subscribe', { method: 'POST', token, body: subscription });
  },
  pushUnsubscribe(token, endpoint) {
    return apiRequest('/api/push/unsubscribe', { method: 'POST', token, body: { endpoint } });
  },
  getEvents(token) {
    return apiRequest('/api/events', { token });
  },
  createEvent(token, body) {
    return apiRequest('/api/events', { method: 'POST', token, body });
  },
  joinEvent(token, id) {
    return apiRequest(`/api/events/${id}/join`, { method: 'POST', token });
  },
  leaveEvent(token, id) {
    return apiRequest(`/api/events/${id}/leave`, { method: 'POST', token });
  },
  getPosts(token) {
    return apiRequest('/api/posts', { token });
  },
  createPost(token, body) {
    return apiRequest('/api/posts', { method: 'POST', token, body });
  },
  deletePost(token, id) {
    return apiRequest(`/api/posts/${id}`, { method: 'DELETE', token });
  },
  getLikesReceived(token) {
    return apiRequest('/api/likes/received', { token });
  },
  exportAccount(token) {
    return apiRequest('/api/account/export', { token });
  },
  deleteAccount(token, password) {
    return apiRequest('/api/account', { method: 'DELETE', token, body: { password } });
  },
};

