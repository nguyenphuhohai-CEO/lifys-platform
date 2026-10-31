import { MODES } from '../data/demoData.js';

export function getCategoryPath(modeId) {
  const mode = MODES.find((item) => item.id === modeId);
  if (!mode) {
    return '/';
  }
  return `/${mode.label.replace(/\s+/g, '-')}`;
}

export function getModeFromPathname(pathname) {
  const segment = decodeURIComponent(String(pathname || '').split('/').filter(Boolean)[0] || '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

  return MODES.find((mode) => mode.id === segment || mode.id.replace(/-/g, '') === segment) ?? null;
}

export function getLegalPage(pathname) {
  const segment = String(pathname || '').split('/').filter(Boolean)[0]?.toLowerCase() ?? '';
  return ['cgu', 'confidentialite', 'mentions-legales'].includes(segment) ? segment : null;
}

export function getInfoPage(pathname) {
  const segment = String(pathname || '').split('/').filter(Boolean)[0]?.toLowerCase() ?? '';
  return ['a-propos', 'aide', 'securite', 'contact'].includes(segment) ? segment : null;
}

export function getModeFromSearch(search) {
  const value = new URLSearchParams(search || '').get('mode');
  return MODES.find((mode) => mode.id === value)?.id ?? null;
}

export function navigate(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}
