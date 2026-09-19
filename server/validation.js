import { createHttpError } from './http.js';

export function normalizeBody(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value;
}

export function readRequiredString(body, field, { maxLength = 200 } = {}) {
  const value = `${body[field] ?? ''}`.trim();
  if (!value) {
    throw createHttpError(400, `${field} est requis.`, 'VALIDATION_ERROR');
  }

  if (value.length > maxLength) {
    throw createHttpError(400, `${field} dépasse la longueur maximale autorisée.`, 'VALIDATION_ERROR');
  }

  return value;
}

export function readOptionalString(body, field, { maxLength = 2000 } = {}) {
  const value = `${body[field] ?? ''}`.trim();
  if (!value) {
    return '';
  }

  if (value.length > maxLength) {
    throw createHttpError(400, `${field} dépasse la longueur maximale autorisée.`, 'VALIDATION_ERROR');
  }

  return value;
}
