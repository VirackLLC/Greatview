const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'greatview-policies-'));
const database = path.join(directory, 'pg');
function run(command, args, input) {
  const result = spawnSync(command, args, { input, encoding: 'utf8', env: { ...process.env, PGHOST: directory, PGPORT: '55439', PGDATABASE: 'postgres', PGUSER: 'runner' } });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${command} failed: ${result.error?.message || result.status}`);
  return result;
}
let started = false;
try {
  run('initdb', ['-D', database, '-A', 'trust', '-U', 'runner', '--no-locale', '--encoding=UTF8']);
  run('pg_ctl', ['-D', database, '-l', path.join(directory, 'postgres.log'), '-o', `-k ${directory} -p 55439 -c listen_addresses=''`, '-w', 'start']);
  started = true;
  for (const file of ['tests/policy-fixture.sql', 'supabase/setup.sql']) run('psql', ['-v', 'ON_ERROR_STOP=1', '-f', file]);
  const seed = spawnSync(process.execPath, ['scripts/print-seed.mjs'], { encoding: 'utf8' });
  if (seed.status) throw new Error('Seed generation failed');
  run('psql', ['-v', 'ON_ERROR_STOP=1'], seed.stdout);
  run('psql', ['-v', 'ON_ERROR_STOP=1', '-f', 'tests/policies.sql']);
  console.log('Real PostgreSQL authorization and publishing checks passed. No external database was used.');
} finally {
  if (started) spawnSync('pg_ctl', ['-D', database, '-m', 'immediate', '-w', 'stop'], { stdio: 'inherit' });
  fs.rmSync(directory, { recursive: true, force: true });
}
