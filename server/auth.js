import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export function normalizeEmail(value) {
  return `${value ?? ''}`.trim().toLowerCase();
}

export function validateEmail(value) {
  const normalized = normalizeEmail(value);
  if (!normalized || normalized.includes(' ')) {
    return false;
  }

  const atIndex = normalized.indexOf('@');
  const lastAtIndex = normalized.lastIndexOf('@');
  const dotIndex = normalized.lastIndexOf('.');
  const localPart = normalized.slice(0, atIndex);
  const domainPart = normalized.slice(atIndex + 1);
  const domainLabels = domainPart.split('.');
  const localPartAllowed = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(localPart);

  return atIndex > 0
    && atIndex === lastAtIndex
    && localPartAllowed
    && !localPart.startsWith('.')
    && !localPart.endsWith('.')
    && !localPart.includes('..')
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
