import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envFiles = [
  fileURLToPath(new URL('../.env', import.meta.url)),
  fileURLToPath(new URL('../.env.local', import.meta.url)),
];

if (typeof process.loadEnvFile === 'function') {
  for (const envFile of envFiles) {
    if (existsSync(envFile)) {
      process.loadEnvFile(envFile);
    }
  }
}
