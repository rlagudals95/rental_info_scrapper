import fs from 'node:fs';
import path from 'node:path';

let hasLoadedEnv = false;

export function loadEnv(): void {
  if (hasLoadedEnv) {
    return;
  }

  hasLoadedEnv = true;

  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  process.loadEnvFile(envPath);
}
