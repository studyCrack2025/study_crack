import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(appRoot, '..');
const manifestPath = path.join(repositoryRoot, 'studycrack-mobile.webmanifest');
const htmlPath = path.join(repositoryRoot, 'studycrack-mobile.html');
const fallbackCssPath = path.join(repositoryRoot, 'css', 'studycrack-mobile.css');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const html = fs.readFileSync(htmlPath, 'utf8');
const fallbackCss = fs.readFileSync(fallbackCssPath, 'utf8');

assert.equal(manifest.id, '/studycrack-mobile');
assert.equal(manifest.start_url, '/studycrack-mobile');
assert.equal(manifest.scope, '/studycrack-mobile');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.name, 'StudyCrack');
assert.equal(manifest.short_name, 'StudyCrack');
assert.equal(manifest.theme_color, '#0A56B2');
assert.equal(manifest.background_color, '#F7F9FC');
assert.match(html, /<link rel="manifest" href="\.\/studycrack-mobile\.webmanifest" \/>/);
assert.match(html, /<link rel="icon" href="\.\/favicon\.ico" sizes="any" \/>/);
assert.match(html, /<meta name="theme-color" content="#0A56B2" \/>/);
assert.match(html, /<meta name="mobile-web-app-capable" content="yes" \/>/);
assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes" \/>/);
assert.match(html, /<meta name="apple-mobile-web-app-title" content="StudyCrack" \/>/);
assert.match(html, /<div id="root">StudyCrack 앱을 불러오는 중입니다\.\.\.<\/div>/);
assert.match(fallbackCss, /--mobile-boot-bg:#F7F9FC/);
assert.match(fallbackCss, /\.app-shell \{[^}]*background:var\(--mobile-boot-bg\)/);

const requiredIcons = [
  ['assets/pwa/studycrack-symbol-v2-192.png', 192, 'any', 'a7e8643ad762939b77a2da92ea81b1786630d764c4db53ed0ccf623c8088f1ca'],
  ['assets/pwa/studycrack-symbol-v2-512.png', 512, 'any', '5e135acb0207cd7d9547bfbdf172d4f3a4fe207ef80f92d2f3afa0562b558746'],
  ['assets/pwa/studycrack-symbol-v2-maskable-512.png', 512, 'maskable', 'dc5f79c1e666005938a1a9111fb8615c00d931e1a7d9495303c038a7bf0eec0a']
];

for (const [relativePath, expectedSize, purpose, expectedHash] of requiredIcons) {
  const manifestIcon = manifest.icons.find((icon) => icon.src === `/${relativePath}`);
  assert.ok(manifestIcon, `${relativePath} must be declared in the manifest`);
  assert.equal(manifestIcon.sizes, `${expectedSize}x${expectedSize}`);
  assert.equal(manifestIcon.type, 'image/png');
  assert.equal(manifestIcon.purpose, purpose);

  const data = fs.readFileSync(path.join(repositoryRoot, relativePath));
  assert.equal(data.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(data.readUInt32BE(16), expectedSize, `${relativePath} width mismatch`);
  assert.equal(data.readUInt32BE(20), expectedSize, `${relativePath} height mismatch`);
  assert.equal(createHash('sha256').update(data).digest('hex'), expectedHash, `${relativePath} official symbol asset changed`);
}

const appleIconPath = path.join(repositoryRoot, 'assets/pwa/studycrack-apple-touch-icon-v1-180.png');
const appleIcon = fs.readFileSync(appleIconPath);
assert.equal(appleIcon.readUInt32BE(16), 180);
assert.equal(appleIcon.readUInt32BE(20), 180);
assert.match(html, /<link rel="apple-touch-icon" href="\.\/assets\/pwa\/studycrack-apple-touch-icon-v1-180\.png" \/>/);

console.log('pwa contracts passed');
