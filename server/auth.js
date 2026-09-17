import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value) {
  return `${value ?? ''}`.trim().toLowerCase();
}

export function validateEmail(value) {
  return EMAIL_RE.test(normalizeEmail(value));
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
