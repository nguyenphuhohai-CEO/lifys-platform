import { createDatabase } from './db.js';
import { getConfig } from './config.js';

const config = getConfig();

const database = await createDatabase(config);
console.log(JSON.stringify({
  databaseFile: config.databaseFile,
  databaseProvider: config.databaseProvider,
  appliedMigrations: database.getMigrationState(),
}, null, 2));
await database.close?.();
