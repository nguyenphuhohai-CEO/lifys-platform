import { createServer } from 'node:http';

import { createApp } from './app.js';
import { getConfig } from './config.js';

const config = getConfig();
const { app } = createApp(config);

createServer(app).listen(config.port, () => {
  console.log(`Lifys server listening on http://0.0.0.0:${config.port}`);
});
