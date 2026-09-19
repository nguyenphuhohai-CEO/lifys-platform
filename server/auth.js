import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export function normalizeEmail(value) {
  return `${value ?? ''}`.trim().toLowerCase();
}

export function validateEmail(value) {
  const normalized = normalizeEmail(value);
  if (!normalized) {
    return false;
  }

  const atIndex = normalized.indexOf('@');
  const lastAtIndex = normalized.lastIndexOf('@');
  const dotIndex = normalized.lastIndexOf('.');
  const localPart = normalized.slice(0, atIndex);
  const domainPart = normalized.slice(atIndex + 1);
  const domainLabels = domainPart.split('.');
  const quotedContent = localPart.slice(1, -1);
  const quotedLocalPart = localPart.length >= 2
    && localPart.startsWith('"')
    && localPart.endsWith('"')
    && quotedContent.length > 0
    && !quotedContent.includes('"')
    && /^[\x20\x21\x23-\x5B\x5D-\x7E\\]+$/.test(quotedContent)
    && !quotedContent.endsWith('\\');
  const unquotedLocalPartAllowed = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(localPart);

  return atIndex > 0
    && atIndex === lastAtIndex
    && (quotedLocalPart || (
      unquotedLocalPartAllowed
      && !localPart.startsWith('.')
      && !localPart.endsWith('.')
      && !localPart.includes('..')
    ))
    && domainPart.length > 0
    && !domainPart.startsWith('.')
    && !domainPart.endsWith('.')
    && !domainPart.includes('..')
    && domainLabels.length >= 2
    && domainLabels.every((label) => Boolean(label) && /^[a-z0-9-]+$/i.test(label) && !label.startsWith('-') && !label.endsWith('-'))
    && dotIndex > atIndex + 1
    && dotIndex < normalized.length - 1;
}

export function validatePassword(value) {
  return typeof value === 'string' && value.length >= 8;
}

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function createToken(payload, config) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function verifyToken(token, config) {
  return jwt.verify(token, config.jwtSecret);
}
