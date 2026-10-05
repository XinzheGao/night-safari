import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const upstream = fileURLToPath(new URL('../../', import.meta.url));
const vendor = new URL('../extension/vendor/', import.meta.url);
execFileSync('npm', ['run', 'api'], { cwd: upstream, stdio: 'inherit' });
await mkdir(vendor, { recursive: true });
await copyFile(new URL('../../darkreader.js', import.meta.url), new URL('darkreader.js', vendor));
await copyFile(new URL('../../LICENSE', import.meta.url), new URL('DARKREADER-LICENSE', vendor));
const { version } = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
const bytes = await readFile(new URL('darkreader.js', vendor));
await writeFile(new URL('engine.json', vendor), JSON.stringify({
  name: 'Dark Reader', version,
  source: 'https://github.com/darkreader/darkreader',
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstream, encoding: 'utf8' }).trim(),
  sha256: createHash('sha256').update(bytes).digest('hex'),
  license: 'MIT',
}, null, 2) + '\n');
console.log(`Night engine updated: Dark Reader ${version}`);
