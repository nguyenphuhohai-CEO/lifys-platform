import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const UPLOAD_URL_PREFIX = '/uploads/';

// Détecte le format réel d'après les premiers octets, sans se fier à l'en-tête Content-Type.
export function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

export function ownUploadPattern(userId) {
  return new RegExp(`^${UPLOAD_URL_PREFIX}${Number(userId)}-[a-f0-9]{32}\\.(jpg|png|webp)$`);
}

export function createUploadStore(directory) {
  fs.mkdirSync(directory, { recursive: true });

  return {
    directory,
    save(userId, buffer) {
      const type = detectImageType(buffer);
      if (!type) return null;
      const name = `${Number(userId)}-${crypto.randomBytes(16).toString('hex')}.${type}`;
      fs.writeFileSync(path.join(directory, name), buffer);
      return `${UPLOAD_URL_PREFIX}${name}`;
    },
    removeByUrl(url) {
      if (typeof url !== 'string' || !url.startsWith(UPLOAD_URL_PREFIX)) return;
      const name = path.basename(url);
      if (!/^\d+-[a-f0-9]{32}\.(jpg|png|webp)$/.test(name)) return;
      fs.rmSync(path.join(directory, name), { force: true });
    },
    removeAllForUser(userId, keepUrl = '') {
      const prefix = `${Number(userId)}-`;
      const keep = path.basename(keepUrl || '');
      for (const name of fs.readdirSync(directory)) {
        if (name.startsWith(prefix) && name !== keep) fs.rmSync(path.join(directory, name), { force: true });
      }
    },
  };
}
