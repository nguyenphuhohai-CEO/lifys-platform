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

  return atIndex > 0
    && atIndex === lastAtIndex
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
