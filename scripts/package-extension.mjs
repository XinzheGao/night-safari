import { readFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../', import.meta.url));
const extension = new URL('../extension/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', extension), 'utf8'));
const metadata = JSON.parse(await readFile(new URL('vendor/engine.json', extension), 'utf8'));
const engine = await readFile(new URL('vendor/darkreader.js', extension));
assert.equal(createHash('sha256').update(engine).digest('hex'), metadata.sha256, 'Engine digest mismatch: run npm run engine:update');
const files = ['vendor/DARKREADER-LICENSE', manifest.action.default_popup,
  ...manifest.content_scripts.flatMap(entry => [...entry.js, ...entry.css])];
for (const file of files) await readFile(new URL(file, extension));
async function validateJSONFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) await validateJSONFiles(url);
    else if (entry.name.endsWith('.json')) JSON.parse(await readFile(url, 'utf8'));
  }
}
await validateJSONFiles(extension);
const output = new URL(`../artifacts/night-${manifest.version}.zip`, import.meta.url);
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
// Replace the generated archive so removed files cannot survive a subsequent build.
const { rm } = await import('node:fs/promises');
await rm(output, { force: true });
execFileSync('/usr/bin/zip', ['-q', '-r', fileURLToPath(output), 'extension', '-x', '*.DS_Store'], { cwd: root });
execFileSync('/usr/bin/unzip', ['-t', fileURLToPath(output)], { stdio: 'inherit' });
console.log(`Verified extension package: ${fileURLToPath(output)}`);
