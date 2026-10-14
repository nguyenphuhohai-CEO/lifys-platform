import { createServer } from 'node:http';

import { createApp } from './app.js';
import { getConfig } from './config.js';
import { createLogger } from './logger.js';

const config = getConfig();
const logger = createLogger(config);

let shuttingDown = false;
let activeServer = null;
let activeDatabase = null;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  logger.info('Shutdown requested', { signal });

  try {
    if (activeServer) {
      await new Promise((resolve, reject) => {
        activeServer.close((error) => (error ? reject(error) : resolve()));
      });
    }

    await activeDatabase?.close?.();
    logger.info('Shutdown completed', { signal });
    process.exit(0);
  } catch (error) {
    logger.error('Shutdown failed', {
      signal,
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

createApp(config)
  .then(({ app, database }) => {
    activeDatabase = database;
    activeServer = createServer(app);
    activeServer.listen(config.port, () => {
      logger.info('Lifys server listening', {
        port: config.port,
        databaseProvider: config.databaseProvider,
        emailDeliveryMode: config.emailDeliveryMode,
        demoDiscoveryEnabled: config.demoDiscoveryEnabled,
      });
    });
  })
  .catch((error) => {
    logger.error('Failed to start Lifys server', {
      message: error.message,
      stack: error.stack,
    });
    process.exitCode = 1;
  });
