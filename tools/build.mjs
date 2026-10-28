// Makes dist/: exactly the files the game needs to run, and nothing else (no screenshots, no source data, no notes).
// The web build, a desktop app (Electron or Tauri) and an iPad app (Capacitor) all start from this folder.
// Usage: node tools/build.mjs        (no dependencies; Node 18 or later)
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
let rev = ''; try { rev = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch {}
const version = `${pkg.version}${rev ? '+' + rev : ''}`;

rmSync(out, { recursive: true, force: true }); mkdirSync(out);
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'src', 'vendor', 'assets', 'THIRD_PARTY.md']) cpSync(join(root, f), join(out, f), { recursive: true });
// a new cache name for each build, so installed copies pick up the update
const sw = join(out, 'sw.js'); writeFileSync(sw, readFileSync(sw, 'utf8').replace(/const VERSION = '[^']*'/, `const VERSION = 'ashland-${version}'`));
writeFileSync(join(out, 'version.json'), JSON.stringify({ name: 'Ashland', version, built: new Date().toISOString() }, null, 2) + '\n');

const size = (p) => statSync(p).isDirectory() ? readdirSync(p).reduce((s, f) => s + size(join(p, f)), 0) : statSync(p).size;
console.log(`dist/ ready: Ashland ${version}, ${(size(out) / 1e6).toFixed(1)} MB`);
