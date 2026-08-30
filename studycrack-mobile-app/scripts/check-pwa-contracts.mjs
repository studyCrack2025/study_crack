import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(appRoot, '..');
const manifestPath = path.join(repositoryRoot, 'studycrack-mobile.webmanifest');
const htmlPath = path.join(repositoryRoot, 'studycrack-mobile.html');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const html = fs.readFileSync(htmlPath, 'utf8');

assert.equal(manifest.id, '/studycrack-mobile');
assert.equal(manifest.start_url, '/studycrack-mobile');
assert.equal(manifest.scope, '/studycrack-mobile');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.theme_color, '#0A56B2');
assert.equal(manifest.background_color, '#F7F9FC');
assert.match(html, /<link rel="manifest" href="\.\/studycrack-mobile\.webmanifest" \/>/);
assert.match(html, /<link rel="icon" href="\.\/favicon\.ico" sizes="any" \/>/);
assert.match(html, /<meta name="theme-color" content="#0A56B2" \/>/);
assert.match(html, /<meta name="mobile-web-app-capable" content="yes" \/>/);
assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes" \/>/);
assert.match(html, /<meta name="apple-mobile-web-app-title" content="StudyCrack" \/>/);

const requiredIcons = [
  ['assets/pwa/studycrack-icon-v1-192.png', 192, 'any'],
  ['assets/pwa/studycrack-icon-v1-512.png', 512, 'any'],
  ['assets/pwa/studycrack-icon-v1-maskable-512.png', 512, 'maskable']
];

for (const [relativePath, expectedSize, purpose] of requiredIcons) {
  const manifestIcon = manifest.icons.find((icon) => icon.src === `/${relativePath}`);
  assert.ok(manifestIcon, `${relativePath} must be declared in the manifest`);
  assert.equal(manifestIcon.sizes, `${expectedSize}x${expectedSize}`);
  assert.equal(manifestIcon.type, 'image/png');
  assert.equal(manifestIcon.purpose, purpose);

  const data = fs.readFileSync(path.join(repositoryRoot, relativePath));
  assert.equal(data.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(data.readUInt32BE(16), expectedSize, `${relativePath} width mismatch`);
  assert.equal(data.readUInt32BE(20), expectedSize, `${relativePath} height mismatch`);
}

const appleIconPath = path.join(repositoryRoot, 'assets/pwa/studycrack-apple-touch-icon-v1-180.png');
const appleIcon = fs.readFileSync(appleIconPath);
assert.equal(appleIcon.readUInt32BE(16), 180);
assert.equal(appleIcon.readUInt32BE(20), 180);
assert.match(html, /<link rel="apple-touch-icon" href="\.\/assets\/pwa\/studycrack-apple-touch-icon-v1-180\.png" \/>/);

console.log('pwa contracts passed');
