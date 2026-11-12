import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';

// Local development only: never prints credentials or contacts a hosted project.
const destination = resolve(process.argv[2] || '/private/tmp/vibe-log-local-supabase.json');
const stdout = execFileSync(resolve('node_modules/.bin/supabase'), ['status', '--output', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env,
});
const status = JSON.parse(stdout);
const file = await open(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o600);
try {
  await file.chmod(0o600);
  await file.writeFile(JSON.stringify(status, null, 2) + '\n');
} finally {
  await file.close();
}
console.log(JSON.stringify({ path: destination, fields: Object.keys(status) }));
