import { createServer } from 'node:http';

import { createApp } from './app.js';
import { getConfig } from './config.js';
import { createLogger } from './logger.js';

const config = getConfig();
const logger = createLogger(config);
createApp(config)
  .then(({ app }) => {
    createServer(app).listen(config.port, () => {
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
