import { copyFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const envExamplePath = path.join(projectRoot, '.env.example');
const envPath = path.join(projectRoot, '.env');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

if (!existsSync(envPath) && existsSync(envExamplePath)) {
  copyFileSync(envExamplePath, envPath);
  console.log('[lifys] Fichier .env créé depuis .env.example');
}

const children = [];
let shuttingDown = false;

function startProcess(name, args) {
  const child = spawn(npmCommand, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (code === 0 || signal === 'SIGTERM' || signal === 'SIGINT') {
      shutdown(code ?? 0);
      return;
    }

    console.error(`[lifys] ${name} s'est arrêté (${signal ?? `code ${code}`}).`);
    shutdown(code ?? 1);
  });

  children.push(child);
  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 150);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

startProcess('backend', ['run', 'dev:server']);
startProcess('frontend', ['run', 'dev', '--', '--host']);
