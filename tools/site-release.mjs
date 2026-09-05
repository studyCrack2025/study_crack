import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const NO_CACHE = 'no-cache, no-store, must-revalidate';
export const IMMUTABLE = 'public, max-age=31536000, immutable';
const DIST = 'studycrack-mobile-app/dist';
const FIXED_ENTRIES = [`${DIST}/studycrack-mobile.bundle.js`, `${DIST}/studycrack-mobile.css`];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function assertSafePath(relative) {
  assert.ok(typeof relative === 'string' && /^[a-zA-Z0-9_./-]+$/.test(relative), 'Invalid release path');
  assert.ok(!relative.split('/').some((part) => !part || part.startsWith('.')), `Unsafe release path: ${relative}`);
}

function isStaticPath(relative) {
  return /^[^/]+\.html$/.test(relative)
    || ['favicon.ico', 'robots.txt', 'sitemap.xml', 'studycrack-mobile.webmanifest'].includes(relative)
    || /^(?:js\/.+\.js|css\/.+\.css|assets\/.+\.(?:png|jpg|jpeg|svg|webp|pdf|woff2?))$/.test(relative);
}

export function isBuildPath(relative) {
  return FIXED_ENTRIES.includes(relative)
    || /^studycrack-mobile-app\/dist\/chunks\/[\w-]+-[\w-]{8}\.(?:js|css)$/.test(relative)
    || /^studycrack-mobile-app\/dist\/assets\/[\w-]+-[\w-]{8}\.(?:png|jpg|jpeg|svg|webp|woff2?)$/.test(relative);
}

export async function loadPublicPolicy(root = repositoryRoot) {
  const policy = JSON.parse(await readFile(path.join(root, 'tools/public-site-files.json'), 'utf8'));
  assert.ok(Array.isArray(policy.files) && policy.files.length > 0, 'Empty public file policy');
  assert.equal(new Set(policy.files).size, policy.files.length, 'Duplicate public files');
  for (const file of policy.files) {
    assertSafePath(file);
    assert.ok(isStaticPath(file), `Non-public file in policy: ${file}`);
    assert.ok(!/(?:^|\/)(?:tests?|fixtures|node_modules|docs|backend-backup)\/|\.(?:test|spec|local|example)\./i.test(file), `Development file in policy: ${file}`);
  }
  for (const [alias, source] of Object.entries(policy.aliases || {})) {
    assertSafePath(alias);
    assert.ok(!path.extname(alias) && !policy.files.includes(alias), `Invalid clean URL: ${alias}`);
    assert.ok(policy.files.includes(source) && source.endsWith('.html'), `Invalid clean URL source: ${alias}`);
    assert.ok(!/^(?:js|css|assets|studycrack-mobile-app|docs|backend-backup|tools)\//.test(alias), `Reserved clean URL: ${alias}`);
  }
  return policy;
}

export async function readSafeFile(root, relative) {
  assertSafePath(relative);
  let current = root;
  assert.ok((await lstat(root)).isDirectory() && !(await lstat(root)).isSymbolicLink(), 'Release root must be a real directory');
  const parts = relative.split('/');
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    const info = await lstat(current);
    assert.ok(!info.isSymbolicLink(), `Symlink is not publishable: ${relative}`);
    assert.ok(index === parts.length - 1 ? info.isFile() : info.isDirectory(), `Not a regular release path: ${relative}`);
  }
  return readFile(current);
}

