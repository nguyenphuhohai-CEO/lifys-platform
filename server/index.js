import { createServer } from 'node:http';

import { createApp } from './app.js';
import { getConfig } from './config.js';

const config = getConfig();
const { app, database, mailer } = createApp(config);

mailer.verify().then(
  (configured) => console.log(configured ? 'SMTP: connexion OK' : 'SMTP: non configuré (e-mails affichés dans la console)'),
  (error) => console.error('SMTP: connexion impossible —', error.message),
);

const server = createServer(app).listen(config.port, () => {
  console.log(`Lifys server listening on http://0.0.0.0:${config.port}`);
});

function shutdown() {
  server.close(() => {
    database.db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
