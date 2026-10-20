import fs from 'node:fs';
import path from 'node:path';

const BACKUP_PATTERN = /^lifys-\d{8}-\d{6}\.sqlite$/;

function stamp(date) {
  const p = (n) => `${n}`.padStart(2, '0');
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}-${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`;
}

export function listBackups(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((name) => BACKUP_PATTERN.test(name)).sort();
}

// Copie à chaud (API de sauvegarde SQLite : cohérente même pendant les écritures), puis purge des plus anciennes.
export async function runBackup(db, { directory, keep = 14, now = new Date() }) {
  fs.mkdirSync(directory, { recursive: true });
  const name = `lifys-${stamp(now)}.sqlite`;
  const target = path.join(directory, name);
  const partial = `${target}.part`;

  try {
    await db.backup(partial);
    fs.renameSync(partial, target);
  } catch (error) {
    fs.rmSync(partial, { force: true });
    throw error;
  }

  const backups = listBackups(directory);
  for (const old of backups.slice(0, Math.max(0, backups.length - keep))) {
    fs.rmSync(path.join(directory, old), { force: true });
  }

  return target;
}

export function startBackupSchedule(db, { directory, keep, intervalHours, log = console }) {
  if (!intervalHours || intervalHours <= 0) return { stop() {} };

  const intervalMs = intervalHours * 60 * 60 * 1000;
  const run = () => runBackup(db, { directory, keep })
    .then((file) => log.log(`Sauvegarde créée : ${file}`))
    .catch((error) => log.error('Sauvegarde échouée :', error.message));

  const latest = listBackups(directory).at(-1);
  const latestTime = latest ? fs.statSync(path.join(directory, latest)).mtimeMs : 0;
  const firstDelay = Math.max(10_000, latestTime + intervalMs - Date.now());

  let timer = setTimeout(function tick() {
    run();
    timer = setTimeout(tick, intervalMs);
    timer.unref();
  }, Math.min(firstDelay, intervalMs));
  timer.unref();

  return { stop: () => clearTimeout(timer) };
}