async function listFiles(root, prefix = '') {
  const result = [];
  for (const item of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${item.name}` : item.name;
    assertSafePath(relative);
    assert.ok(!item.isSymbolicLink(), `Symlink is not publishable: ${relative}`);
    if (item.isDirectory()) result.push(...await listFiles(root, relative));
    else { assert.ok(item.isFile(), `Not a regular file: ${relative}`); result.push(relative); }
  }
  return result.sort();
}

function assertIdentity(commit, release) {
  assert.match(commit, /^[a-f0-9]{40}$/, 'Expected a complete source commit');
  assert.match(release, /^(?:dev|main|local)-[a-f0-9]{8}$/, 'Invalid release version');
  assert.ok(release.endsWith(commit.slice(0, 8)), 'Release version and source commit differ');
}

export function assertPublicReferences(contents) {
  const names = new Set(contents.keys());
  for (const [owner, bytes] of contents) {
    const text = bytes.toString('utf8');
    let urls = [];
    if (owner.endsWith('.html')) {
      urls = [...text.matchAll(/<(?:script|img|link)\b[^>]*\b(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1]);
    } else if (owner.endsWith('.css')) {
      urls = [...text.matchAll(/url\(\s*["']?([^\s)"']+)["']?\s*\)/g)].map((match) => match[1]);
    } else if (owner.startsWith(`${DIST}/`) && owner.endsWith('.js')) {
      urls = [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["']([^"']+)["']/g)].map((match) => match[1]);
      urls.push(...[...text.matchAll(/\/studycrack-mobile-app\/dist\/(?:assets|chunks)\/[\w.-]+/g)].map((match) => match[0]));
    }
    for (const reference of urls) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference)) continue;
      const url = new URL(reference, `https://release.invalid/${owner}`);
      const file = decodeURIComponent(url.pathname).slice(1);
      assert.ok(names.has(file), `Missing public dependency: ${owner} -> ${file}`);
    }
  }
}

export async function buildSiteRelease({ root = repositoryRoot, output, commit, release }) {
  assertIdentity(commit, release);
  const policy = await loadPublicPolicy(root);
  output = path.resolve(output);
  assert.ok(output !== await realpath(root), 'Do not write over the source repository');
  await mkdir(output); // An existing directory is never replaced or recursively cleared.
  const site = path.join(output, 'site');
  await mkdir(site);
  const built = (await listFiles(path.join(root, DIST))).map((file) => `${DIST}/${file}`);
  for (const file of built) assert.ok(isBuildPath(file), `Unexpected build output: ${file}`);
  for (const entry of FIXED_ENTRIES) assert.ok(built.includes(entry), `Missing fixed entry: ${entry}`);
  assert.ok(built.some((file) => file.startsWith(`${DIST}/chunks/`)), 'Missing split chunks');
  assert.ok(built.some((file) => file.startsWith(`${DIST}/assets/`)), 'Missing bundled artwork');
  for (const file of [...policy.files, ...built]) {
    const bytes = await readSafeFile(root, file);
    await mkdir(path.dirname(path.join(site, file)), { recursive: true });
    await writeFile(path.join(site, file), bytes, { flag: 'wx' });
  }
  execFileSync('bash', [path.join(root, 'tools/bump_asset_version.sh'), release], { cwd: site, stdio: 'pipe' });
  for (const [alias, source] of Object.entries(policy.aliases || {})) {
    await mkdir(path.dirname(path.join(site, alias)), { recursive: true });
    await writeFile(path.join(site, alias), await readSafeFile(site, source), { flag: 'wx' });
  }
  const files = [];
  for (const file of await listFiles(site)) {
    const bytes = await readSafeFile(site, file);
    files.push({ path: file, bytes: bytes.length, sha256: hash(bytes) });
  }
  const manifest = { schema: 1, commit, release, files };
  await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  return verifySiteRelease({ root, output, commit });
}

