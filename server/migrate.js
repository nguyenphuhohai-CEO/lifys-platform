import { createDatabase } from './db.js';
import { getConfig } from './config.js';

const config = getConfig();
const database = createDatabase(config);

console.log(JSON.stringify({
  databaseFile: config.databaseFile,
  appliedMigrations: database.getMigrationState(),
}, null, 2));
