import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve(new URL('./migrations', import.meta.url).pathname);

function listMigrationFiles() {
  return fs.readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(db.prepare('SELECT name FROM schema_migrations ORDER BY name ASC').all().map((row) => row.name));
  const markApplied = db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)');
  const migrationFiles = listMigrationFiles();
  const newlyApplied = [];

  for (const fileName of migrationFiles) {
    if (applied.has(fileName)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, fileName), 'utf8');
    db.exec(sql);
    markApplied.run(fileName, new Date().toISOString());
    newlyApplied.push(fileName);
  }

  return {
    appliedMigrations: db.prepare('SELECT name, applied_at FROM schema_migrations ORDER BY name ASC').all(),
    newlyApplied,
    latestMigration: migrationFiles.at(-1) ?? null,
  };
}
