/**
 * Copies the EXPO_PUBLIC_* values from your local .env into an EAS environment, so cloud builds
 * (which never see your gitignored .env) get Firebase, Google sign-in, AI and Cloudinary config.
 *
 *   node scripts/eas-env.cjs preview            # set them for `eas build --profile preview`
 *   node scripts/eas-env.cjs production
 *   node scripts/eas-env.cjs preview --dry-run  # just print what would be set
 *
 * EXPO_PUBLIC_* values are compiled into the app, so they are public by nature; they're stored
 * as "plaintext" (EAS can't hide what ships inside the APK anyway).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const environment = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!['development', 'preview', 'production'].includes(environment)) {
  console.error('Usage: node scripts/eas-env.cjs <development|preview|production> [--dry-run]');
  process.exit(1);
}

const file = path.join(__dirname, '..', '.env');
if (!fs.existsSync(file)) {
  console.error('No .env found. Copy .env.example to .env and fill it in first.');
  process.exit(1);
}

const vars = fs
  .readFileSync(file, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    return { key, value };
  })
  .filter((v) => v.key.startsWith('EXPO_PUBLIC_') && v.value);

if (!vars.length) {
  console.error('.env has no EXPO_PUBLIC_* values set.');
  process.exit(1);
}

// Windows can't spawn npx.cmd without a shell (and a shell would need quoting), so run npm's npx
// script with this same node binary instead.
const npxCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
const run = (args) =>
  process.platform === 'win32' && fs.existsSync(npxCli)
    ? spawnSync(process.execPath, [npxCli, ...args], { stdio: 'inherit' })
    : spawnSync('npx', args, { stdio: 'inherit' });
let failed = 0;
for (const { key, value } of vars) {
  const args = [
    'eas',
    'env:set',
    '--name',
    key,
    '--value',
    value,
    '--environment',
    environment,
    '--visibility',
    'plaintext',
  ];
  if (dryRun) {
    console.log(`would set ${key} (${environment})`);
    continue;
  }
  console.log(`setting ${key} (${environment})…`);
  // Arguments are passed straight through (no shell), so values never need quoting.
  const r = run(args);
  if (r.status !== 0) failed++;
}
if (failed) {
  console.error(`${failed} variable(s) failed. Run \`npx eas login\` first, or set them in the EAS dashboard.`);
  process.exit(1);
}
console.log(
  dryRun ? `${vars.length} variable(s) would be set.` : `Done. ${vars.length} variable(s) set for "${environment}".`,
);