export async function verifySiteRelease({ root = repositoryRoot, output, commit, expectedDigest }) {
  const policy = await loadPublicPolicy(root);
  const raw = await readSafeFile(output, 'manifest.json');
  const digest = hash(raw);
  if (expectedDigest !== undefined) {
    assert.match(expectedDigest, /^[a-f0-9]{64}$/, 'Invalid expected artifact digest');
    assert.equal(digest, expectedDigest, 'Artifact manifest differs from verified job');
  }
  const manifest = JSON.parse(raw);
  assert.equal(manifest.schema, 1, 'Unsupported release manifest');
  assertIdentity(manifest.commit, manifest.release);
  assert.equal(manifest.commit, commit, 'Artifact is from another source commit');
  assert.ok(Array.isArray(manifest.files) && manifest.files.length, 'Empty release manifest');
  const allowed = new Set([...policy.files, ...Object.keys(policy.aliases || {})]);
  const names = manifest.files.map((entry) => entry.path);
  assert.equal(new Set(names).size, names.length, 'Duplicate manifest entries');
  assert.deepEqual(names, [...names].sort(), 'Manifest order is not deterministic');
  for (const required of [...allowed, ...FIXED_ENTRIES]) assert.ok(names.includes(required), `Missing public file: ${required}`);
  assert.deepEqual(await listFiles(output), ['manifest.json', ...names.map((name) => `site/${name}`)].sort(), 'Unlisted, missing or extra artifact file');
  const site = path.join(output, 'site');
  const contents = new Map();
  for (const entry of manifest.files) {
    assertSafePath(entry.path);
    assert.ok(allowed.has(entry.path) || isBuildPath(entry.path), `Non-public artifact file: ${entry.path}`);
    const bytes = await readSafeFile(site, entry.path);
    assert.equal(bytes.length, entry.bytes, `Artifact size mismatch: ${entry.path}`);
    assert.equal(hash(bytes), entry.sha256, `Artifact checksum mismatch: ${entry.path}`);
    contents.set(entry.path, bytes);
  }
  for (const [alias, source] of Object.entries(policy.aliases || {})) {
    assert.ok((await readSafeFile(site, alias)).equals(await readSafeFile(site, source)), `Clean URL differs from its source: ${alias}`);
  }
  assertPublicReferences(contents);
  return { digest, manifest };
}

export function createPublishCommands(site, bucket, aliases) {
  assert.match(bucket, /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, 'Invalid static bucket');
  const destination = `s3://${bucket}`;
  const sync = (folder, cache) => ['s3', 'sync', path.join(site, folder), `${destination}/${folder}`, '--cache-control', cache, '--only-show-errors'];
  const copy = (file, cache, extra = []) => ['s3', 'cp', path.join(site, file), `${destination}/${file}`, '--cache-control', cache, '--only-show-errors', ...extra];
  return [
    sync(`${DIST}/chunks`, IMMUTABLE), sync(`${DIST}/assets`, IMMUTABLE),
    sync('assets', NO_CACHE), sync('js', IMMUTABLE), sync('css', IMMUTABLE),
    copy('js/config.js', NO_CACHE), copy('js/shared/api.js', NO_CACHE),
    [...copy('assets/pwa', IMMUTABLE), '--recursive'],
    ...FIXED_ENTRIES.map((entry) => copy(entry, NO_CACHE)),
    ['s3', 'sync', site, destination, '--exclude', 'assets/*', '--exclude', 'js/*', '--exclude', 'css/*', '--exclude', 'studycrack-mobile-app/*', '--cache-control', NO_CACHE, '--only-show-errors'],
    ['s3', 'cp', site, destination, '--recursive', '--exclude', '*', '--include', '*.html', ...Object.keys(aliases).flatMap((alias) => ['--include', alias]), '--content-type', 'text/html; charset=utf-8', '--cache-control', NO_CACHE, '--only-show-errors'],
    copy('studycrack-mobile.webmanifest', NO_CACHE, ['--content-type', 'application/manifest+json; charset=utf-8'])
  ];
}

async function main() {
  const [command, directory = 'release-artifact', commit, value] = process.argv.slice(2);
  const output = path.resolve(directory);
  if (command === 'build') {
    const result = await buildSiteRelease({ output, commit, release: value });
    console.log(`Prepared ${result.manifest.files.length} public files (${result.manifest.release}).`);
  } else if (command === 'verify') {
    console.log((await verifySiteRelease({ output, commit, expectedDigest: value })).digest);
  } else if (command === 'publish') {
    assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Publish only through the deployment workflow');
    assert.ok(['refs/heads/dev', 'refs/heads/main'].includes(process.env.GITHUB_REF), 'Publish only dev/main');
    assert.ok(value, 'The verified job digest is required for publication');
    const { manifest } = await verifySiteRelease({ output, commit, expectedDigest: value });
    assert.equal(manifest.release, `${process.env.GITHUB_REF_NAME}-${commit.slice(0, 8)}`, 'Artifact branch does not match destination');
    const policy = await loadPublicPolicy();
    for (const args of createPublishCommands(path.join(output, 'site'), process.env.S3_BUCKET || '', policy.aliases)) execFileSync('aws', args, { stdio: 'inherit' });
  } else throw new Error('Usage: node tools/site-release.mjs build|verify|publish <artifact-dir> <commit> <release|verified-digest>');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
